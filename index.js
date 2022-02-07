#!/usr/bin/env node

"use strict"

const yargs = require('yargs/yargs')
const {exit} = require("yargs");
const argv = yargs(process.argv.slice(2))
    .usage('Usage: $0 [option [value]] ...')
    .usage('Cli parameters will override the corresponding ones from configuration file')
    .option('h', {
        alias: 'help',
        description: 'display help message'
    })
    .help('help')
    .alias('v', 'version')

    .config('config', (path) => {
        try {
            return require(path)
        } catch {}
        return {}
    })
    .alias('c', 'config')
    .default('c', 'oicqweb_cfg.json')

    .option('d', {
        description: 'persist oicq data dir',
        alias: 'datadir',
        type: 'string',
        default: '.oicq_data'
    })

    .option('q', {
        description: 'qq number',
        alias: 'qq',
        type: 'number',
    }).check((argv) => {
        return 'qq' in argv
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
        default: false
    })
    .check((argv) => {
        return !(!('password' in argv) && !('qrcode' in argv));
    })

    .option('p', {
        description: 'WebAPI listen port',
        alias: 'port',
        type: 'number',
        default: 8888
    })
    .option('b', {
        description: 'WebAPI bind address',
        alias: 'bind',
        type: 'string',
        default: '127.0.0.1'
    })

    .strict()
    .argv

const daemon = new (require('./oicq_webd').OICQWebAPIDaemon)(argv)
daemon.run().then(r => {})

process.on("unhandledRejection", (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

process.on('SIGINT', async function (){
    console.log('SIGINT caught, requesting exiting...');
    await daemon.request_stop()
    // unfortunately oicq cannot do graceful shutdown.
    process.exit(0)
});
