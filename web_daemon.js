"use strict"

/*
Parse HTTP requests and perform action on oicq bot
 */

const pkgInfo = require("./package.json");
const {parseString: parseXML} = require("xml2js");

function build_http_response(status_code, fields) {
    return {
        status: {
            code: status_code
        },
        ...fields
    }
}

async function parse_forwardedmsg_from_id_as_xml(bot, id) {
    let forwardmsg = await bot.pickUser(bot.uin).getForwardMsg(id).catch(e => {
        return null
    })
    if (forwardmsg === null) {
        return null
    }
    let xmlmsg = await bot.pickUser(bot.uin).makeForwardMsg(forwardmsg).catch(e => {
        return null
    })
    if (xmlmsg === null) {
        return null
    }
    return xmlmsg
}

const msg_utils = require('./utils').msg_utils
const msgid_utils = require('./utils').msgid_utils
const eventid_utils = require('./utils').eventid_utils
const delay = require('./utils').delay

exports.create_web_daemon = (httpserver, push_server, bot, msgdb, logger) => {
    // protocol fingerprint
    httpserver.get('/', async (req, res) => {
        res.json({
            name: pkgInfo.name,
            version: pkgInfo.version
        })
    })

    httpserver.post('/sendMsg/private', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('dest' in req.body && 'msgContent' in req.body)) {
            res.sendStatus(400)
            return
        }

        // parse message segments
        const segments = await msg_utils.async_convert_msgContent_to_oicq_seg(req.body.msgContent,
            async (id) => {return await parse_forwardedmsg_from_id_as_xml(bot, id)})
        if (segments === null) {
            res.json(build_http_response(-1))
            return
        }
        // parse reply info if exist
        let reply_info
        if ("reply" in req.body && req.body.reply !== null) {
            const msgid = msgid_utils.convert_msgid_to_seq(req.body.reply.id)
            reply_info = {
                user_id: req.body.reply.to,
                time: "time" in req.body.reply? req.body.reply.time: msgid.time,
                seq: msgid.seq,
                rand: msgid.rand,
                message: req.body.reply.summary
            }
        }
        // find sender
        let dest
        if ("from" in req.body) {
            dest = bot.pickGroup(req.body.from).pickMember(req.body.dest)
        } else {
            dest = bot.pickUser(req.body.dest)
        }
        let result
        try {
            result = await dest.sendMsg(segments, reply_info)
        } catch (e) {
            res.json(build_http_response(-2))
            logger.error('Failed to send private message to ' + dest.uid)
            logger.error(e)
            return
        }
        res.json(build_http_response(0, {
            msgID: msgid_utils.convert_seq_to_msgid(result.seq, result.rand, result.time)
        }))

        // patch message history manually, as bot doesn't receive self sent message in private channels
        let retry_count = 5
        while (retry_count > 0) {
            --retry_count
            await delay(1000)
            let sent_msg
            try {
                sent_msg = await dest.getChatHistory(result.time, 5)
            } catch (e) {
                logger.error('Failed to get chat history:')
                logger.error(e)
                continue
            }
            // reverse iterator through msgs
            for (let i = sent_msg.length - 1; i >=0; ++i) {
                if (sent_msg[i].time === result.time && sent_msg[i].seq === result.seq && sent_msg[i].rand === result.rand) {
                    const msg = await msg_utils.async_convert_private_message_event(sent_msg[i], bot)
                    msgdb.save_msg_history(msg)
                    return
                }
            }
        }
        logger.error('Failed to fetch and store private message to ' + dest.uid)
    })

    httpserver.post('/sendMsg/group', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('dest' in req.body && 'msgContent' in req.body)) {
            res.sendStatus(400)
            return
        }

        // parse message segments
        const segments = await msg_utils.async_convert_msgContent_to_oicq_seg(req.body.msgContent,
            async (id) => {return await parse_forwardedmsg_from_id_as_xml(bot, id)})
        if (segments === null) {
            res.json(build_http_response(-1))
            return
        }
        // parse reply info if exist
        let reply_info
        if ("reply" in req.body && req.body.reply !== null) {
            const msgid = msgid_utils.convert_msgid_to_seq(req.body.reply.id)
            reply_info = {
                user_id: req.body.reply.to,
                time: "time" in req.body.reply? req.body.reply.time: msgid.time,
                seq: msgid.seq,
                rand: msgid.rand,
                message: req.body.reply.summary
            }
        }

        let result
        try {
            result = await bot.pickGroup(req.body.dest).sendMsg(segments, reply_info)
        } catch (e) {
            res.json(build_http_response(-2))
            logger.error('Failed to send group message to ' + req.body.dest)
            logger.error(e)
            return
        }
        res.json(build_http_response(0, {
            msgID: msgid_utils.convert_seq_to_msgid(result.seq, result.rand, result.time)
        }))
    })

    httpserver.post('/revoke/private', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('msgID' in req.body && 'channel' in req.body)) {
            res.sendStatus(400)
            return
        }

        const msgID = msgid_utils.convert_msgid_to_seq(req.body.msgID)
        bot.pickUser(req.body.channel).recallMsg(msgID.seq, msgID.rand, msgID.time).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/revoke/group', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('msgID' in req.body && 'channel' in req.body)) {
            res.sendStatus(400)
            return
        }

        const msgID = msgid_utils.convert_msgid_to_seq(req.body.msgID)
        bot.pickGroup(req.body.channel).recallMsg(msgID.seq, msgID.rand).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/user/acceptFriend', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('who' in req.body && 'eventID' in req.body && 'accept' in req.body)) {
            res.sendStatus(400)
            return
        }

        bot.pickUser(req.body.who).setFriendReq(eventid_utils.parse_friend_req_id(req.body.eventID), req.body.accept).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-2))
        })
    })

    httpserver.post('/user/acceptGroupInvite', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('who' in req.body && 'eventID' in req.body && 'accept' in req.body)) {
            res.sendStatus(400)
            return
        }

        const invitation = eventid_utils.parse_group_invite_id(req.body.eventID)
        bot.pickUser(req.body.who).setGroupInvite(invitation.gid, invitation.seq, req.body.accept).then(r => {
            console.log({
                setGroupInvite: {
                    accept: req.body.accept,
                    r: r
                }
            })
            res.json(build_http_response(0))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/user/leaveGroup', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body)) {
            res.sendStatus(400)
            return
        }

        let group
        try {
            group = bot.pickGroup(req.body.group, true)
        } catch {
            res.json(build_http_response(-2))
            return
        }

        group.quit().then(r => {
            if (r) {
                res.json(build_http_response(0))
                push_server.deliver_data(JSON.stringify({
                    "type": "user",
                    "data": {
                        "type": "groupLeft",
                        "which": req.body.group,
                        "name": group.name,
                        "operator": bot.uin
                    }
                }))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/group/acceptJoin', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'eventID' in req.body && 'accept' in req.body)) {
            res.sendStatus(400)
            return
        }

        const request = eventid_utils.parse_group_join_req_id(req.body.eventID)
        bot.pickUser(request.uid).setGroupReq(req.body.group, request.seq, req.body.accept, "", false).then(r => {
            console.log(r)
            res.json(build_http_response(0))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/group/setGroupName', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'name' in req.body)) {
            res.sendStatus(400)
            return
        }

        bot.pickGroup(req.body.group).setName(req.body.name).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/group/mute', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'target' in req.body && 'duration' in req.body)) {
            res.sendStatus(400)
            return
        }

        if (req.body.target === 0) {
            bot.pickGroup(req.body.group).muteAll(req.body.duration !== 0).then(r => {
                res.json(build_http_response(0))
            }).catch(e => {
                console.log(e)
                res.json(build_http_response(-1))
            })
        } else {
            bot.pickGroup(req.body.group).muteMember(req.body.target, req.body.duration).then(r => {
                res.json(build_http_response(0))
            }).catch(e => {
                console.log(e)
                res.json(build_http_response(-1))
            })
        }
    })

    httpserver.post('/group/kick', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'who' in req.body)) {
            res.sendStatus(400)
            return
        }

        bot.pickGroup(req.body.group).kickMember(req.body.who, false).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/group/setAdmin', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'who' in req.body && 'set' in req.body)) {
            res.sendStatus(400)
            return
        }

        bot.pickGroup(req.body.group).setAdmin(req.body.who, req.body.set).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/group/invite', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('group' in req.body && 'who' in req.body)) {
            res.sendStatus(400)
            return
        }

        bot.pickGroup(req.body.group).invite(req.body.who).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.get('/user/getFriendList', async (req, res) => {
        let friendlist = []
        for (const f of bot.fl.entries()) {
            friendlist.push({
                "id": f[1].user_id,
                "nickname": f[1].nickname
            })
        }
        res.json(build_http_response(0, {"list": friendlist}))
    })

    httpserver.get('/user/getGroupList', async (req, res) => {
        let grouplist = []
        for (const f of bot.gl.entries()) {
            grouplist.push({
                "id": f[1].group_id,
                "name": f[1].group_name
            })
        }
        res.json(build_http_response(0, {"list": grouplist}))
    })

    httpserver.get('/group/getMemberList', async (req, res) => {
        if (!('group' in req.query)) {
            res.sendStatus(400)
            return
        }
        bot.pickGroup(req.query["group"]).getMemberMap().then(r => {
            let memberlist = []
            for (const m of r.entries()) {
                const mo = m[1]
                memberlist.push({
                    "id": mo.user_id,
                    "nickname": mo.nickname,
                    "alias": mo.card
                })
            }
            res.json(build_http_response(0, {"list": memberlist}))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.get('/user/getMemberDetail', async (req, res) => {
        if (!('group' in req.query && 'member' in req.query)) {
            res.sendStatus(400)
            return
        }
        bot.pickGroup(req.query["group"]).getMemberMap().then(r => {
            r = r.get(Number.parseInt(req.query["member"]))
            res.json(build_http_response(0, {"info": {
                    "join_time": r.join_time,
                    "last_active_time": r.last_sent_time,
                    "tag": r.card,
                    "isOwner": r.role === "owner",
                    "isAdmin": r.role === "owner" || r.role === "admin"
                }}))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.get('/user/basicInfo', async (req, res) => {
        const info = await bot.pickUser(bot.uin).getSimpleInfo()
        res.json(build_http_response(0, {"basic": {
                'id': info.user_id,
                'nickname': info.nickname,
            }}))
    })

    httpserver.get('/mesg/parseForwardedMsg', async (req, res) => {
        if (!('id' in req.query)) {
            res.sendStatus(400)
            return
        }
        bot.pickUser(bot.uin).getForwardMsg(req.query["id"]).then(async r => {
            let parsedMsgs = []
            for (const msg of r) {
                parsedMsgs.push({
                    "id": msg.user_id,
                    "time": msg.time,
                    "nickname": msg.nickname,
                    "msgContent": await msg_utils.async_convert_oicq_message_to_msgContent(msg.message)
                })
            }
            res.json(build_http_response(0, {"msgs": parsedMsgs}))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-1))
        })
    })

    httpserver.post('/mesg/genForwardedMsg', async (req, res) => {
        if (req.header('content-type') === undefined || !req.header('content-type').includes('application/json')) {
            res.sendStatus(415)
            return
        }
        // ensure properties
        if (!('msgs' in req.body)) {
            res.sendStatus(400)
            return
        }

        let oicq_forwardable =[]
        for (const msg of req.body.msgs) {
            const converted_msg_content = await msg_utils.async_convert_msgContent_to_oicq_seg(msg.msgContent,
                async (id) => {return await parse_forwardedmsg_from_id_as_xml(bot, id)})
            if (converted_msg_content === null) {
                res.json(build_http_response(-1))
                return
            }
            oicq_forwardable.push({
                user_id: msg.id,
                message: converted_msg_content,
                nickname: 'nickname' in msg? msg.nickname: null,
                time: 'nickname' in msg? msg.time: null,
            })
        }
        bot.pickUser(bot.uin).makeForwardMsg(oicq_forwardable).then(r => {
            let parsedObj = null
            parseXML(r.data, {async: false}, function (err, result) {
                if (result !== undefined) {
                    parsedObj = result
                }
            });
            if (parsedObj !== null) {
                if (parsedObj['msg']['$'].action === "viewMultiMsg") {
                    // forwarded mesg
                    res.json(build_http_response(0, {"id": parsedObj['msg']['$'].m_resid}))
                }
            } else {
                console.error("failed to get generated forwarded msg ID")
                res.json(build_http_response(-3))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-2))
        })

    })

    httpserver.get('/mesg/queryMsg', async (req, res) => {
        if (!('type' in req.query && 'id' in req.query && 'channel' in req.query)) {
            res.sendStatus(400)
            return
        }

        const result = msgdb.query_msg_history(req.query["type"], req.query["channel"], req.query["id"])
        if (result !== null) {
            res.json(build_http_response(0, {"data": result}))
        } else {
            res.json(build_http_response(-1))
        }
    })
}