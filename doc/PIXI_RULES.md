# PixiJS Development Rules（Phase 1）

当前阶段：

Prototype（原型开发）

目标：

完成游戏玩法。

不是完成美术。

---

## 第一原则

所有人物、障碍、道具全部使用 Placeholder。

不要生成任何新的 Pixel Art。

不要调用 AI 绘图。

不要生成 Sprite。

全部使用：

Rectangle

Circle

Simple Shapes

作为临时资源。

例如：

Player：

红色矩形。

Smoke：

灰色圆形。

Harasser：

黄色矩形。

Drunk：

棕色矩形。

Pad：

粉色矩形。

Boom：

黄色圆形。

---

## 第二原则

先完成：

Run

Jump

Attack

Charge

Collision

Camera

HUD

Combo

Fearless Mode

Game Over

Restart

这些全部完成以后。

再替换 Sprite。

---

## 第三原则

整个项目必须完全支持：

后续只替换 PNG。

不修改任何游戏逻辑。

例如：

现在：

new Graphics()

以后：

new AnimatedSprite()

代码无需修改。

---

## 第四原则

资源全部统一 AssetManager。

不要在业务代码写死：

assets/player.png

所有资源统一：

assets.json

方便以后替换 Sprite Sheet。

---

## 第五原则

整个项目结构采用：

Scene

Entity

Component

Manager

不要把所有代码写进 main.ts。

必须拆分。

例如：

Player.ts

Enemy.ts

Camera.ts

Collision.ts

Fearless.ts

ComicPopup.ts

GameScene.ts

HUD.ts

InputManager.ts

SoundManager.ts

AssetManager.ts

---

## 第六原则

不要过早优化。

不要加入：

剧情。

商店。

技能树。

任务。

地图。

只关注：

游戏手感。

玩家反馈。

动画节奏。

碰撞。

情绪奖励。

所有 Placeholder 必须可以在未来一键替换为真正 Sprite Sheet。
