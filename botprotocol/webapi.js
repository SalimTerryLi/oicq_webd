"use strict"

const {convert_oicq_message_to_msgContent} = require("./utils");
const {parseString: parseXML} = require("xml2js");
const {Sendable} = require("oicq/lib/message/elements");
const listener = require("../middleware").webListener
const bot = require("../middleware").botClient

const bot_storage = require("./utils").bot_storage

let ws_sessions = []

listener.ws_listener.on('connection', socket => {
    ws_sessions.push(socket)
    console.log(`new ws client connected. currently ${ws_sessions.length} connections`)
    socket.onclose = () => {
        const index = ws_sessions.indexOf(socket);
        if (index > -1) {
            ws_sessions.splice(index, 1);
            console.log(`ws client disconnected. currently ${ws_sessions.length} connections`)
        } else {
            console.error("socket session not found")
        }
    }
    // ws incoming request (c2s)
    socket.on('message', message => {
        console.log(message)
    })
})

exports.deliver_event = (packed_msg) => {
    for (const so of ws_sessions) {
        so.send(JSON.stringify(packed_msg))
    }
}

// http requests

const build_http_response = require("./utils").build_http_response
const convert_msgContent_to_oicq = require("./utils").convert_msgContent_to_oicq

const msgid_utils = require('./utils').msgid_utils

listener.http_listener.post('/sendMsg/private', (req, res) => {
    convert_msgContent_to_oicq(req.body.msgContent).then(r => {
        let reply_info
        if ("reply" in req.body && req.body.reply !== null){
            const msgid = msgid_utils.convert_msgid_to_seq(req.body.reply.id)
            reply_info = {
                user_id: req.body.reply.to,
                time: "time" in req.body.reply? req.body.reply.time: msgid.time,
                seq: msgid.seq,
                rand: msgid.rand,
                message: req.body.reply.text
            }
        }
        let dest
        if ("from" in req.body) {
            dest = bot.pickGroup(req.body.from).pickMember(req.body.dest)
        } else {
            dest = bot.pickUser(req.body.dest)
        }
        dest.sendMsg(r, reply_info).then(r => {
            res.json(build_http_response(0, {
                msgID: msgid_utils.convert_seq_to_msgid(r.seq, r.rand, r.time)
            }))
        }).catch(r => {
            res.json(build_http_response(-2))
        })
    }).catch(e => {
        console.log(e)
        res.json(build_http_response(-1))
    })
})

listener.http_listener.post('/sendMsg/group', (req, res) => {
    convert_msgContent_to_oicq(req.body.msgContent).then(r => {
        let reply_info
        if ("reply" in req.body && req.body.reply !== null){
            const msgid = msgid_utils.convert_msgid_to_seq(req.body.reply.id)
            reply_info = {
                user_id: req.body.reply.to,
                time: "time" in req.body.reply? req.body.reply.time: msgid.time,
                seq: msgid.seq,
                rand: msgid.rand,
                message: req.body.reply.text
            }
        }
        bot.pickGroup(req.body.dest).sendMsg(r, reply_info).then(r => {
            res.json(build_http_response(0, {
                msgID: msgid_utils.convert_seq_to_msgid(r.seq, r.rand, r.time)
            }))
        }).catch(r => {
            res.json(build_http_response(-2))
        })
    }).catch(e => {
        console.log(e)
        res.json(build_http_response(-1))
    })
})

listener.http_listener.post('/revoke/private', (req, res) => {
    const msgID = msgid_utils.convert_msgid_to_seq(req.body.msgID)
    bot.pickUser(req.body.channel).recallMsg(msgID.seq, msgID.rand, msgID.time).then(r => {
        if (r) {
            res.json(build_http_response(0))
        } else {
            res.json(build_http_response(-1))
        }
    }).catch(e => {
        console.log(e)
        res.json(build_http_response(-1))
    })
})

// TODO: check pktnum
listener.http_listener.post('/revoke/group', (req, res) => {
    const msgID = msgid_utils.convert_msgid_to_seq(req.body.msgID)
    bot.pickGroup(req.body.channel).recallMsg(msgID.seq, msgID.rand).then(r => {
        if (r) {
            res.json(build_http_response(0))
        } else {
            res.json(build_http_response(-1))
        }
    }).catch(e => {
        console.log(e)
        res.json(build_http_response(-1))
    })
})

