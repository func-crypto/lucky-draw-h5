# LuckyDraw H5

一个面向线下活动现场的轻量 H5 抽奖项目。

## V1 规则

- 微信扫码直接进入活动页，不依赖公众号；
- 每位参与者限一次，V1 按当前浏览器 visitorId 控制；
- 每次有效抽奖必中奖；
- 奖品按当前剩余库存参与随机；
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
- 参与者识别：浏览器随机 visitorId + localStorage
- 生产部署：一个 Node 进程同时提供 API、用户 H5 和后台
- 不使用 Spring Boot、MySQL、Redis、微信公众号 OAuth 或独立 Session 服务

## 目录

```text
lucky-draw-h5/
├── h5/             # 用户抽奖 H5 + 极简后台
├── server/         # Node API + SQLite
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

## 一人一次

本项目没有公众号，因此不使用微信 OpenID。

H5 首次打开时生成一个随机 visitorId 并保存到浏览器 localStorage，后续所有抽奖请求都携带该 visitorId。服务端数据库对同一活动的 visitorId 做唯一约束，所以正常刷新、关闭页面再扫码、再次进入，都只能看到第一次中奖结果。

已知边界：用户如果主动清理站点数据、使用无痕环境或更换设备，V1 无法判断仍是同一个自然人。该边界为当前简单现场活动方案所接受；无论 visitorId 如何变化，奖品库存始终由服务端事务严格控制，不会超发。

## 极简管理页

`/admin` 当前包含现场真正需要的能力：

- 参与人数；
- 已抽 / 剩余 / 总奖品数；
- 四种奖品各自库存；
- 活动消耗进度；
- 最近中奖记录；
- 中奖记录搜索；
- 一键导出 CSV，可直接使用 Excel 打开；
- 自动生成当前正式域名的现场活动二维码；
- 复制活动链接；
- 下载二维码 PNG 供现场打印。

## 生产配置

H5：

```bash
cp h5/.env.production.example h5/.env.production
```

服务端：

```bash
cp server/.env.example server/.env
```

正式服务端只需要：

```text
NODE_ENV=production
ADMIN_KEY=替换成正式随机强口令
DATA_FILE=./data/lucky-draw.sqlite
PORT=3000
```

不需要公众号 AppID、AppSecret 或网页授权域名。

完整部署步骤见：`docs/deploy.md`。

## 测试

```bash
npm run test
```

当前覆盖：

- 同一 visitorId 重复请求只消耗一份奖品；
- 260 个不同参与者可将 260 份库存精确抽完；
- 库存耗尽后拒绝第 261 次新抽奖；
- 后台参与人数、已抽库存与中奖记录保持一致；
- 后台中奖记录不会暴露完整参与标识；
- CSV 导出包含中文表头和中奖记录，并保持参与标识脱敏。

## API

用户端：

- `GET /api/health`
- `GET /api/v1/activities/{slug}`
- `GET /api/v1/activities/{slug}/me`
- `POST /api/v1/activities/{slug}/draw`

用户请求使用：

```text
X-Visitor-Id: visitor-xxxxxxxx
```

管理端：

- `GET /api/admin/{slug}/stats`
- `GET /api/admin/{slug}/draws`
- `GET /api/admin/{slug}/draws.csv`

管理端请求使用 `X-Admin-Key`。

## 当前剩余事项

1. 根据客户最终活动素材继续收 H5 视觉；
2. 确认正式访问域名 / HTTPS；
3. 手机微信扫码真机联调；
4. 是否增加“已领取”状态，等待业务最终确认。
