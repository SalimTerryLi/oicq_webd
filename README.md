# README

Yet Another Shit Implementation of [OICQ2](https://github.com/takayama-lily/oicq) WebAPI (http+ws)

**NOT COMPATIBLE WITH ONEBOT OR CQHTTP**

## INSTALL

Make sure nodejs and npm is properly installed and is on the latest LTS release (node v16.x.x+).

Then install the package globally:

```sh
npm -i -g oicq2-webapid
```

Test installation:

```sh
oicq2-webapid -h
```

Expected output:

```
Usage: oicq2-webapid [option [value]] ...
Cli parameters will override the corresponding ones from configuration file

Options:
  -h, --help      Show help                                            [boolean]
  -d, --datadir   persist oicq data dir         [string] [default: ".oicq_data"]
  -q, --qq        qq number                                             [number]
  -P, --password  use password login                                    [string]
  -s, --qrcode    scan qrcode to login                [boolean] [default: false]
  -p, --port      WebAPI listen port                    [number] [default: 8888]
  -b, --bind      WebAPI bind address            [string] [default: "127.0.0.1"]
  -v, --version   Show version number                                  [boolean]
  -c, --config    Path to JSON config file         [default: "oicqweb_cfg.json"]
```

## CONFIGURE

You'd first need to pick an empty directory to serve as persist storage for OICQ2 and this daemon service.

I'll use `$HOME/.config/oicq2-webapid` as example.

Ensure that folder exists:

```sh
mkdir -p $HOME/.config/oicq2-webapid
cd $HOME/.config/oicq2-webapid
```

Create configuration from template. The template configuration file is `oicqweb_cfg.json.template` under the project root. Copy that file to persist storage and rename it as `oicqweb_cfg.json`:

```sh
curl -L https://github.com/SalimTerryLi/oicq_webd/raw/main/oicqweb_cfg.json.template -o oicqweb_cfg.json
```

Edit that file.

```sh
nano oicqweb_cfg.json
```

You need to fill the correct information into fields: `qq`, `password`. You can change the default bind address if necessary.

## FIRST RUN

The daemon will pick `oicqweb_cfg.json` under current directory by default.

It is highly recommended to login by scanning QR code for the first time:

```sh
oicq2-webapid -s
```

A QR code will be printed to the console. Assume you have a large enough terminal to display the full code.

Scanning that QR code with your mobile QQ client, logged in as your bot account. After you has accept the login attempt on your phone, press Enter into the console and bot will login successfully.

## RUN AS SERVICE

It will be OK to use password login after the first login attempt succeed, so that we can set up the bot as a daemon service.

Normally you can start the daemon with single command in the persist folder:

```sh
oicq2-webapid
```

Here is a sample systemd service unit which is intended  to be run as user service (with `systemctl --user` flag)

```systemd
[Unit]
Description=OICQ2 WebAPI daemon
After=network.target
[Service]
Type=simple
WorkingDirectory=$HOME/.config/oicq2-webapid
ExecStart=/path/to/daemon
ExecStop=/bin/kill -s QUIT $MAINPID PrivateTmp=true
Restart=always
RestartSec=10
[Install]
WantedBy=default.target
```

Where `/path/to/daemon` should be replaced with the path from `whereis oicq2-webapid`. It depends on your nodejs installation.

The unit file should be placed at `$HOME/.config/systemd/user/oicq2-webapid.service`

To start the service:

```sh
systemctl --user enable oicq2-webapid
systemctl --user start oicq2-webapid
```

To update the daemon:

```sh
npm update -g oicq2-webapid oicq
systemctl --user restart oicq2-webapid
```

## NOTES

[systemctl --user not work](https://serverfault.com/a/1047069)

[service stopped after ssh disconnected / not automatically started at boot](https://wiki.archlinux.org/title/systemd/User#Automatic_start-up_of_systemd_user_instances)
