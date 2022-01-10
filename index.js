"use strict"

const argv = require('yargs/yargs')(process.argv.slice(2))
    .usage('Usage: $0 [options]')
    .option('h', {
        alias: 'help',
        description: 'display help message'
    })
    .help('help')
    .showHelpOnFail(false, 'whoops, something went wrong! run with --help')

    .option('c', {
        description: 'config file path. default="oicqcfg.json". will be overridden by following opts',
        alias: 'config',
        type: 'string',
    })
    .option('d', {
        description: 'persist oicq data dir. default=".oicq_data"',
        alias: 'data',
        type: 'string',
    })
    .option('q', {
        description: 'qq number',
        alias: 'qq',
        type: 'number',
    })
    .option('P', {
        description: 'use password login',
        alias: 'password',
        type: 'string',
    })
    .option('s', {
        description: 'scan qrcode to login',
        alias: 'qrcode',
        type: 'boolean',
    })
    .conflicts('s', 'P')
    .option('p', {
        description: 'WebAPI listen port. default=8888',
        alias: 'port',
        type: 'number',
    })
    .option('b', {
        description: 'WebAPI bind address. default="127.0.0.1"',
        alias: 'bindaddr',
        type: 'string',
    })
    .argv

// fill default parameters
let config = {
    data_dir: '.oicq_data',
    qq: 0,
    password: '',
    bindaddr: '127.0.0.1',
    port: 8888
}

// try to load config file
try {
    const cfgFile = 'config' in argv? argv.config: 'oicqcfg.json'
    const config_file = JSON.parse(require('fs').readFileSync(cfgFile))
    console.error('loading cfg file: '+ cfgFile)
    if ('data_dir' in config_file) config.data_dir = config_file.data_dir
    if ('qq' in config_file) config.qq = config_file.qq
    if ('password' in config_file) config.password = config_file.password
    if ('bindaddr' in config_file) config.bindaddr = config_file.bindaddr
    if ('port' in config_file) config.port = config_file.port
} catch {}

// apply options from cmdline
if ('data' in argv) config.data_dir = argv.data
if ('qq' in argv) config.qq = argv.qq
if ('password' in argv) config.password = argv.password
if ('bindaddr' in argv) config.bindaddr = argv.bindaddr
if ('port' in argv) config.port = argv.port

process.on("unhandledRejection", (reason, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', reason)
})

// init oicq
const { createClient } = require("oicq")
const bot_client = createClient(config.qq, {
    data_dir: config.data_dir,
})
if ('qrcode' in argv) {
    // do qrcode login
    bot_client.on("system.login.qrcode", function (e) {
        console.log("扫码后按Enter完成登录")
        process.stdin.once("data", () => {
            this.login()
        })
    }).login()
} else {
    // do password login
    bot_client.login(config.password)
}

// load WebServer module
const web_listener = require("./apiServer").createServer(config.bindaddr, config.port)

// setup protocol middleware
require("./middleware").createMiddleware(bot_client, web_listener, config)