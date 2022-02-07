# WebSocket 接口

S => C 事件推送

[TOC]

使用 json 作为协议最小包结构

## 通用包结构

```json
{
    "type": "msg|revoke|user|group",
    "data": {}
}
```

###### msg

新消息

###### event

新事件

## 消息包结构

```json
{
    "type": "msg",
    "data": {
        "type": "private|group",
    	"time": 0,
        "known": false,
        "channel": 0,
        "channel_name": "",
        "sender": 0,
        "sender_nick": "",
        "ref_channel": 0,
        "ref_channel_name": "",
        "msgID": 0,
        "msgContent": [],
        "msgString": "",
        "reply": {
            "to": 0,
            "time": 0,
            "summary": "",
            "id": ""
        }
    }
}
```

###### type

私聊或群聊

###### known

私聊是否为好友，群聊是否匿名

###### channel

私聊为对方，群聊为群号

###### channel_name

私聊为对方显示昵称，群聊为群名

###### sender

发送者

###### sender_nick

发送者的昵称

###### ref_channel

私聊若为陌生人则是来源群，或0，好友为0，群聊为0

###### ref_channel_name

私聊若为陌生人则是来源群名，或空串，好友为空串，群聊为空串

###### msgID

消息序列ID

###### msgContent

通用消息体结构

###### msgString

蜜汁规则生成的文本消息，可用于回复引用

###### reply

存在时该消息为回复消息

`to`回复给

`summary`显示的引用文本

`id`消息id

## 撤回消息包结构

```json
{
    "type": "revoke",
    "data": {
        "type": "private|group",
    	"time": 0,
        "revoker": 0,
        "channel": 0,
        "known": true,
        "msgID": 0
    }
}
```

###### revoker

撤回者，私聊时永远是对方

###### channel

私聊好友为0，私聊陌生人为对方来源群号，群聊则为群号。若未查询到陌生人来源群聊则返回-1

###### known

私聊为对方是否好友，群聊为撤回者是否匿名

## 用户事件包结构

共享如下包结构

```json
{
    "type": "user",
    "data": {
        "type": "...",
        "...": "..."
    }
}
```

### 上线、下线事件

```json
{
    "type": "user",
    "data": {
        "type": "online|offline"
    }
}
```

### 新好友请求

```json
{
    "type": "user",
    "data": {
        "type": "newFriendRequest",
        "who": 0,
        "nick": "",
        "source": "",
        "comment": "...",
        "eventID": ""
    }
}
```

###### requester

请求者

###### source

来源信息

###### comment

备注信息

###### eventID

事件ID，需在事件响应请求中携带

### 入群邀请

```json
{
    "type": "user",
    "data": {
        "type": "groupInvite",
        "group": 0,
        "groupName": "",
        "inviter": 0,
        "eventID": ""
    }
}
```

### 好友变动

```json
{
    "type": "user",
    "data": {
        "type": "friendAdded",
        "who": 0,
        "nick": ""
    }
}
```

```json
{
    "type": "user",
    "data": {
        "type": "friendRemoved",
        "who": 0,
        "nick": ""
    }
}
```

### 群变动

```json
{
    "type": "user",
    "data": {
        "type": "groupJoined",
        "name": "",
        "which": 0
    }
}
```

```json
{
    "type": "user",
    "data": {
        "type": "groupLeft",
        "which": 0,
        "name": "",
        "operator": 0
    }
}
```

###### operator

执行操作的用户，主动退群时为0，否则为被群管T

## 群事件包结构

共享如下包结构

```json
{
    "type": "group",
    "data": {
        "type": "...",
        "...": "..."
    }
}
```

### 申请入群

```json
{
    "type": "group",
    "data": {
        "type": "joinRequest",
        "who": 0,
        "group": 0,
        "comment": "",
        "inviter": 0,
        "eventID", ""
    }
}
```

### 群禁言

```json
{
    "type": "group",
    "data": {
        "type": "mute",
        "who": 0,
        "group": 0,
        "operator": 0,
        "duration": 0
    }
}
```

###### who

被禁言者，0代表整群

###### duration

0意味着解除禁言。单位：秒

### 群管理变更

```json
{
    "type": "group",
    "data": {
        "type": "admin",
        "who": 0,
        "group": 0,
        "status": true
    }
}
```

### 群转让

不做了

### 群员变动

```json
{
    "type": "group",
    "data": {
        "type": "memberJoined",
        "who": 0,
        "nick": "",
        "group": 0,
        "group_name": ""
    }
}
```

```json
{
    "type": "group",
    "data": {
        "type": "memberLeft",
        "who": 0,
        "nick": "",
        "group": 0,
        "group_name": "",
        "operator": 0
    }
}
```

###### operator

执行操作的用户，主动退群时为0，否则为被群管T

###### nick

群员减少时无该字段

