# oicq WebSocket/http API



---

**Usage:**

1. 安装 [Node.js](https://nodejs.org/) 14以上版本  
2. clone到本地并执行 `npm i` 安装依赖
3. 将 index.js 第二行 `const account = 0` 中的0改为你自己的账号
4. 执行 `npm run dev` 启动程序

---

## Message Format

### Received Format

#### msgContent

An array of types:

- text -- 普通文本
- image -- 图片或图片表情
- mention -- @某人
- emoji -- emoji

将所有textMsg拼接可得到纯文本消息

###### text

```json
{
  "type": "text",
  "text": ""
}
```

###### image

```json
{
  "type": "image",
  "asEmoji": false,
  "url": "",
  "base64": ""
}
```

asEmoji 仅接收

base64 仅发送

优先 base64 其次 url

###### at

```json
{
  "type": "mention",
  "target": 0,
  "displayText": "@xxx"
}
```

displayText 仅接收

AT全体时target为0

###### emoji

```json
{
  "type": "emoji",
  "id": 0,
  "replaceText": ""
}
```

replaceText 仅接收

## WebSocket Server => Client Deliver

#### base Event Structure

```json
{
  "type": "msgEvent|revokeEvent|friendEvent|groupEvent",
  "data": {}
}
```

###### msgEvent

群消息、私聊消息

###### revokeEvent

撤回消息

###### friendEvent

好友增加、好友减少

###### groupEvent

群员增加、群员减少、群禁言、群管理变更、群转让

#### msgEvent Event Structure

```json
{
  "type": "private|group",
  "known": false,
  "sender": 0,
  "receiver": 0,
  "msgID": 0,
  "msgContent": "xxxx"
}
```

###### known

私聊是否为好友，群聊是否匿名

###### sender

通常是消息产生方

###### receiver

私聊消息为接收qq，群消息为群号

#### revokeEvent Event Structure

```json
{
  "type": "private|group",
  "revoker": 0,
  "revokee": 0,
  "channel": 0,
  "msgID": 0
}
```

###### revoker

撤回者

###### revokee

被撤回者

###### channel

撤回的消息的原始目标

#### sysEvent Event Structure

```json
{
  "type": "result|event",
  "data": {}
}
```

##### result

上一条sys请求的执行结果。data结构体如下

```json
{
  "value": 0
}
```

##### event

全局事件推送

###### sysEvent.data Structure

```json
{
  "type": "online"
}
```

```json
{
  "type": "offline"
}
```

TODO

```json
{
  "type": "newFriend"
}
```

```json
{
  "type": "groupInvite"
}
```

```json
{
  "type": "requestJoin"
}
```

#### friendEvent Event Structure

```json

```

TODO

#### groupEvent Event Structure

```json

```

TODO

---

## WebSocket Client => Server Request

#### base Request Structure

```json
{
  "type": "msg|revoke|sys",
  "data": {}
}
```

#### msg Request Structure

```json
{
  "type": "private|group",
  "target": 0,
  "msgContent": []
}
```

#### revoke Request Structure

```json
{
  "type": "private|group",
  "channel": 0,
  "msgID": 0
}
```

#### sys Request Structure

###### Request Management

申请接管全局请求：好友审批、邀请加群、批准加群请求

申请全局事件：bot掉线、上线

```json
{
  "type": "reqMgnt"
}
```

## HTTP Request

