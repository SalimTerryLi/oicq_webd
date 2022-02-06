"use strict"

const {segment} = require("oicq");
const {parseString: parseXML} = require("xml2js");

exports.delay = ms => new Promise(resolve => setTimeout(resolve, ms))

exports.convert_timestamp_to_date = (ts) => {
    const date = new Date(ts)
    return date.getFullYear().toString().padStart(4, '0') +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0')
}

exports.calc_date_from_str = (str) => {
    let date = new Date(0)
    date.setDate(str.substr(6, 2))
    date.setMonth(str.substr(4, 2) - 1)
    date.setFullYear(str.substr(0, 4))
    return date
}

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

exports.msg_utils = {
    async_convert_msgContent_to_oicq_seg: async (msg, forward_parser) => {
        let retmsg = []
        for (const p of msg) {
            if (p.type === "text") {
                retmsg.push(p.text)
            } else if (p.type === "image") {
                if ("url" in p) {
                    retmsg.push(segment.image(p.url))
                } else {
                    retmsg.push(segment.image(`base64://${p.base64}`))
                }
            } else if (p.type === "mention") {
                if (p.target === 0) {
                    retmsg.push(segment.at("all"))
                } else {
                    retmsg.push(segment.at(p.target))
                }
            } else if (p.type === "emoji") {
                retmsg.push(segment.face(p.id))
            } else if (p.type === "forwarded") {
                let xmlmsg = await forward_parser(p.id)
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
            } else {
                console.error("unsupported msg content type: " + p.type)
            }
        }
        return retmsg
    },

    async_convert_oicq_message_to_msgContent: async (msg) => {
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
                    } catch {
                    }
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
                console.error("Unsupported MSG:")
                console.error(m)
            }
        }
        return ret
    },

    async_convert_private_message_event: async (e, bot) => {
        let channel, channel_name, sender_nick, ref_channel, ref_channel_name
        if (e.sub_type === "group") {
            ref_channel = e.sender.group_id
            ref_channel_name = bot.pickGroup(e.sender.group_id).name
            if (e.from_id === bot.uin) {
                // sent by us
                channel = e.to_id
            } else {
                channel = e.from_id
            }
            let memberinfo = bot.pickGroup(e.sender.group_id).pickMember(channel).info
            if (memberinfo === undefined) {
                await bot.pickGroup(e.sender.group_id).pickMember(channel).renew()
                memberinfo = bot.pickGroup(e.sender.group_id).pickMember(channel).info
            }
            channel_name = memberinfo.card === ''? memberinfo.nickname: memberinfo.card
            let senderinfo = bot.pickGroup(e.sender.group_id).pickMember(e.from_id).info
            if (senderinfo === undefined) {
                await bot.pickGroup(e.sender.group_id).pickMember(e.from_id).renew()
                senderinfo = bot.pickGroup(e.sender.group_id).pickMember(e.from_id).info
            }
            sender_nick = senderinfo.card === ''? senderinfo.nickname: senderinfo.card
        } else if (e.sub_type === "friend") {
            ref_channel = 0
            ref_channel_name = ''
            if (e.from_id === bot.uin) {
                // sent by us
                channel = e.to_id
                sender_nick = bot.nickname
            } else {
                channel = e.from_id
                const senderinfo = bot.pickFriend(channel)
                sender_nick = senderinfo.remark === ''? senderinfo.nickname: senderinfo.remark
            }
            const memberinfo = bot.pickFriend(channel)
            channel_name = memberinfo.remark === ''? memberinfo.nickname: memberinfo.remark
        } else {
            console.error('unsupported e.sub_type: ' + e.sub_type)
        }
        return {
            "type": "private",
            "time": e.time,
            "known": e.sub_type === "friend",
            "channel": channel,
            "channel_name": channel_name,
            "sender": e.from_id,
            "sender_nick": sender_nick,
            "ref_channel": ref_channel,
            "ref_channel_name": ref_channel_name,
            "msgID": exports.msgid_utils.convert_seq_to_msgid(e.seq, e.rand, e.time),
            "msgContent": await exports.msg_utils.async_convert_oicq_message_to_msgContent(e.message),
            "msgString": e.raw_message,
            "reply": "source" in e? {
                "to": e.source.user_id,
                "time": e.source.time,
                "summary": e.source.message,
                "id": exports.msgid_utils.convert_seq_to_msgid(e.source.seq, e.source.rand, e.source.time),
            }: undefined
        }
    },
    async_convert_group_message_event: async (e) => {
        return {
            "type": "group",
            "time": e.time,
            "known": e.anonymous === null,
            "channel": e.group_id,
            "channel_name": e.group_name,
            "sender": e.anonymous === null ? e.user_id : e.anonymous.id,
            "sender_nick": e.sender.card === ''? e.sender.nickname: e.sender.card,
            "ref_channel": 0,
            "ref_channel_name": '',
            "msgID": exports.msgid_utils.convert_seq_to_msgid(e.seq, e.rand, e.time),
            "msgContent": await exports.msg_utils.async_convert_oicq_message_to_msgContent(e.message),
            "msgString": e.raw_message,
            "reply": "source" in e? {
                "to": e.source.user_id,
                "time": e.source.time,
                "summary": e.source.message,
                "id": exports.msgid_utils.convert_seq_to_msgid(e.source.seq, e.source.rand, e.source.time),
            }: undefined
        }
    }
}

exports.eventid_utils = {
    gen_friend_req_id: (seq, uid) => {
        let buffer = Buffer.alloc(16)
        buffer.writeBigUInt64LE(BigInt(uid), 0)
        buffer.writeBigUInt64LE(BigInt(seq), 8)
        return buffer.toString('base64')
    },
    parse_friend_req_id: (eventID) => {
        let buffer = Buffer.from(eventID, 'base64')
        if (buffer.length !== 16) {
            return null
        }
        return Number(buffer.readBigUInt64LE(8))
    },

    gen_group_invite_id: (seq, gid) => {
        let buffer = Buffer.alloc(16)
        buffer.writeBigUInt64LE(BigInt(gid), 0)
        buffer.writeBigUInt64LE(BigInt(seq), 8)
        return buffer.toString('base64')
    },
    parse_group_invite_id: (eventID) => {
        let buffer = Buffer.from(eventID, 'base64')
        if (buffer.length !== 16) {
            return null
        }
        return {
            seq: Number(buffer.readBigUInt64LE(8)),
            gid: Number(buffer.readBigUInt64LE(0))
        }
    },

    gen_group_join_req_id: (seq, uid) => {
        let buffer = Buffer.alloc(16)
        buffer.writeBigUInt64LE(BigInt(uid), 0)
        buffer.writeBigUInt64LE(BigInt(seq), 8)
        return buffer.toString('base64')
    },
    parse_group_join_req_id: (eventID) => {
        let buffer = Buffer.from(eventID, 'base64')
        if (buffer.length !== 16) {
            return null
        }
        return {
            seq: Number(buffer.readBigUInt64LE(8)),
            uid: Number(buffer.readBigUInt64LE(0))
        }
    }
}