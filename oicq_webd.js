"use strict"

const {createClient} = require("oicq");
const express = require("express");
const http = require("node:http");
const ws = require("ws");

const MessageStorage = require('./storage').MessageStorage

class OICQWebAPIDaemon{
    constructor(config) {
        this._config = config
        this._base_server = null
        this._http_server = null
        this._ws_server = null
        this.logger = null
        this._bot = null
        this._pushserv = null
        this._msgdb = null
    }

    async run() {
        this._bot = createClient(this._config.qq, {
            data_dir: this._config.datadir,
            ignore_self: false,
        })

        this.logger = this._bot.logger
        this.logger.info('Bring up HTTP API Backend')
        this._http_server = express()
        this._http_server.use(express.json())
        this._base_server = http.createServer(this._http_server)
        this._ws_server = new ws.WebSocketServer({noServer: true})
        this._msgdb = new MessageStorage(this.logger, this._config.datadir, this._config.qq)

        // register http connection upgrading
        this._base_server.on('upgrade', (request, socket, head) => {
            this._ws_server.handleUpgrade(request, socket, head, socket => {
                this._ws_server.emit('connection', socket, request)
            })
        })
        this._pushserv = new PushService(this.logger)
        this._ws_server.on('connection', socket => {
            this._pushserv.add_subscriber(socket)
        })

        // listen on port
        await this._base_server.listen(this._config.port, this._config.bind)
        this.logger.info(`HTTP/WebSocket API Server listening at http://${this._config.bind}:${this._config.port}`)

        if (this._config.qrcode) {
            // do qrcode login
            await this._bot.on("system.login.qrcode", function (e) {
                console.log("扫码后按Enter完成登录")
                process.stdin.once("data", () => {
                    this.login()
                })
            }).login()
        } else {
            // do password login
            await this._bot.login(this._config.password)
        }

        require('./web_daemon').create_web_daemon(this._http_server, this._bot, this._msgdb, this.logger)
        require('./bot_daemon').create_bot_daemon(this._pushserv, this._bot, this._msgdb)
    }

    async request_stop() {
        await this._pushserv.request_stop()
        await this._ws_server.close()
        await this._base_server.close()
        this._msgdb.cleanup()
        this.logger.info('HTTP Backend exited')
    }
}

class PushService{
    constructor(logger) {
        this._ws_list = []
        this.logger = logger
        this._heartbeat_timer = null
    }

    add_subscriber(so) {
        // keep a flag indicating ping status
        so.isAlive = true
        so.on('pong', () => {so.isAlive = true})
        // add to list
        this._ws_list.push(so)
        // register callback on close
        so.onclose = () => {
            // remove the reference
            const idx = this._ws_list.indexOf(so)
            if (idx > -1) {
                this._ws_list.splice(idx, 1);
                this.logger.info(`Websocket session disconnected. Remaining ${this._ws_list.length} connections`)
            } else {
                this.logger.error("Websocket session not found!")
            }
            // stop the timer when no more session exist
            if (this._ws_list.length === 0) {
                clearInterval(this._heartbeat_timer)
                this._heartbeat_timer = null
            }
        }
        // check and start timer
        if (this._heartbeat_timer === null) {
            this._heartbeat_timer = setInterval(function () {
                for(let i = this._ws_list.length -1; i >= 0 ; i--){
                    if (!this._ws_list[i].isAlive) {
                        this.logger.warn('A Websocket session timeout, terminating')
                        this._ws_list[i].terminate()
                        continue
                    }
                    this._ws_list[i].isAlive = false
                    this._ws_list[i].ping()
                }
            }.bind(this), 3000)
        }
        this.logger.info('New Websocket session established')
    }

    deliver_data(data) {
        for (const so of this._ws_list) {
            so.send(data)
        }
    }

    async request_stop() {
        for (const so of this._ws_list) {
            await so.close(1001)
        }
        const remain_so_count = this._ws_list.length
        this.logger.info(remain_so_count + ' Websocket sessions closed')
        this._ws_list.slice(0, remain_so_count - 1)
        if (remain_so_count !== 0) {
            clearInterval(this._heartbeat_timer)
            this._heartbeat_timer = null
        }
    }
}

exports.OICQWebAPIDaemon = OICQWebAPIDaemon