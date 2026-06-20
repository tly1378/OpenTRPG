# TRPG Infinite Canvas

这是一个用于构建类 FVTT 跑团工具的前端原型。当前重点是地图编辑与基础游玩交互：

- 无限 2D Canvas 画布，相机可右键拖动平移、滚轮缩放。
- 美术地图模式：上传/拖入背景图，并移动、缩放、旋转、调整层级。
- 逻辑地图模式：放置玩家角色、编辑网格阻挡边。
- 游玩模式：玩家拖拽自己的角色，按阻挡边规则寻路移动。
- 身份选择界面：主持人为管理员，玩家只能操作自己的角色。

## 运行

```bash
npm install
npm run dev
```

构建验证：

```bash
npm run build
```

## 代码结构

主要代码在 `src/` 下。`main.ts` 现在负责应用初始化、状态编排和事件绑定；具体算法和 UI 细节拆到了独立模块中。

```text
src/
  main.ts            应用入口：DOM 接线、全局状态、事件绑定、模块编排
  types.ts           共享类型：坐标、图片、角色、身份、交互状态
  constants.ts       画布、网格、token、手柄等常量
  dom.ts             DOM 查询和 Canvas context 获取
  geometry.ts        向量计算、旋转、距离、缓动函数
  viewport.ts        相机、屏幕/世界坐标转换、Canvas resize
  grid.ts            网格坐标、阻挡边、角色占位、寻路规则
  renderer.ts        Canvas 绘制：网格、墙、路径、角色、图片、选区
  imageTransform.ts  背景图缩放/旋转手柄、等比缩放计算
  hitTesting.ts      图片、角色、手柄的命中检测
  imageImport.ts     图片文件加载、拖拽图片判断
  identityUi.ts      身份选择列表、模式选项、身份标签文案
  modeControls.ts    模式相关按钮的显示、禁用和激活状态
  sceneActions.ts    创建图片/token、图片层级、还原尺寸等场景操作
  styles.css         页面布局和 UI 样式
```

## 模式与权限

- `美术地图`：仅管理员可见，用于编辑背景图。
- `逻辑地图`：仅管理员可见，用于放置角色和编辑阻挡边。
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

- 将 `main.ts` 中剩余的事件绑定继续拆到 `interactions/` 模块。
- 增加持久化：保存/加载场景、背景图、token、阻挡边。
- 增加 WebSocket 同步，让主持人和玩家在不同客户端共享同一场景。
