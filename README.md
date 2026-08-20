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
- 生产部署：一个 Node 进程即可同时提供 API 和构建后的 H5 静态文件

没有 Spring Boot、MySQL、Redis、微服务等额外组件。

## 目录

```text
lucky-draw-h5/
├── h5/             # 用户抽奖 H5 + 极简后台
├── server/         # Node API + SQLite
├── docs/           # 技术说明
└── .github/        # CI
```

## 本地开发

要求 Node.js >= 22.5。

### 1. 启动服务端

```bash
cd server
npm install
npm run dev
```

API 默认地址：`http://localhost:3000`

### 2. 启动 H5

另开终端：

```bash
cd h5
npm install
npm run dev
```

用户页：`http://localhost:5173`

管理页：`http://localhost:5173/admin`

Vite 会把 `/api` 代理到 `http://localhost:3000`。

## 极简管理页

管理页目前只做现场真正需要的数据查看和导出：

- 参与人数；
- 已抽/剩余/总奖品数；
- 四种奖品各自库存；
- 活动消耗进度；
- 最近中奖记录；
- 按微信用户、奖项、奖品快速搜索；
- 一键导出 CSV，可直接使用 Excel 打开。

开发环境默认管理员口令：

```text
dev-admin
```

正式部署必须设置环境变量：

```bash
ADMIN_KEY=替换成正式管理员口令
NODE_ENV=production
```

生产环境没有配置 `ADMIN_KEY` 时，后台接口默认不可登录。

后台页面和 CSV 中的 OpenID 都只展示脱敏值，不直接暴露完整用户标识。

## 测试

服务端核心测试不依赖外部数据库：

```bash
cd server
npm test
```

当前覆盖：

- 同一用户重复请求只消耗一份奖品；
- 260 个不同用户可将 260 份库存精确抽完；
- 库存耗尽后拒绝第 261 次新抽奖；
- 后台参与人数、已抽库存与中奖记录保持一致；
- 后台中奖记录不会返回完整 OpenID；
- CSV 导出包含中文表头和中奖记录，并保持 OpenID 脱敏。

## 当前开发身份模式

正式微信 OAuth 所需的公众号 AppID、AppSecret、网页授权域名尚未提供，因此当前联调阶段通过请求头模拟 OpenID：

```text
X-User-OpenId: dev-user-001
```

H5 在开发模式下会自动为浏览器生成一个 `dev-*` 身份。

正式接入微信 OAuth 时，只替换服务端身份获取这一层，抽奖和库存逻辑无需重写。

## API

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
2. 拿到公众号配置后接微信 OAuth；
3. 微信真机联调与线上 HTTPS 部署；
4. 是否增加“已领取”状态，等待业务最终确认。
