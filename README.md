# README

WIP

Yet Another Shit Implementation of [OICQ2](https://github.com/takayama-lily/oicq) WebAPI (http+ws)

## INSTALL

Clone仓库：

```sh
git clone https://github.com/SalimTerryLi/oicq_webd.git
```

安装依赖：

```sh
cd oicq_webd
npm install
```

## RUN

参考`oicqcfg.json.template`在运行目录下建立`oicqcfg.json`

执行`node index.js`即可启动

首次登录可能需要使用二维码：`node index.js -s`。登录成功后去掉`-s`使用配置文件内的密码进行登录。
