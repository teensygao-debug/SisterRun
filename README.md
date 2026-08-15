# 姐妹快跑 × WeUs

《姐妹快跑》是一个支持键盘、触屏和 Xbox 手柄的静态网页跑酷游戏。这个特别合作版本中，地图会随机掉落 WeUs「勇气能量包」；拾取后立即获得 5 秒 Fearless，并在此期间拥有无限普通卫生巾弹药。

## 在线试玩

[打开 GitHub Pages 试玩](https://teensygao-debug.github.io/SisterRun/)

建议使用最新版 Chrome、Edge 或 Safari。第一次使用 Xbox 手柄时，请先按任意手柄按键让浏览器识别设备。

## 操作方式

- 键盘：`↑` / `W` 跳跃；轻按 `Space` 投掷；长按后松开 `Space` 冲撞
- Xbox 手柄：`A` 跳跃；`X` 投掷或蓄力冲撞；`Menu` 开始或重新开始
- 手机：使用页面上的触屏按钮操作

## 源码与发布目录

根目录的 `index.html` 是唯一需要手工修改的游戏源码。不要分别编辑 `dist/index.html` 或 `sisterrun-sandbox-iframe/index.html`，它们由发布脚本生成：

```bash
node scripts/build-static.mjs
```

该命令会：

- 生成保留 `assets/` 分层路径的 `dist/`
- 生成资源扁平化、可直接放入沙箱 iframe 的 `sisterrun-sandbox-iframe/`
- 检查游戏引用的资源是否存在
- 拒绝内容不同但文件名相同的 iframe 资源

生成器只同步游戏当前实际使用的资源，不修改根目录 `index.html`。

## 不要直接双击打开

不要用下面这种方式预览：

```text
file:///.../SisterRun/dist/index.html
```

Chrome 等浏览器可能会限制 `file://` 页面读取 JSON manifest、图片或音频，导致角色、背景、音效或其他资源加载不完整。

## 本地预览

先在 `SisterRun/` 目录执行生成命令，再启动静态服务器：

```bash
node scripts/build-static.mjs
python3 -m http.server 8000 -d dist
```

浏览器打开：

```text
http://127.0.0.1:8000/
```

## 静态部署

部署时把 `dist/` 目录作为静态站点根目录上传。部署后站点根目录应包含：

```text
index.html
assets/
```

预期访问路径：

```text
https://your-demo-domain/
```

如果部署到子路径，也应保持 `index.html` 与 `assets/` 的相对关系，例如：

```text
https://your-demo-domain/sister-run/
```

## 资源要求

- `assets/assets.json` 必须能通过 HTTP 返回 `200`
- 图片资源必须能通过 HTTP 返回 `200`
- `assets/audio/bgm_main_loop.mp3` 必须能通过 HTTP 返回 `200`
- 不需要额外的服务器端逻辑
