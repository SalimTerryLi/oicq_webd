"use strict"

const express = require("express");
const http = require("node:http");
const ws = require("ws");

exports.createServer = () => {
    const config = require("./config").config.web

    const express_server = express()
    express_server.use(express.json())
    const httpserver = http.createServer(express_server)
    const wsserver = new ws.WebSocketServer({noServer: true})
    // bind ws listener
    httpserver.on('upgrade', (request, socket, head) => {
        wsserver.handleUpgrade(request, socket, head, socket => {
            wsserver.emit('connection', socket, request)
        })
    })
    // start listening
    httpserver.listen(config.port, config.bind_addr, () => {
        console.log(`HTTP/WebSocket API Server listening at http://${config.bind_addr}:${config.port}`)
    })

    return {
        http_listener: express_server,
        ws_listener: wsserver,
    }
}