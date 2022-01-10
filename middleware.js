"use strict"

exports.webListener = null
exports.botClient = null
exports.config = null

exports.createMiddleware = (bot, listener, cfg) => {
    exports.webListener = listener
    exports.botClient = bot
    exports.config = cfg
    require("./botprotocol/oicq_listener")
    require("./botprotocol/webapi")
    require("./botprotocol/storage")
}