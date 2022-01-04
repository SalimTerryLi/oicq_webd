# WebSocket 接口

S => C 事件推送

[TOC]

使用 json 作为协议最小包结构

## 通用包结构

```json
{
    "type": "msg|revoke|user|group",
    "time": 0,
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
        "known": false,
        "channel": 0,
        "sender": 0,
        "msgID": 0,
        "msgContent": [],
        "reply": {
            "to": 0,
            "time": 0,
            "text": "",
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

私聊若为陌生人则是来源群，或0，群聊为收到消息的群

###### sender

发送者

###### msgID

消息序列ID

###### msgContent

通用消息体结构

###### reply

存在时该消息为回复消息

`to`回复给

`text`显示的引用文本

`id`消息id

## 撤回消息包结构

```json
{
    "type": "revoke",
    "data": {
        "type": "private|group",
        "revoker": 0,
        "revokee": 0,
        "channel": 0,
        "msgID": 0
    }
}
```

###### revoker

撤回者

###### revokee

被撤回者

###### channel

撤回事件所在环境，私聊则为对方，群聊则为群

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
        "comment": "..."
    }
}
```

###### requester

请求者

###### source

来源信息

###### comment

备注信息

### 入群邀请

```json
{
    "type": "user",
    "data": {
        "type": "groupInvite",
        "group": 0,
        "groupName": "",
        "inviter": 0
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
        "operator": 0
    }
}
```

###### operator

执行操作的用户，自己或群管（主动或被T）

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
        "inviter": 0
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
        "group": 0
    }
}
```

```json
{
    "type": "group",
    "data": {
        "type": "memberLeft",
        "who": 0,
        "group": 0,
        "operator": 0
    }
}
```

###### operator

执行操作的用户，群员自己或群管（自己退群or被T）

