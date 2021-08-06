"use strict"

const bot = require("../middleware").botClient

const convert_oicq_message_to_msgContent = require("./utils").convert_oicq_message_to_msgContent
const deliver_event = require("./webapi").deliver_event

const bot_storage = require("./utils").bot_storage

// 私聊消息
bot.on("message.private", e => {
    deliver_event({
        type: "msg",
        data: {
            "type": "private",
            "time": e.time,
            "known": e.subtype === "friend",
            "channel": e.subtype === "group" ? e.sender.group_id : 0,
            "sender": e.from_id,
            "msgID": e.message_id,
            "msgContent": convert_oicq_message_to_msgContent(e.message)
        }
    })
})

// 群聊消息
bot.on("message.group", e => {
    deliver_event({
        type: "msg",
        data: {
            "type": "group",
            "time": e.time,
            "known": e.anonymous === null,
            "channel": e.group_id,
            "sender": e.anonymous === null ? e.user_id : e.anonymous.id,
            "msgID": e.message_id,
            "msgContent": convert_oicq_message_to_msgContent(e.message)
        }
    })
})

// 私聊撤回
bot.on("notice.friend.recall", e => {
    deliver_event({
        type: "revoke",
        data: {
            "type": "private",
            "channel": e.user_id,
            "revoker": e.operator_id,
            "revokee": e.user_id,
            "msgID": e.message_id
        }
    })
})

// 群聊撤回
bot.on("notice.group.recall", e => {
    deliver_event({
        type: "revoke",
        data: {
            "type": "group",
            "channel": e.group_id,
            "revoker": e.operator_id,
            "revokee": e.user_id,
            "msgID": e.msgID
        }
    })
})

// 上线事件
bot.on("system.online", e => {
    deliver_event({
        type: "user",
        data: {
            "type": "online"
        }
    })
})

// 掉线事件
bot.on("system.offline", e => {
    deliver_event({
        type: "user",
        data: {
            "type": "offline"
        }
    })
})

// 好友申请
bot.on("request.friend", e => {
    bot_storage.friend_reqs[e.user_id] = e.seq
    deliver_event({
        "type": "user",
        "data": {
            "type": "newFriendRequest",
            "who": e.user_id,
            "nick": e.nickname,
            "source": e.source,
            "comment": e.comment
        }
    })
})

// 好友增加
bot.on("notice.friend.increase", e => {
    deliver_event({
        "type": "user",
        "data": {
            "type": "friendAdded",
            "who": e.user_id,
            "nick": e.nickname
        }
    })
})

// 好友减少
bot.on("notice.friend.decrease", e => {
    deliver_event({
        "type": "user",
        "data": {
            "type": "friendRemoved",
            "who": e.user_id,
            "nick": e.nickname
        }
    })
})

// 邀请入群
bot.on("request.group.invite", e => {
    if (! (e.group_id in bot_storage.group_invites)) {
        bot_storage.group_invites[e.group_id] = []
    }
    let found_exist = false
    for (const invitation of bot_storage.group_invites[e.group_id]) {
        if (invitation.inviter === e.user_id) {
            invitation.seq = e.seq
            found_exist = true
            break
        }
    }
    if (! found_exist) {
        bot_storage.group_invites[e.group_id].push({
            inviter: e.user_id,
            seq: e.seq
        })
    }
    deliver_event({
        "type": "user",
        "data": {
            "type": "groupInvite",
            "group": e.group_id,
            "groupName": e.group_name,
            "inviter": e.user_id
        }
    })
})

// TODO: TEST
// 群增加、群员增加
bot.on("notice.group.increase", e => {
    console.log(e)
    if (e.user_id === bot.uin) {
        // Treat as user event: bot joined into a group
        deliver_event({
            "type": "user",
            "data": {
                "type": "groupJoined",
                "which": e.group_id
            }
        })
    } else {
        // Treat as group event: new group member
        deliver_event({
            "type": "group",
            "data": {
                "type": "memberJoined",
                "who": e.user_id,
                "group": e.group_id
            }
        })
    }
})

// TODO: TEST
// 群减少、群员减少
bot.on("notice.group.decrease", e => {
    console.log(e)
    if (e.user_id === bot.uin) {
        // Treat as user event: bot left a group
        deliver_event({
            "type": "user",
            "data": {
                "type": "groupLeft",
                "which": e.group_id,
                "operator": e.operator_id
            }
        })
    } else {
        // Treat as group event: group member left
        deliver_event({
            "type": "group",
            "data": {
                "type": "memberLeft",
                "who": e.user_id,
                "group": e.group_id,
                "operator": e.operator_id
            }
        })
    }
})

// 群管理：申请入群
bot.on("request.group.add", e => {
    bot_storage.group_join_reqs[e.group_id + "+" +  e.user_id] = e.seq
    deliver_event({
        "type": "group",
        "data": {
            "type": "joinRequest",
            "who": e.user_id,
            "nick": e.nickname,
            "group": e.group_id,
            "comment": e.comment,
            "inviter": e.inviter_id
        }
    })
})

// 群管理：群禁言
bot.on("notice.group.ban", e => {
    deliver_event({
        "type": "group",
        "data": {
            "type": "mute",
            "who": e.user_id,
            "group": e.group_id,
            "operator": e.operator_id,
            "duration": e.duration
        }
    })
})

// 群管理：管理员变更
bot.on("notice.group.admin", e => {
    deliver_event({
        "type": "group",
        "data": {
            "type": "admin",
            "who": e.user_id,
            "group": e.group_id,
            "status": e.set
        }
    })
})