# LuckyDraw H5 极简部署说明

目标：保持部署简单。正式环境只需要 Node.js 22.5+、一个可写的数据目录，以及前置 HTTPS 反向代理。

## 1. 安装依赖

在仓库根目录执行：

```bash
npm run setup
```

## 2. 配置 H5 正式身份模式

复制：

```bash
cp h5/.env.production.example h5/.env.production
```

保持：

```text
VITE_IDENTITY_MODE=wechat
VITE_ACTIVITY_SLUG=demo
VITE_API_BASE=
```

`VITE_API_BASE` 留空表示用户页、微信授权和 API 使用同一个正式域名。

## 3. 配置服务端

复制：

```bash
cp server/.env.example server/.env
```

正式上线至少需要填写：

```text
NODE_ENV=production
IDENTITY_MODE=wechat
PORT=3000
DATA_FILE=./data/lucky-draw.sqlite
ADMIN_KEY=一个随机且足够长的管理员口令

PUBLIC_BASE_URL=https://你的正式域名
WECHAT_APP_ID=公众号 AppID
WECHAT_APP_SECRET=公众号 AppSecret
SESSION_SECRET=一个随机且足够长的会话签名密钥
```

`WECHAT_APP_SECRET` 和 `SESSION_SECRET` 只保存在服务端，绝不能写进 H5 环境变量或前端代码。

微信公众号后台需要把正式域名配置为网页授权相关域名，否则 OAuth 回调无法正常完成。

## 4. 测试与构建

在仓库根目录执行：

```bash
npm run test
npm run build
```

`npm run test` 会执行：

- 抽奖核心测试；
- 一人一次 / 库存耗尽测试；
- 后台数据和 CSV 测试；
- OAuth state / 签名会话测试；
- H5 类型检查和构建。

## 5. 启动

仓库根目录执行：

```bash
npm run start:env
```

服务默认监听：

```text
http://127.0.0.1:3000
```

同一个 Node 进程提供：

- `/` 用户抽奖 H5；
- `/admin` 管理后台；
- `/auth/wechat` 微信授权入口；
- `/auth/wechat/callback` 微信授权回调；
- `/api/*` 服务端接口。

用户没有有效登录会话时，H5 会自动进入微信网页授权；授权完成后服务端将 OpenID 写入签名 HttpOnly Cookie。用户清理浏览器数据后重新授权，仍会取得同一个微信 OpenID，因此数据库中的“一人一次”规则不会失效。

## 6. HTTPS / Nginx

微信公众号网页授权和现场扫码正式使用时，应通过 HTTPS 域名访问。

最小 Nginx 反向代理示例：

```nginx
server {
    listen 443 ssl;
    server_name lottery.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

证书路径和域名按实际服务器修改。

## 7. 现场二维码

部署正式域名后打开：

```text
https://你的域名/admin
```

后台根据当前域名自动生成现场活动二维码，可直接：

- 复制活动链接；
- 下载二维码 PNG；
- 打印后放置在活动现场。

本地 `localhost` 环境生成的二维码只用于开发预览，不应打印投放。

## 8. SQLite 数据

运行数据默认位于：

```text
server/data/lucky-draw.sqlite
```

请把 `server/data/` 当作持久化数据目录，不要在重新部署时删除。

最稳妥的活动数据备份方式：停止 Node 服务后，完整备份 `server/data/` 目录，再启动服务。

## 9. 上线前检查

正式活动开始前至少确认：

- `npm run test` 全部通过；
- H5 使用 `VITE_IDENTITY_MODE=wechat` 构建；
- 服务端使用 `IDENTITY_MODE=wechat`；
- 正式域名 HTTPS 可访问；
- 微信公众号网页授权域名配置完成；
- 微信扫码后能自动完成授权并返回活动页；
- 同一微信账号重复扫码只能看到同一条中奖结果；
- `/admin` 正式管理员口令可登录；
- 后台显示总奖品 260 份；
- 后台二维码指向正式活动域名；
- SQLite 数据目录已纳入服务器备份。
