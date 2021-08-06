# API Document

[TOC]

## 接口功能划分

分为 HTTP 请求与 WebSocket 请求，两大块

### HTTP

参阅`http`文件夹

### WebSocket

参阅`ws`文件夹

## 通用消息体结构

这里定义了通用消息体结构。基于 json 容器

### 消息对象

```json
[
    {},
    {}
]
```

为一个有序数组，其中不同类型的元素按顺序组合在一起后构成一条消息的真正内容

### 消息元素类型

不同消息元素共享如下基本结构

```json
{
    "type": "xxx",
    "...": "..."
}
```

`type`字段可用于区分不同元素类型

`time`为消息时间戳，UTC秒，一般仅接收

以下为消息对象`data`字段下的所有可能类型

#### 文本

```json
{
    "type": "text",
    "text": "xxx"
}
```

#### 图片

```json
{
    "type": "image",
    "asEmoji": false,
    "url": "",
    "base64": ""
}
```

###### asEmoji

[仅接收] 图片是否为表情

###### url

接收的图片url或使用该url发送

###### base64

[仅发送] 使用base64发送本地图片

#### 表情

```json
{
    "type": "emoji",
    "id": 0,
    "replaceText": ""
}
```

###### replaceText

[仅接收] 替代文本

#### 提及

```json
{
    "type": "mention",
    "target": 0,
    "displayText": "@xxx"
}
```

###### displayText

[仅接收] 实际显示的文本

#### 转发的消息

通常情况下是消息对象的唯一字段

```json
{
    "type": "forwarded",
    "id": ""
}
```

拿到的id需要通过http请求解析成普通消息

需要发送转发消息也须通过http请求拿到id

#### XML

```json
{
    "type": "xml",
    "data": "<...>"
}
```

#### JSON

```json
{
    "type": "json",
    "data": "{}"
}
```