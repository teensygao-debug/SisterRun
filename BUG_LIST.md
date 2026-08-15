# SisterRun 问题清单

代码走查日期：2026-07-18（针对根目录 `index.html`）
修复原则：最小改动，修完一类确认一类。

## 已修复

- [x] **Bug5：主角状态切换动画跳帧** —— `resetGame` 给 player 增加 `animState/animStart`，`drawPlayerBody` 检测状态变化后从状态起点计帧（`index.html:1548`、`index.html:2410`）。

## Bug 类

- [ ] **B1. 投掷音效用错（低）**
  `index.html:1825` 投掷卫生巾分支播放的是 `audio.jump()`（跳跃音效），疑似复制粘贴。修法：新增投掷音效并替换。

- [ ] **B2. 资源加载无容错（中）**
  `index.html:1248` `Promise.all(jobs)` 任一图片失败即整体 reject，`visualAssets.ready` 永远 false、`applyVisualAssetStyles()` 不执行，全部 UI 图片样式失效。修法：单条失败单条 fallback（每个 job 自带 catch）。

- [ ] **B3. 资源文件名带前导空格（隐患，非当前故障）**
  `assets/fx/ stars_01.png` 文件名带空格，浏览器本地会以 `%20` 编码加载，但部分 CDN/静态服务器会 404。manifest 三处引用：`index.html:1124/1142/1160`（spark、fearlessGlow、starHit）。修法：重命名文件并同步引用。

## 性能类（待 Bug 修完确认后再动）

- [ ] **P1. `updateHud()` 每帧重建 DOM（主要）**
  `index.html:2045` 每帧调用，`index.html:1591-1597` 用 `innerHTML` 重建 hearts + pads，每帧销毁/插入 DOM 并触发 layout。修法：缓存上次值，变化才写 DOM；fearless 倒计时按 `toFixed(1)` 粒度缓存。

- [ ] **P2. 启动逐像素处理大图阻塞主线程**
  `index.html:1258` `keyLightBackground` 对约 14 张百万像素级图片逐像素 BFS；`index.html:1244` 对 heartFull/padIcon `toDataURL` 生成 MB 级 base64，仅用于 28px HUD 图标。修法（最小版）：HUD 图标先缩到 64px 再 keying + toDataURL；sprite keying 保留或后续挪 `tools/` 预处理。

- [ ] **P3. 背景每帧多画一张（小）**
  `index.html:2154` `drawPanoramaBackground` 循环从 `-offset - dw` 起，每帧多一次全屏 `drawImage`。改成从 `-offset` 起。

- [ ] **P4. 热路径微优化（可选）**
  `drawSpeedLines`/`drawPickups`/`drawProjectiles` 循环内重复 `getSprite` 字符串查找（`index.html:2295/2308/2321`），可提出循环外；每帧 6 处 `filter` 数组重分配，GC 压力小，可不动。

## 特意不修

- **障碍物"状态切换跳帧"**：harasser/drunk/smoke 的所有状态对共享同一 sheet、同一 4 帧布局，全局 `game.time` 计帧反而保证切换连续，按 Bug5 思路改会适得其反。

## 备注

- `dist/index.html` 与 `sisterrun-sandbox-iframe/index.html` 是独立副本，含同样代码；本次只改根目录 `index.html`，如需同步副本另行处理。
