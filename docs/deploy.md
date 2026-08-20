# LuckyDraw H5 极简部署说明

目标：保持部署简单。正式环境只需要 Node.js 22.5+、一个可写的数据目录，以及前置 HTTPS 反向代理。

## 1. 安装与检查

在仓库根目录执行：

```bash
npm run setup
npm run test
npm run build
```

`npm run test` 会同时执行服务端抽奖测试和 H5 类型检查/构建。

## 2. 配置生产环境

复制示例配置：

```bash
cp server/.env.example server/.env
```

至少修改：

```text
NODE_ENV=production
ADMIN_KEY=一个随机且足够长的管理员口令
DATA_FILE=./data/lucky-draw.sqlite
PORT=3000
```

不要把 `server/.env` 提交到 Git。

## 3. 启动

仓库根目录执行：

```bash
npm run start:env
```

服务默认监听：

```text
http://127.0.0.1:3000
```

同一个 Node 进程会同时提供：

- `/` 用户抽奖 H5；
- `/admin` 管理后台；
- `/api/*` 服务端接口。

## 4. HTTPS / Nginx

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

## 5. 现场二维码

部署正式域名后打开：

```text
https://你的域名/admin
```

后台会根据当前域名自动生成现场活动二维码，可直接：

- 复制活动链接；
- 下载二维码 PNG；
- 打印后放置在活动现场。

本地 `localhost` 环境生成的二维码只用于开发预览，不应打印投放。

## 6. SQLite 数据

运行数据默认位于：

```text
server/data/lucky-draw.sqlite
```

请把 `server/data/` 当作持久化数据目录，不要在重新部署时删除。

最稳妥的活动数据备份方式：停止 Node 服务后，完整备份 `server/data/` 目录，再启动服务。

## 7. 上线前检查

正式活动开始前至少确认：

- `npm run test` 通过；
- 正式域名 HTTPS 可访问；
- `/admin` 正式管理员口令可登录；
- 后台显示总奖品 260 份；
- 现场二维码扫码后进入正式活动域名；
- 微信 OAuth 接入完成后，同一个微信账号重复进入仍只能看到原中奖结果；
- SQLite 数据目录已纳入服务器备份。
