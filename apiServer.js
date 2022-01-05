"use strict"

const express = require("express");
const http = require("node:http");
const ws = require("ws");
const pkgInfo = require("./package.json");


exports.createServer = (bind_addr='127.0.0.1', port=8888) => {
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
    httpserver.listen(port, bind_addr, () => {
        console.log(`HTTP/WebSocket API Server listening at http://${bind_addr}:${port}`)
    })

    express_server.get('/', (req, res) => {
        res.json({
            name: pkgInfo.name,
            version: pkgInfo.version
        })
    })

    return {
        http_listener: express_server,
        ws_listener: wsserver,
    }
}