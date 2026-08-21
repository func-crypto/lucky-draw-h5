# Architecture

## 目标

LuckyDraw H5 是一次线下现场抽奖，不按大型营销平台建设。V1 优先保证：代码少、依赖少、部署简单、库存不超发、正常参与者不能重复抽奖。

## 架构

```text
微信 / 浏览器
    │
    ├── H5 静态页面（Vue 3）
    │
    └── /api
          │
       Node.js
          │
       SQLite
```

生产环境构建 H5 后，Node 服务直接托管 `h5/dist`。一台小服务器只需要运行一个 Node 进程和一个 SQLite 数据文件。

## 数据表

仅保留三张核心表：

- `activities`：活动；
- `prizes`：奖品及库存；
- `draws`：参与者中奖记录。

`draws(activity_id, openid)` 保留为内部唯一键字段，用来存储浏览器 visitorId；唯一约束保证同一个 visitorId 在同一活动中只有一条中奖记录。后续如果确有必要再做字段重命名，不为此增加数据库迁移复杂度。

## 参与者识别

当前活动没有公众号，因此不接微信 OAuth，也不需要 AppID / AppSecret。

H5 首次打开时生成随机 `visitorId` 并保存到浏览器 `localStorage`，后续请求通过 `X-Visitor-Id` 传给服务端：

```text
首次打开 H5
  ↓
生成 visitor-UUID
  ↓
保存 localStorage
  ↓
POST /draw 携带 X-Visitor-Id
  ↓
数据库唯一约束限制重复抽奖
```

正常刷新、关闭后重新扫码进入，都会继续使用原 visitorId，因此只能看到第一次中奖结果。

该方案的明确边界是：用户如果主动清理站点数据、使用无痕环境或更换设备，系统无法判断仍是同一个自然人。V1 接受这个边界，以保持现场活动流程最简单。无论 visitorId 如何变化，奖品总库存始终由服务端事务控制，不会超发。

## 库存安全

抽奖使用 SQLite `BEGIN IMMEDIATE` 写事务：

1. 再次检查 visitorId 是否已抽；
2. 读取仍有库存的奖品；
3. 按剩余库存做权重随机；
4. 对中奖奖品执行 `remaining_stock - 1`；
5. 写入中奖记录；
6. 提交事务。

这样无需 Redis 或单独的锁服务，也足以覆盖本项目的现场规模。