/** user mgnt API **/

listener.http_listener.post('/user/acceptFriend', (req, res) => {
    if (req.body.who in bot_storage.friend_reqs) {
        bot.pickUser(req.body.who).setFriendReq(bot_storage.friend_reqs[req.body.who], req.body.accept).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-2))
        })
        delete bot_storage.friend_reqs[req.body.who]
    } else {
        res.json(build_http_response(-1))
    }
})

listener.http_listener.post('/user/acceptGroupInvite', (req, res) => {
    if (req.body.group in bot_storage.group_invites) {
        // pick last one invitation and accept
        const invitation = bot_storage.group_invites[req.body.group].pop()
        bot.pickUser(invitation).setGroupInvite(req.body.group, invitation.seq, req.body.accept).then(r => {
            if (r) {
                res.json(build_http_response(0))
            } else {
                res.json(build_http_response(-2))
            }
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-2))
        })
        delete bot_storage.group_invites[req.body.group]
    } else {
        res.json(build_http_response(-1))
    }
})

listener.http_listener.post('/user/leaveGroup', (req, res) => {
    bot.pickGroup(req.body.group).quit().then(r => {
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

/** group mgnt API **/

listener.http_listener.post('/group/acceptJoin', (req, res) => {
    if (req.body.group + "+" + req.body.requester in bot_storage.group_join_reqs) {
        bot.pickUser(req.body.requester).setGroupReq(req.body.group, bot_storage.group_join_reqs[req.body.group + "+" + req.body.requester], req.body.accept, "", false).then(r => {
            console.log(r)
            res.json(build_http_response(0))
        }).catch(e => {
            console.log(e)
            res.json(build_http_response(-2))
        })
        delete bot_storage.group_join_reqs[req.body.group + "+" + req.body.requester]
    } else {
        res.json(build_http_response(-1))
    }
})

listener.http_listener.post('/group/setGroupName', (req, res) => {
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

listener.http_listener.post('/group/mute', (req, res) => {
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

listener.http_listener.post('/group/kick', (req, res) => {
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

listener.http_listener.post('/group/setAdmin', (req, res) => {
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

listener.http_listener.post('/group/invite', (req, res) => {
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

listener.http_listener.get('/user/getFriendList', (req, res) => {
    let friendlist = []
    for (const f of bot.fl.entries()) {
        friendlist.push({
            "id": f[1].user_id,
            "nickname": f[1].nickname
        })
    }
    res.json(build_http_response(0, {"list": friendlist}))
})

listener.http_listener.get('/user/getGroupList', (req, res) => {
    let grouplist = []
    for (const f of bot.gl.entries()) {
        grouplist.push({
            "id": f[1].group_id,
            "name": f[1].group_name
        })
    }
    res.json(build_http_response(0, {"list": grouplist}))
})

listener.http_listener.get('/user/getMemberList', (req, res) => {
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

listener.http_listener.get('/user/getMemberDetail', (req, res) => {
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

/** misc API **/

listener.http_listener.get('/misc/parseForwardedMsg', (req, res) => {
    bot.pickUser(bot.uin).getForwardMsg(req.query["id"]).then(r => {
        let parsedMsgs = []
        for (const msg of r) {
            parsedMsgs.push({
                "id": msg.user_id,
                "time": msg.time,
                "nickname": msg.nickname,
                "msgContent": convert_oicq_message_to_msgContent(msg.message)
            })
        }
        res.json(build_http_response(0, {"msgs": parsedMsgs}))
    }).catch(e => {
        console.log(e)
        res.json(build_http_response(-1))
    })
})

const convert_forward_msgs_to_oicq = require("./utils").convert_forward_msgs_to_oicq

listener.http_listener.post('/misc/genForwardedMsg', (req, res) => {
    convert_forward_msgs_to_oicq(req.body.msgs).then(r => {
        bot.pickUser(bot.uin).makeForwardMsg(r).then(r => {
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
    }).catch(e => {
        console.error(e)
        res.json(build_http_response(-1))
    })
})