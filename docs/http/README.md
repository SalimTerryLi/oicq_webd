# HTTP 接口

包含 C => S 的同步请求。处理并返回。

[TOC]

## 通用请求

**Method**: `POST`

**Content-Type**: `application/json`

## 通用响应

**Content-Type**: `application/json`

```json
{
    "status": {
        "code": 0
    }
}
```

## 功能接口

### 消息发送

#### 私聊消息

**URL**: `sendMsg/private`

##### 请求包

```json
{
    "dest": 0,
    "from": 0,
    "msgContent": [],
    "reply": {
        "to": 0,
        "time": 0,
        "id": "",
        "summary": ""
    }
}
```

###### from

可选，如果不是好友，则使用该属性指定经由哪个群发送私戳

###### reply

可选，是否为回复引用消息

`time`可选，自定义时间

`to`必选，自定义回复对象

`summary`必选，自定义总结被回复的内容

填入非真实`to`信息会导致回复消息无法定位

##### 响应参数

```json
{
    "status": {
        "code": 0
    },
    "msgID": ""
}
```

#### 群消息

**URL**: `sendMsg/group`

##### 请求包

```json
{
    "dest": 0,
    "msgContent": [],
    "reply": {
        "to": 0,
        "time": 0,
        "id": "",
        "summary": ""
    }
}
```

###### reply

同上

##### 响应参数

```json
{
    "status": {
        "code": 0
    },
    "msgID": ""
}
```

### 消息撤回

#### 私聊撤回

**URL**: `revoke/private`

```json
{
    "channel": 0,
    "msgID": ""
}
```

#### 群撤回

**URL**: `revoke/group`

```json
{
    "channel": 0,
    "msgID": ""
}
```

### 用户管理

#### 处理好友申请

**URL**: `user/acceptFriend`

```json
{
    "who": 0,
    "accept": true
}
```

#### 添加好友

#### 处理群邀请

**URL**: `user/acceptGroupInvite`

```json
{
    "group": 0,
    "accept": true
}
```

#### 退群

**URL**: `user/leaveGroup`

```json
{
    "group": 0
}
```

#### 获取好友列表

**URL**: `user/getFriendList`

**METHOD**: `GET`

无请求参数

##### 返回值

```json
{
    "status": {
        "code": 0
    },
    "list": [
        {
            "id": 0,
            "nickname": ""
        }
    ]
}
```

#### 获取群列表

**URL**: `user/getGroupList`

**METHOD**: `GET`

无请求参数

##### 返回值

```json
{
    "status": {
        "code": 0
    },
    "list": [
        {
            "id": 0,
            "name": ""
        }
    ]
}
```

### 群管理

#### 处理入群请求

**URL**: `group/acceptJoin`

```json
{
    "requester": 0,
    "group": 0,
    "accept": true
}
```

#### 设置群名

**URL**: `group/setGroupName`

```json
{
    "group": 0,
    "name": ""
}
```

#### 禁言

**URL**: `group/mute`

```json
{
    "group": 0,
    "target": 0,
    "duration": 0
}
```

###### target

0：全员

###### duration

秒

#### 踢人

**URL**: `group/kick`

```json
{
    "group": 0,
    "who": 0
}
```

#### 设置管理员

**URL**: `group/setAdmin`

```json
{
    "group": 0,
    "who": 0,
    "set": true
}
```

#### 邀请入群

**URL**: `group/invite`

```json
{
    "group": 0,
    "who": 0
}
```

#### 解散群聊

不做了

#### 获取群员列表

**URL**: `group/getMemberList?group=0`

**METHOD**: `GET`

##### 请求参数

###### group

整形，必选

##### 返回值

```json
{
    "status": {
        "code": 0
    },
    "list": [
        {
            "id": 0,
            "nickname": "",
            "alias": ""
        }
    ]
}
```

#### 获取群员信息

**URL**: `group/getMemberDetail?group=0&member=0`

**METHOD**: `GET`

##### 请求参数

###### group

整形，必选

###### member

整形，必选

##### 返回值

```json
{
    "status": {
        "code": 0
    },
    "info": {
        "join_time": 0,
        "last_active_time": 0,
        "tag": "",
        "isOwner": false,
        "isAdmin": false
    }
}
```

### 消息后处理

#### 解析转发消息

**URL**: `mesg/parseForwardedMsg?id="xxx"`

**METHOD**: `GET`

##### 请求参数

###### id

收到的转发消息ID

##### 返回值

```json
{
    "status": {
        "code": 0
    },
    "msgs": [
        {
            "id": 0,
            "time": 0,
            "nickname": "",
            "msgContent": []
        }
    ]
}
```

#### 制作转发消息

**URL**: `mesg/genForwardedMsg`

**METHOD**: `POST`

##### 请求参数

```json
{
    "msgs": [
        {
            "id": 0,
            "nickname": "",
            "time": 0,
            "msgContent": []
        }
    ]
}
```

###### nickname

显示的名字，可选

###### time

时间戳，UTC秒，可选

##### 响应参数

```json
{
    "status": {
        "code": 0
    },
    "id": "xxx"
}
```

###### id

生成的转发消息ID

#### 查询原始消息

**URL**: `mesg/queryMsg`

**METHOD**: `GET`

##### 请求参数

###### type

`private`或`group`

###### id

消息ID（msgID）

###### channel

QQ号或群号

##### 响应参数

同消息包结构：

```json
{
    "status": {
        "code": 0
    },
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
            "summary": "",
            "id": ""
        }
	}
}
```

未查询到则状态码为`-1`且无`data`字段
