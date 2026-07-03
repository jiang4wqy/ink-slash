# 一闪 · 墨斩(ink-slash)设计文档

日期:2026-07-03
状态:已获用户批准(形态=单一深度体验;玩法=隔空切果;视觉=和风水墨;名字=一闪 · 墨斩)

## 1. 产品概念

宣纸上的居合斩。摄像头追踪手部,指尖即刀、墨迹为痕:水墨画风的果实抛入画面,玩家隔空一挥,
笔锋划过、果实应声而断,墨彩四溅在宣纸上留下渐淡的印渍。完全在浏览器本地运行,零上传。

来源:重塑 tear-reality-demo,仅保留其手势操控思路(HandTracker 结构:摄像头初始化 /
GPU→CPU 回退 / 逐帧检测),滤波改用 gesture-air-canvas 项目验证过的 One Euro 滤波。

## 2. 玩法规则(经典模式,唯一模式)

- 果实成波次从底部抛入(抛物线,轻微水平漂移),波次大小随分数爬升(1–2 个 → 最多 5 个)。
- 指尖刀光划过果实即斩。每果 10 分。
- **连击**:400ms 滚动窗口内斩 N 果(N≥2)→ 额外加 N×10 分,朱红印章「N连斩」砸在纸面;
  N≥3 触发 ~600ms 慢动作(时间缩放 0.35)。
- **漏接**:普通果实未被斩、落出底边 → 损失 1 条命(共 3 条,以墨滴表示);0 条 → 终局。
- **铁炮弹**:黑铁炸弹(引信冒火星),生成概率随分数从 8% 爬到 15%;斩中 = 墨爆、立即终局。
- 最高分存 localStorage(键 `ink-slash:best`)。
- 终局画面:本局分数(毛笔字)、最高分、「再来一局」「回主页」。

## 3. 输入与手感

### 手势(主要方式)
- MediaPipe HandLandmarker(VIDEO 模式,numHands=2,GPU→CPU 回退),模型/wasm 本地化。
- 每只可见手的**食指尖(landmark 8)= 一把刀**,最多双刀。
- **One Euro 滤波**:快挥低延迟、慢移防抖(固定参数,不做灵敏度滑块)。
- **速度门槛**:指尖速度 > 600 px/s(按视口高/720 缩放)才"开刃";低速掠过不斩(防误触)。
  挥速越快 → 刀痕越粗、音效越重。
- **扫掠线段碰撞**:用两帧指尖连线(线段)与果实圆求交,30fps 下快挥不漏斩。
- 镜像显示(自拍视角),坐标按摄像头真实画幅比例映射(沿用 gesture-air-canvas 的教训)。

### 鼠标模式(完整可玩的回退 + 开发验证通道)
- 指针位置 = 刀,同一套速度门槛/碰撞/渲染逻辑;输入抽象为统一的 `BladeInput`。

### 菜单交互
- 指尖悬停按钮 900ms(圆环进度)→ 触发;鼠标可直接点击。全程无需键盘。

## 4. 状态机

`menu → countdown(3-2-1) → playing → gameover → menu`
- menu 有两个入口:「启用摄像头」(申请权限 + 加载模型后进 countdown)/「鼠标模式」。
- gameover 显示成绩,提供「再来一局」(直接 countdown)与「回主页」。
- 标签页隐藏时暂停游戏与追踪。

## 5. 视觉(全部程序化绘制,零图片资产)

- **宣纸底**:离屏 canvas 程序化纹理(纤维 + 淡斑),resize 时重生成。
- **刀痕**:近 300ms 指尖轨迹渲染为收锋变细的墨笔触,速度映射浓淡粗细。
- **果实**(sumi-e 风,墨线轮廓 + 淡彩晕染):柿(橙)、梅(红紫)、西瓜(外绿内红)、葫芦(黄褐)。
- **斩开**:果实沿垂直于刀线方向分成两半(裁剪绘制),带分离速度 + 旋转 + 重力,渐隐;
  斩中瞬间墨点飞白迸溅 + 果色淡彩晕染留纸(对象列表按年龄淡出 ~4s,数量封顶)。
- **HUD**:左上大号毛笔数字计分;右上三枚墨滴 = 命;连击朱印出现在斩中位置。
- **标题屏**:大字「一闪 · 墨斩」+ 纸卡按钮 + 朱红印章点缀。
- 字体栈:`"STKaiti", "KaiTi", "DFKai-SB", "Noto Serif SC", serif`(不引 webfont,离线可用)。

## 6. 音效(WebAudio 全合成,零音频文件)

挥刀风声(带通噪声,随速度)、斩中太鼓(低频正弦下滑 + 噪声瞬态)、连击拨弦(Karplus-Strong)、
炸弹闷响、终局钟声。主音量 + 静音开关(localStorage);AudioContext 在首次交互后 resume。

## 7. 架构

```
src/gesture/   handTracker.ts  oneEuro.ts          ← 手势引擎
src/game/      fruit.ts  spawner.ts  collision.ts  scoring.ts  state.ts  blade.ts
src/render/    paper.ts  trail.ts  splash.ts  fruitPainter.ts  hud.ts
src/audio/     sfx.ts
src/main.ts    主循环(固定步长逻辑 + rAF 渲染)
```
- `src/game/` 与 `oneEuro.ts` 为纯逻辑,不触 DOM,全部 Vitest 单测(TDD:先失败测试后实现)。
- 渲染/音频薄层,经鼠标模式 + 浏览器预览实测。
- 波次生成用可注入种子的 RNG,保证测试确定性。

## 8. 工程与交付

- Vite + TypeScript(strict)+ Vitest;无 React、无 Three.js。
- `@mediapipe/tasks-vision` 唯一运行时依赖;postinstall 脚本(fetch-assets.mjs)下载
  hand_landmarker.task 到 public/models、复制 wasm 到 public/wasm(沿用已验证模式)。
- dev 端口 5178;`启动.bat`(GBK 编码)一键装依赖 + 开浏览器。
- MIT LICENSE;中文 README(玩法 / 运行 / 测试 / 隐私说明)。
- 新公开 GitHub 仓库 `jiang4wqy/ink-slash`;.gitignore 排除 node_modules/dist/public 生成物。

## 9. 验证标准

1. `npm test` 全绿(滤波 / 碰撞 / 物理 / 波次 / 计分连击 / 状态机 / 速度门槛)。
2. `tsc` 零错误、`npm run build` 成功。
3. 浏览器预览鼠标模式端到端:进游戏 → 模拟指针快挥斩果 → 得分增长 → 漏 3 果终局 → 再来一局。
4. 多代理对抗式代码审查通过后再推 GitHub。
5. 真实摄像头手感由用户验收(开发环境无摄像头)。

## 10. 明确不做(YAGNI)

多模式(禅模式/限时)、排行榜联网、灵敏度滑块、webfont、图片/音频资产、移动端专项优化。
