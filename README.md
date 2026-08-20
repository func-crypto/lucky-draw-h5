# LuckyDraw H5

一个面向线下活动现场的轻量微信 H5 抽奖项目。

## V1 规则

- 微信扫码进入活动页；
- 同一微信账号同一场活动只能抽一次；
- 每次有效抽奖必中奖；
- 奖品按“当前剩余库存”参与随机；
- 某奖品库存为 0 后自动退出奖池；
- 全部奖品抽完后停止新的抽奖；
- 已抽用户再次进入时展示原中奖结果；
- 用户现场展示中奖页面，工作人员直接发实物；
- V1 暂不做核销码。

默认奖池：

| 奖项 | 奖品 | 数量 |
| --- | --- | ---: |
| 一等奖 | 音响 | 20 |
| 二等奖 | 咖啡杯 | 50 |
| 三等奖 | 黄麻手提袋 | 80 |
| 幸运奖 | 小花盆 | 110 |
| **合计** |  | **260** |

## 技术方案

刻意保持简单：

```text
Vue 3 H5
   ↓
Node.js API
   ↓
SQLite
```

- H5：Vue 3 + TypeScript + Vite
- 服务端：Node.js 22 + Express
- 数据库：Node.js 内置 SQLite（单文件）
- 微信登录：公众号网页 OAuth + 服务端签名 HttpOnly Cookie
- 生产部署：一个 Node 进程同时提供 API、用户 H5 和后台
- 不使用 Spring Boot、MySQL、Redis、微服务或独立 Session 服务

## 目录

```text
lucky-draw-h5/
├── h5/             # 用户抽奖 H5 + 极简后台
├── server/         # Node API + SQLite + 微信 OAuth
├── docs/           # 架构与部署说明
├── package.json    # 根目录统一命令
└── .github/        # CI
```

## 最简单的本地启动

要求 Node.js >= 22.5。

先安装全部依赖：

```bash
npm run setup
```

终端 1：

```bash
cd server
npm run dev
```

终端 2：

```bash
cd h5
npm run dev
```

用户页：`http://localhost:5173`

管理页：`http://localhost:5173/admin`

开发环境默认管理员口令：`dev-admin`

## 根目录统一命令

```bash
npm run setup     # 安装 server + h5 依赖
npm run test      # 服务端测试 + H5 类型检查/构建
npm run build     # 构建 H5
npm run start     # 启动服务端
npm run start:env # 读取 server/.env 后启动生产服务
```

## 微信登录

微信 OAuth 主链已经实现，不需要等拿到公众号参数后再写代码。

正式模式流程：

```text
微信扫码
  ↓
H5 请求当前用户结果
  ↓
未登录返回 IDENTITY_REQUIRED
  ↓
自动跳转 /auth/wechat
  ↓
公众号 snsapi_base 静默授权
  ↓
/auth/wechat/callback 换取 OpenID
  ↓
服务端写入签名 HttpOnly Cookie
  ↓
返回活动页
  ↓
以 OpenID 执行“一微信一次”
```

签名 Cookie 只保存经过服务端签名的会话信息，AppSecret 和 Session Secret 不进入前端。

当前因为还没有正式公众号 AppID / AppSecret / 授权域名，默认仍使用 `dev` 身份模式联调。拿到参数后只需填写环境变量并把 H5 构建模式切换为 `wechat`。

## 极简管理页

`/admin` 当前包含现场真正需要的能力：

- 参与人数；
- 已抽/剩余/总奖品数；
- 四种奖品各自库存；
- 活动消耗进度；
- 最近中奖记录；
- 按微信用户、奖项、奖品快速搜索；
- 一键导出 CSV，可直接使用 Excel 打开；
- 自动生成当前正式域名的现场活动二维码；
- 复制活动链接；
- 下载二维码 PNG 供现场打印。

后台页面和 CSV 中的 OpenID 只展示脱敏值，不直接暴露完整用户标识。

## 生产配置

H5：

```bash
cp h5/.env.production.example h5/.env.production
```

服务端：

```bash
cp server/.env.example server/.env
```

正式服务端关键配置：

```text
NODE_ENV=production
IDENTITY_MODE=wechat
ADMIN_KEY=替换成正式随机强口令
DATA_FILE=./data/lucky-draw.sqlite
PORT=3000
PUBLIC_BASE_URL=https://你的正式域名
WECHAT_APP_ID=公众号 AppID
WECHAT_APP_SECRET=公众号 AppSecret
SESSION_SECRET=随机强会话签名密钥
```

完整部署步骤见：`docs/deploy.md`。

## 测试

```bash
npm run test
```

当前覆盖：

- 同一用户重复请求只消耗一份奖品；
- 260 个不同用户可将 260 份库存精确抽完；
- 库存耗尽后拒绝第 261 次新抽奖；
- 后台参与人数、已抽库存与中奖记录保持一致；
- 后台中奖记录不会返回完整 OpenID；
- CSV 导出包含中文表头和中奖记录，并保持 OpenID 脱敏；
- OAuth state 签名和篡改检测；
- HttpOnly 用户会话签名、过期和错误密钥检测；
- 微信授权 URL 和 code→OpenID 网络调用逻辑（使用 mock，不依赖真实微信）。

## API

身份：

- `GET /auth/wechat`
- `GET /auth/wechat/callback`

用户端：

- `GET /api/health`
- `GET /api/v1/activities/{slug}`
- `GET /api/v1/activities/{slug}/me`
- `POST /api/v1/activities/{slug}/draw`

管理端：

- `GET /api/admin/{slug}/stats`
- `GET /api/admin/{slug}/draws`
- `GET /api/admin/{slug}/draws.csv`

管理端请求使用 `X-Admin-Key` 请求头。

## 当前剩余事项

1. 根据客户最终素材继续收 H5 视觉；
2. 拿到公众号参数后填配置并进行微信真机 OAuth 验证；
3. 正式 HTTPS 上线；
4. 是否增加“已领取”状态，等待业务最终确认。
