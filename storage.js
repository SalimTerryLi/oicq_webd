"use strict"

const sqlite3 = require('better-sqlite3')
const fs = require('fs')
const path = require("path")

const utils = require('./utils')

const CLEANUP_TASK_INTERVAL_S = 60 * 60 * 24 * 3

class MessageStorage{
    /*
    Will save message history in base_path as:
    base_path/[selfid]/history/[group|private]/[date]/[channel].sqlite3
    base_path should be the same as oicq data dir
     */
    constructor(logger, base_path, selfid) {
        this.logger = logger
        this.base_path = path.join(base_path, selfid.toString())
        this.opened_conns = {
            private: {},
            group: {}
        }
        this.opened_conn_count = 0
        this.__schd_task = null

        this._strangerlist_conn = null
    }

    cleanup() {
        if (this._strangerlist_conn !== null) {
            this._strangerlist_conn.close()
            this._strangerlist_conn = null
        }
        for (const conn_date in this.opened_conns.group)
            for (const conn_name in this.opened_conns.group[conn_date])
                this.opened_conns.group[conn_date][conn_name].close()
        for (const conn_date in this.opened_conns.private)
            for (const conn_name in this.opened_conns.private[conn_date])
                this.opened_conns.private[conn_date][conn_name].close()
        if (this.__schd_task !== null) {
            clearInterval(this.__schd_task)
            this.__schd_task = null
        }
    }

    __schd_cleanup() {
        this.logger.info('Scheduled task: closing old db connections')
        const curr = new Date()
        let delta_period = new Date(0)
        delta_period.setDate(2)
        delta_period = delta_period.getTime()

        let deleted_conns_count = 0
        for (const conn_date in this.opened_conns.group) {
            let time_delta = curr - utils.calc_date_from_str(conn_date)
            if (time_delta >= delta_period) {
                for (const conn_name in this.opened_conns.group[conn_date]) {
                    this.opened_conns.group[conn_date][conn_name].close()
                    deleted_conns_count++
                }
                delete this.opened_conns.group[conn_date]
                this.opened_conns--
            }
        }
        for (const conn_date in this.opened_conns.private) {
            let time_delta = curr - utils.calc_date_from_str(conn_date)
            if (time_delta >= delta_period) {
                for (const conn_name in this.opened_conns.private[conn_date]) {
                    this.opened_conns.private[conn_date][conn_name].close()
                    deleted_conns_count++
                }
                delete this.opened_conns.private[conn_date]
                this.opened_conns--
            }
        }
        if (this.opened_conns === 0) {
            clearInterval(this.__schd_task)
            this.__schd_task = null
        }
        this.logger.info('Scheduled task: closed ' + deleted_conns_count + ' db connections, remaining '
            + this.opened_conns + ' connections')
    }

    save_msg_history(msgData) {
        // date part of msg db
        const dateStr = utils.convert_timestamp_to_date(msgData.time * 1000)

        // channel part of msg db
        const chanStr = msgData.channel.toString()

        // channel type part of msg db
        const conn_type_set = this.opened_conns[msgData.type]   // always exists
        if (! (dateStr in conn_type_set)) {
            // date set is not included, ensure it
            conn_type_set[dateStr] = {}
        }

        // channel part of msg db
        const conn_date_set = conn_type_set[dateStr]
        if (! (chanStr in conn_date_set)) {
            // channel part is not included
            const dirPath = path.join(
                this.base_path,
                'history',
                msgData.type,
                dateStr
            )
            // ensure dir exists
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true })
            }
            // ensure db format
            const db = sqlite3(path.join(dirPath, chanStr + '.sqlite3'))
            db.prepare('CREATE TABLE IF NOT EXISTS message_history (id TEXT, content TEXT, PRIMARY KEY (id))').run()
            conn_date_set[chanStr] = db
            this.opened_conn_count++

            if (this.__schd_task === null) {
                this.__schd_task = setInterval(this.__schd_cleanup.bind(this), 1000 * CLEANUP_TASK_INTERVAL_S)
            }
        }

        // now db connection is ready
        const db = conn_date_set[chanStr]
        db.prepare('INSERT INTO message_history VALUES(?, ?)')
            .run(msgData.msgID, JSON.stringify(msgData))

        // update stranger_list if necessary
        if (!msgData.known && msgData.type === 'private') {
            // ensure db connection
            if (this._strangerlist_conn === null) {
                if (!fs.existsSync(this.base_path)) {
                    fs.mkdirSync(this.base_path, { recursive: true })
                }
                const db_ = sqlite3(path.join(this.base_path, 'strangers.sqlite3'))
                db_.prepare('CREATE TABLE IF NOT EXISTS stranger_list (id INTEGER, "from" INTEGER, time INTEGER, PRIMARY KEY (id))').run()
                this._strangerlist_conn = db_
            }
            this._strangerlist_conn.prepare('INSERT OR REPLACE INTO stranger_list VALUES(?, ?, ?)')
                .run(msgData.sender, msgData.channel, new Date().getTime() / 1000)
        }
    }

    query_msg_history(type, channel, msgID) {
        const dateStr = utils.convert_timestamp_to_date(utils.msgid_utils.convert_msgid_to_seq(msgID).time * 1000)
        const chanStr = channel.toString()
        const conn_type_set = this.opened_conns[type]
        if (! (dateStr in conn_type_set)) {
            conn_type_set[dateStr] = {}
        }
        const conn_date_set = conn_type_set[dateStr]
        if (! (chanStr in conn_date_set)) {
            try {
                const filename = path.join(
                    this.base_path,
                    'history',
                    type,
                    dateStr,
                    channel.toString() + '.sqlite3'
                )
                conn_date_set[chanStr] = sqlite3(filename, {fileMustExist: true})
                this.opened_conn_count++
                if (this.__schd_task === null) {
                    this.__schd_task = setInterval(this.__schd_cleanup.bind(this), 1000 * CLEANUP_TASK_INTERVAL_S)
                }
            } catch {
                // file not available, return null as not found
                return null
            }
        }

        // db is ready
        const db = conn_date_set[chanStr]
        const result = db.prepare('SELECT content FROM message_history where id=?').get(msgID)
        if (result === undefined) {
            return null
        } else {
            return JSON.parse(result.content)
        }
    }

    query_channel_of_stranger(id) {
        if (this._strangerlist_conn === null) {
            try {
                this._strangerlist_conn = sqlite3(path.join(this.base_path, 'strangers.sqlite3'), {fileMustExist: true})
            } catch {
                return -1
            }
        }
        const result = this._strangerlist_conn.prepare('SELECT "from" FROM stranger_list where id=?').get(id)
        if (result === undefined) {
            return -1
        }
        this._strangerlist_conn.prepare('UPDATE stranger_list SET time=?')
            .run(new Date().getTime() / 1000)
        return result['from']
    }
}

exports.MessageStorage = MessageStorage