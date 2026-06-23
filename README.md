# TRPG Infinite Canvas

一个用于构建类 FVTT 跑团工具的前端原型。项目当前重点是地图编辑、角色移动、权限控制，以及基础的 WebSocket 在线状态同步。

## 功能概览

- 无限 2D Canvas 画布：右键拖动画布平移，鼠标滚轮缩放。
- 编辑背景：上传或拖入背景图，并移动、缩放、旋转、调整层级。
- 编辑阻挡：编辑网格阻挡边和门。
- 编辑角色：放置或删除玩家角色。
- 编辑房间：选择封闭区域并设置房间。
- 游玩模式：玩家拖拽自己的角色，按阻挡边规则寻路移动。
- 身份选择界面：主持人为管理员，玩家只能操作自己的角色。
- WebSocket 同步：前端登录后会连接本地同步服务器，显示在线客户端和延迟状态。

## 环境要求

- Node.js 18 或更高版本。
- npm。

首次运行前安装依赖：

```bash
npm install
```

## 本地开发

本项目本地开发需要同时启动两个服务：

- 前端开发服务器：Vite，默认运行在 `http://localhost:5173`。
- WebSocket 同步服务器：Node.js + `ws`，默认运行在 `http://localhost:8787`。

打开第一个终端，启动前端：

```bash
npm run client
```

打开第二个终端，启动同步服务器：

```bash
npm run server
```

然后在浏览器访问：

```text
http://localhost:5173
```

同步服务器启动成功时会输出：

```text
TRPG sync server listening on http://localhost:8787
```

你也可以用健康检查接口确认同步服务器是否可用：

```bash
curl http://localhost:8787/health
```

正常情况下会返回类似：

```json
{"ok":true,"clients":0}
```

## WebSocket 配置

前端默认会连接当前页面主机名下的 `8787` 端口：

```text
ws://localhost:8787
```

如果同步服务器不在默认地址，可以通过环境变量覆盖。在 `client/.env.local` 中创建：

```bash
VITE_TRPG_SERVER_URL=ws://localhost:8787
```

HTTPS 页面需要使用 `wss://` 地址。

## 常见问题

### 登录后提示“无法连接 ws://localhost:8787”

这通常表示只启动了前端，没有启动 WebSocket 同步服务器。请确认另一个终端正在运行：

```bash
npm run server
```

也可以访问健康检查接口确认：

```bash
curl http://localhost:8787/health
```

### 端口被占用

如果 `8787` 被占用，可以用 `PORT` 修改同步服务器端口：

```bash
PORT=8790 npm run server
```

同时需要让前端连接新的端口，在 `client/.env.local` 中配置：

```bash
VITE_TRPG_SERVER_URL=ws://localhost:8790
```

修改 `client/.env.local` 后需要重启 `npm run client`。

## 构建验证

```bash
npm run build
```

本命令会先运行 TypeScript 检查，再执行 Vite 生产构建。

## 项目结构

仓库按客户端与服务端拆分。前端在 `client/` 下，由 Vite 提供开发与构建；WebSocket 同步服务在 `server/` 下独立运行。

```text
client/
  index.html           Vite 入口页面
  vite.config.ts       前端构建配置
  tsconfig.json        客户端 TypeScript 配置
  public/              静态资源（构建时原样复制）
  src/
    main.ts            应用入口：依赖装配、状态编排和启动流程
    styles.css         页面布局和 UI 样式

    core/              跨模块基础定义
      types.ts         共享类型：坐标、图片、角色、身份、交互状态
      constants.ts     画布、网格、token、手柄等常量
      appState.ts      应用运行状态初始化

    utilities/         通用工具函数
      dom.ts           DOM 查询和 Canvas context 获取
      geometry.ts      向量计算、旋转、距离、缓动函数

    modules/           按功能域拆分的业务逻辑
      canvas/          Canvas 渲染、命中检测、视口和指针交互
      grid/            网格、寻路、墙/门/房间辅助逻辑
      image/           图片导入、缩放、旋转和手柄计算
      identity/        身份选择和模式控件 UI
      scene/           场景实体创建、层级和尺寸操作

    controllers/       UI/交互控制器和页面接线
    services/          WebSocket 客户端与场景同步适配

server/
  index.mjs            WebSocket 同步服务器和健康检查接口
```

## 模式与权限

- `背景`：仅管理员可见，用于编辑背景图。
- `阻挡`：仅管理员可见，用于编辑阻挡边和门。
- `角色`：仅管理员可见，用于放置或删除角色。
- `房间`：仅管理员可见，用于选择封闭区域并设置房间。
- `游玩模式`：所有身份可见。主持人可以操作所有角色，玩家只能操作自己的角色。

全局操作不受模式限制：

- 右键拖动画布：移动相机。
- 鼠标滚轮：缩放画面。

## 移动与阻挡边

角色移动基于网格寻路，阻挡边用两个稀疏集合表示：

- `blockedVerticalEdges`：竖向阻挡边。
- `blockedHorizontalEdges`：横向阻挡边。

斜向移动采用严格规则：必须同时满足“先横再竖”和“先竖再横”两条 L 形路线都可通，避免角色从墙角斜穿或擦墙移动。

## 后续建议

- 增加持久化：保存/加载场景、背景图、token、阻挡边。
- 将主持人场景编辑结果通过 WebSocket 广播给玩家端。
- 为同步服务器增加房间、鉴权和断线恢复。
