# LuckyDraw H5 极简部署说明

目标：保持部署简单。正式环境只需要 Node.js 22.5+、一个可写的数据目录，以及一个能从现场手机访问的 HTTPS 地址。

## 1. 安装依赖

在仓库根目录执行：

```bash
npm run setup
```

## 2. 配置 H5

复制：

```bash
cp h5/.env.production.example h5/.env.production
```

默认配置即可：

```text
VITE_ACTIVITY_SLUG=demo
VITE_API_BASE=
```

`VITE_API_BASE` 留空表示 H5 和 API 使用同一个正式域名。

## 3. 配置服务端

复制：

```bash
cp server/.env.example server/.env
```

正式上线至少填写：

```text
NODE_ENV=production
PORT=3000
DATA_FILE=./data/lucky-draw.sqlite
ADMIN_KEY=一个随机且足够长的管理员口令
```

本项目没有公众号，不需要 AppID、AppSecret、网页授权域名或微信 OAuth 配置。

## 4. 测试与构建

在仓库根目录执行：

```bash
npm run test
npm run build
```

`npm run test` 会执行抽奖核心、一人一次、260 份库存耗尽、后台数据/CSV 等测试，并完成 H5 类型检查和构建。

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
- `/api/*` 服务端接口。

H5 首次打开会在当前浏览器生成一个随机 visitorId 并保存在 localStorage。正常刷新、关闭页面后重新扫码，仍会使用原 visitorId，因此只能看到原中奖结果。

## 6. HTTPS / Nginx

正式活动建议使用 HTTPS，避免现场扫码时出现浏览器安全提示，也便于后续长期复用。

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

部署正式访问地址后打开：

```text
https://你的域名/admin
```

后台根据当前域名自动生成活动二维码，可直接复制活动链接、下载二维码 PNG，并打印放在活动现场。

本地 `localhost` 生成的二维码只用于开发预览，不应打印投放。

## 8. SQLite 数据

运行数据默认位于：

```text
server/data/lucky-draw.sqlite
```

请把 `server/data/` 当作持久化数据目录，不要在重新部署时删除。

稳妥的活动数据备份方式：停止 Node 服务后完整备份 `server/data/`，再启动服务。

## 9. “一人一次”的边界

因为没有公众号授权，V1 只能按浏览器 visitorId 控制重复参与：

- 正常刷新：不能重复抽；
- 关闭后重新扫码：不能重复抽；
- 同一浏览器再次进入：展示原中奖结果；
- 主动清理浏览器站点数据、无痕环境或更换设备：无法识别为同一自然人。

这是当前简单活动方案的已知边界。奖品库存本身仍由服务端 SQLite 事务严格扣减，因此不会因为更换 visitorId 而发生库存超发。

## 10. 上线前检查

正式活动开始前至少确认：

- `npm run test` 全部通过；
- 正式访问地址 HTTPS 可打开；
- 手机微信扫码可以直接进入活动页；
- 同一手机正常重复扫码只能看到同一条中奖结果；
- `/admin` 正式管理员口令可登录；
- 后台显示总奖品 260 份；
- 后台二维码指向正式活动地址；
- SQLite 数据目录已纳入服务器备份。
