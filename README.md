# LuckyDraw H5

线下活动现场使用的微信 H5 抽奖系统。

## 当前开发状态

Phase 1 已进入开发：完成核心抽奖后端、固定库存奖池、同一活动同一用户仅一次、H5 移动端交互骨架以及 CI。

当前默认使用 **开发身份模式** 进行联调；微信 OAuth 会在拿到公众号 AppID / AppSecret / 网页授权域名后接入。

## V1 核心规则

- 微信扫码进入 H5；
- 同一微信账号在同一活动中只能抽一次；
- 每次有效抽奖必中奖；
- 奖品按剩余库存参与随机抽取；
- 奖品库存为 0 后自动退出奖池；
- 所有奖品抽完后停止新的抽奖；
- 用户再次进入时展示原中奖结果；
- 现场工作人员直接根据中奖页面发放实物，V1 暂不做核销码。

默认奖池：

| 奖项 | 奖品 | 数量 |
| --- | --- | ---: |
| 一等奖 | 音响 | 20 |
| 二等奖 | 咖啡杯 | 50 |
| 三等奖 | 黄麻手提袋 | 80 |
| 幸运奖 | 小花盆 | 110 |
| 合计 |  | 260 |

## 技术栈

- H5：Vue 3 + TypeScript + Vite
- Backend：Java 21 + Spring Boot + Spring JDBC + Flyway
- Database：MySQL 8.4
- Test：JUnit 5 + H2(MySQL mode)

## 本地启动

### 1. MySQL

```bash
docker compose up -d mysql
```

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

默认 API：`http://localhost:8080`

### 3. H5

```bash
cd h5
npm install
npm run dev
```

默认页面：`http://localhost:5173`

Vite 开发服务器会把 `/api` 代理到 `http://localhost:8080`。

## 开发身份模式

微信 OAuth 尚未配置时，H5 会在浏览器本地生成一个 `dev-*` 身份，通过 `X-User-OpenId` 请求头调用后端。该模式只用于本地/验收联调，不能作为正式上线的一人一次依据。

正式环境将切换到微信网页授权，由服务端可信会话提供 OpenID，不接受前端自行伪造身份。

## 主要 API

- `GET /api/v1/activities/{slug}`：活动与奖池状态
- `GET /api/v1/activities/{slug}/me`：当前用户中奖记录
- `POST /api/v1/activities/{slug}/draw`：抽奖

联调阶段 `me/draw` 需要请求头：

```text
X-User-OpenId: dev-user-001
```

## 目录

```text
lucky-draw-h5/
├── backend/        # Spring Boot API
├── h5/             # 微信 H5
├── docs/           # 产品与技术说明
└── docker-compose.yml
```

## 下一步

1. 接入微信 OAuth / 服务端会话；
2. 完成活动后台与奖品配置；
3. 加入正式活动视觉素材和抽奖动画；
4. 增加后台统计、导出与库存操作审计；
5. 真机微信环境联调和上线部署。
