"use strict"

exports.webListener = null
exports.botClient = null

exports.createMiddleware = (bot, listener) => {
    exports.webListener = listener
    exports.botClient = bot
    require("./botprotocol/oicq_listener")
    require("./botprotocol/webapi")
}