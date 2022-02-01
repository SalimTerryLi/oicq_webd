"use strict"

exports.build_http_response = (status_code, fields) => {
    return {
        status: {
            code: status_code
        },
        ...fields
    }
}

const { segment } = require("oicq")
const {botClient, bot} = require("../middleware");

// return null if failed to fetch forwarded msg
async function get_xml_from_forward_id(id){
    let forwardmsg = await botClient.pickUser(botClient.uin).getForwardMsg(id).catch(e => {
        return null
    })
    if (forwardmsg === null) {
        return null
    }
    let xmlmsg = await botClient.pickUser(botClient.uin).makeForwardMsg(forwardmsg).catch(e => {
        return null
    })
    if (xmlmsg === null) {
        return null
    }
    return xmlmsg
}

async function async_convert_msgContent_to_oicq(msg) {
    let retmsg = []
    for (const p of msg) {
        if (p.type === "text") {
            retmsg.push(p.text)
        } else if (p.type === "image") {
            if ("base64" in p) {
                retmsg.push(segment.image(`base64://${p.base64}`))
            } else {
                retmsg.push(segment.image(p.url))
            }
        }else if (p.type === "mention") {
            if (p.target === 0) {
                retmsg.push(segment.at("all"))
            } else {
                retmsg.push(segment.at(p.target))
            }
        }else if (p.type === "emoji") {
            retmsg.push(segment.face(p.id))
        } else if (p.type === "forwarded") {
            let xmlmsg = await get_xml_from_forward_id(p.id)
            if (xmlmsg === null) {
                console.error("failed to get forwarded msg")
                return null
            } else {
                retmsg.push(xmlmsg)
            }
        } else if (p.type === "json") {
            retmsg.push(segment.json(p.data))
        } else if (p.type === "xml") {
            retmsg.push(segment.xml(p.data))
        }
    }
    return retmsg
}

exports.convert_msgContent_to_oicq = (msg) => {
    return new Promise((resolve, reject) => {
        async_convert_msgContent_to_oicq(msg).then(r => {
            resolve(r)
        }).catch(e => {
            reject(e)
        })
    })
}

async function async_convert_forward_msgs_to_oicq(msgs) {
    let oicq_forwardable =[]
    for (const msg of msgs) {
        const converted_msg_content = await async_convert_msgContent_to_oicq(msg.msgContent)
        if (converted_msg_content === null) {
            return null
        }
        oicq_forwardable.push({
            user_id: msg.id,
            message: converted_msg_content,
            nickname: 'nickname' in msg? msg.nickname: null,
            time: 'nickname' in msg? msg.time: null,
        })
    }
    return oicq_forwardable
}

exports.convert_forward_msgs_to_oicq = (msgs) => {
    return new Promise((resolve, reject) => {
        async_convert_forward_msgs_to_oicq(msgs).then(r => {
            resolve(r)
        }).catch(e => {
            reject(e)
        })
    })
}

const parseXML = require('xml2js').parseString;

exports.convert_oicq_message_to_msgContent = (msg) => {
    let ret = []
    for (const m of msg) {
        if (m.type === "text") {
            ret.push({
                "type": "text",
                "text": m.text
            })
        } else if (m.type === "image") {
            ret.push({
                "type": "image",
                "asEmoji": m.asface,
                "url": m.url
            })
        } else if (m.type === "at") {
            ret.push({
                "type": "mention",
                "target": m.qq === "all" ? 0 : m.qq,
                "displayText": m.text
            })
        } else if (m.type === "face") {
            ret.push({
                "type": "emoji",
                "id": m.id,
                "replaceText": m.text
            })
        } else if (m.type === "xml") {
            // Try to detect known xml msgs like: forwarded msg
            let parsedObj = null
            parseXML(m.data, {async: false}, function (err, result) {
                if (result !== undefined) {
                    parsedObj = result
                }
            });
            if (parsedObj !== null) {
                try {
                    if (parsedObj['msg']['$'].action === "viewMultiMsg") {
                        // forwarded mesg
                        ret.push({
                            "type": "forwarded",
                            "id": parsedObj['msg']['$'].m_resid
                        })
                        continue
                    }
                } catch {}
            }
            ret.push({
                "type": "xml",
                "data": m.data
            })
        } else if (m.type === "json") {
            ret.push({
                "type": "json",
                "data": m.data
            })
        } else {
            console.log("Unsupported MSG:")
            console.log(m)
        }
    }
    return ret
}

exports.bot_storage = {
    friend_reqs: {},
    group_invites: {},
    group_join_reqs: {}
}

/*
 * convert seq + rand + timestamp to a string id
 * based on: 32 bits timestamp + 32 bits seq + 32 bits rand, all LE
 * [ tsL ... tsH seqL ... seqH raL ... raH ]
 * buf[0]                             buf[11]
 * total 12 byte (96 bits), then convert to base64
 * finally got 128 bits
 */

exports.msgid_utils = {
    convert_msgid_to_seq: (msgid) => {
        let buffer = Buffer.from(msgid, 'base64')
        if (buffer.length !== 12) {
            return null
        }
        return {
            seq: buffer.readUInt32LE(4),
            rand: buffer.readUInt32LE(8),
            time: buffer.readUInt32LE(0)
        }
    },

    convert_seq_to_msgid: (seq, rand, time) => {
        let buffer = Buffer.alloc(12)
        buffer.writeUInt32LE(time, 0)
        buffer.writeUInt32LE(seq, 4)
        buffer.writeUInt32LE(rand, 8)
        return buffer.toString('base64')
    }
}
