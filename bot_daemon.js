"use strict"

/*
Handle events from oicq bot and deliver them to ws client
 */

const msgid_utils = require('./utils').msgid_utils
const msg_utils = require('./utils').msg_utils
const eventid_utils = require('./utils').eventid_utils

exports.create_bot_daemon = (push_server, bot, msgdb) => {
    // 私聊消息
    bot.on("message.private", async (e) => {
        const event_pack = {
            type: "msg",
            data: await msg_utils.async_convert_private_message_event(e, bot)
        }
        push_server.deliver_data(JSON.stringify(event_pack))
        msgdb.save_msg_history(event_pack.data)
    })

    // 群聊消息
    bot.on("message.group", async (e) => {
        const event_pack = {
            type: "msg",
            data: await msg_utils.async_convert_group_message_event(e)
        }
        msgdb.save_msg_history(event_pack.data)
        if (e.user_id === bot.uin) {return}
        push_server.deliver_data(JSON.stringify(event_pack))
    })

    // 私聊撤回
    bot.on("notice.friend.recall", async (e) => {
        const known = bot.fl.has(e.user_id)
        push_server.deliver_data(JSON.stringify({
            type: "revoke",
            data: {
                "type": "private",
                "time": e.time,
                "channel": known? 0: msgdb.query_channel_of_stranger(e.user_id),
                "revoker": e.operator_id,
                "known": known,
                "msgID": msgid_utils.convert_seq_to_msgid(e.seq, e.rand, e.time)
            }
        }))
    })

    // 群聊撤回
    bot.on("notice.group.recall", async (e) => {
        push_server.deliver_data(JSON.stringify({
            type: "revoke",
            data: {
                "type": "group",
                "time": e.time,
                "channel": e.group_id,
                "revoker": e.operator_id,
                "known": (await e.group.getMemberMap()).has(e.operator_id),
                "msgID": msgid_utils.convert_seq_to_msgid(e.seq, e.rand, e.time)
            }
        }))
    })

    // 上线事件
    bot.on("system.online", async (e) => {
        push_server.deliver_data(JSON.stringify({
            type: "user",
            data: {
                "type": "online"
            }
        }))
    })

    // 掉线事件
    bot.on("system.offline", async (e) => {
        push_server.deliver_data(JSON.stringify({
            type: "user",
            data: {
                "type": "offline"
            }
        }))
    })

    // 好友申请
    bot.on("request.friend", async (e) => {
        let src = 0
        if (e.source.indexOf('QQ群-') !== -1) {
            const grp_name = e.source.substring(4)
            for (const group of bot.gl.entries()){
                if (group[1].group_name === grp_name) {
                    if (src !== 0) {
                        console.error('WARNING: Group Name collision, not able to detect new friend source')
                        src = 0
                        break
                    }
                    src = group[1].group_id
                }
            }
        } else if(e.source.indexOf('QQ号查找') !== -1){
        } else {
            console.error('unhandled request.friend.source: ' + e.source)
        }
        push_server.deliver_data(JSON.stringify({
            "type": "user",
            "data": {
                "type": "newFriendRequest",
                "who": e.user_id,
                "nick": e.nickname,
                "source": src,
                "comment": e.comment,
                "eventID": eventid_utils.gen_friend_req_id(e.seq, e.user_id)
            }
        }))
    })

    // 好友增加
    bot.on("notice.friend.increase", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "user",
            "data": {
                "type": "friendAdded",
                "who": e.user_id,
                "nick": e.nickname
            }
        }))
    })

    // 好友减少
    bot.on("notice.friend.decrease", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "user",
            "data": {
                "type": "friendRemoved",
                "who": e.user_id,
                "nick": e.nickname
            }
        }))
    })

    // 邀请入群
    bot.on("request.group.invite", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "user",
            "data": {
                "type": "groupInvite",
                "group": e.group_id,
                "groupName": e.group_name,
                "inviter": e.user_id,
                "eventID": eventid_utils.gen_group_invite_id(e.seq, e.group_id)
            }
        }))
    })

    // 群增加、群员增加
    bot.on("notice.group.increase", async (e) => {
        if (e.user_id === bot.uin) {
            // Treat as user event: bot joined into a group
            push_server.deliver_data(JSON.stringify({
                "type": "user",
                "data": {
                    "type": "groupJoined",
                    "which": e.group_id,
                    "name": e.group.name,
                }
            }))
        } else {
            // Treat as group event: new group member
            let new_member = e.group.pickMember(e.user_id).info
            if (new_member === undefined) {
                await e.group.pickMember(e.user_id).renew()
                new_member = e.group.pickMember(e.user_id).info
            }
            push_server.deliver_data(JSON.stringify({
                "type": "group",
                "data": {
                    "type": "memberJoined",
                    "who": e.user_id,
                    "nick": new_member.card === ''? new_member.nickname: new_member.card,
                    "group": e.group_id,
                    "group_name": e.group.name,
                }
            }))
        }
    })

    // 群减少、群员减少
    bot.on("notice.group.decrease", async (e) => {
        if (e.user_id === bot.uin) {
            // Treat as user event: bot left a group
            push_server.deliver_data(JSON.stringify({
                "type": "user",
                "data": {
                    "type": "groupLeft",
                    "which": e.group_id,
                    "name": e.group.name,
                    "operator": e.operator_id === bot.uin? 0: e.operator_id
                }
            }))
        } else {
            // Treat as group event: group member left
            push_server.deliver_data(JSON.stringify({
                "type": "group",
                "data": {
                    "type": "memberLeft",
                    "who": e.user_id,
                    "group": e.group_id,
                    "group_name": e.group.name,
                    "operator": e.operator_id === e.user_id? 0: e.operator_id
                }
            }))
        }
    })

    // 群管理：申请入群
    bot.on("request.group.add", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "group",
            "data": {
                "type": "joinRequest",
                "who": e.user_id,
                "nick": e.nickname,
                "group": e.group_id,
                "comment": e.comment,
                "inviter": e.inviter_id,
                "eventID": eventid_utils.gen_group_join_req_id(e.seq, e.user_id)
            }
        }))
    })

    // 群管理：群禁言
    bot.on("notice.group.ban", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "group",
            "data": {
                "type": "mute",
                "who": e.user_id,
                "group": e.group_id,
                "operator": e.operator_id,
                "duration": e.duration
            }
        }))
    })

    // 群管理：管理员变更
    bot.on("notice.group.admin", async (e) => {
        push_server.deliver_data(JSON.stringify({
            "type": "group",
            "data": {
                "type": "admin",
                "who": e.user_id,
                "group": e.group_id,
                "status": e.set
            }
        }))
    })
}