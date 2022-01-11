"use strict"

const config = require("../middleware").config
const bot = require("../middleware").botClient

const sqlite3 = require('better-sqlite3')
const fs = require('fs')

// opened_conns[date][channel]
let opened_conns = {
    private: {},
    group: {}
}

function schd_close_dbs() {
    console.log('Scheduled closing old db connections...')
    const curr = new Date()
    let delta_period = new Date(0)
    delta_period.setDate(2)
    delta_period = delta_period.getTime()

    function calc_date_from_str(str) {
        let date = new Date(0)
        date.setDate(str.substr(6,2))
        date.setMonth(str.substr(4,2) - 1)
        date.setFullYear(str.substr(0,4))
        return date
    }

    let deleted_conns_count = 0
    for (const conn_date in opened_conns.group) {
        let time_delta = curr - calc_date_from_str(conn_date)
        if (time_delta >= delta_period) {
            for (const conn_name in opened_conns.group[conn_date]) {
                opened_conns.group[conn_date][conn_name].close()
                deleted_conns_count++
            }
            delete opened_conns.group[conn_date]
        }
    }
    for (const conn_date in opened_conns.private) {
        let time_delta = curr - calc_date_from_str(conn_date)
        if (time_delta >= delta_period) {
            for (const conn_name in opened_conns.private[conn_date]) {
                opened_conns.private[conn_date][conn_name].close()
                deleted_conns_count++
            }
            delete opened_conns.private[conn_date]
        }
    }
    console.log('closed ' + deleted_conns_count + ' db connections')
}
setInterval(schd_close_dbs, 1000 * 60 * 60 * 3)

function convert_timestamp_to_date(ts) {
    const date = new Date(ts)
    return date.getFullYear().toString().padStart(4, '0') +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0')
}

const path = require('path')
const util = require("util");
const {msgid_utils, convert_oicq_message_to_msgContent} = require("./utils");
function calc_msg_history_dbname(dateStr, channelStr, type) {
    return path.join(
        config.data_dir,
        bot.uin.toString(),
        'history',
        type,
        dateStr,
        channelStr + '.sqlite3')
}

/*
 * packed_msg.data
 */
exports.save_msg_history = (msgData) => {
    const dateStr = convert_timestamp_to_date(msgData.time * 1000)
    let chanStr = null
    if (msgData.type === 'private') {
        chanStr = msgData.sender.toString()
    } else if (msgData.type === 'group') {
        chanStr = msgData.channel.toString()
    }
    const chat_db = opened_conns[msgData.type]
    if (! (dateStr in chat_db)) {
        chat_db[dateStr] = {}
    }
    const opened_conns_date = chat_db[dateStr]
    if (! (chanStr in opened_conns_date)) {
        const dirPath = path.join(
            config.data_dir,
            bot.uin.toString(),
            'history',
            msgData.type,
            dateStr
        )
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }
        const db = sqlite3(calc_msg_history_dbname(dateStr, chanStr, msgData.type))
        db.prepare('CREATE TABLE IF NOT EXISTS message_history (id TEXT, content TEXT, PRIMARY KEY (id))').run()
        opened_conns_date[chanStr] = db
    }
    const db = opened_conns_date[chanStr]
    db.prepare('INSERT INTO message_history VALUES(?, ?)')
        .run(msgData.msgID, JSON.stringify(msgData))
}

/*
 * Group chat: channel
 * Friend chat: sender
 * Temporary chat: sender
 */
exports.query_msg_history = (type, channel, msgID) => {
    const dateStr = convert_timestamp_to_date(msgid_utils.convert_msgid_to_seq(msgID).time * 1000)
    let chanStr = channel.toString()
    const chat_db = opened_conns[type]
    if (! (dateStr in chat_db)) {
        chat_db[dateStr] = {}
    }
    const opened_conns_date = chat_db[dateStr]
    if (! (chanStr in opened_conns_date)) {
        try {
            opened_conns_date[chanStr] = sqlite3(calc_msg_history_dbname(dateStr, chanStr, type), {fileMustExist: true})
        } catch {
            return null
        }
    }
    const db = opened_conns_date[chanStr]
    const result = db.prepare('SELECT content FROM message_history where id=?').get(msgID)
    if (result === undefined) {
        return null
    } else {
        return JSON.parse(result.content)
    }
}