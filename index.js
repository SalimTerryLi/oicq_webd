"use strict"

const config = require("./config").config.oicq

process.on("unhandledRejection", (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason)
})

// init oicq
const { createClient } = require("oicq")
const bot_client = createClient(config.bot_qq)
bot_client.login(config.passwd)

// load WebServer module
const web_listener = require("./apiServer").createServer()

// setup protocol middleware
require("./middleware").createMiddleware(bot_client, web_listener)