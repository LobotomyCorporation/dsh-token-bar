# dsh-token-bar

[![npm](https://img.shields.io/npm/v/dsh-token-bar.svg)](https://www.npmjs.com/package/dsh-token-bar)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面加一条**单轮 token 用量条**。它住在每条回复自己的图标行里（复制 / 分支 / 用量 / 时间那一行）：灰是未缓存输入，黄是缓存读取，绿是输出，旁边跟一份写着百分比的图例。回复落定，这一轮的缓存结构就已经画在眼前。

![回复图标行里的单轮用量条：灰=未缓存输入、黄=缓存读取、绿=输出，后面跟带百分比的图例](docs/screenshot-turn-bar.png)

整个插件是个纯展示层的小东西：不联网、不落盘、不注册任何 Host 路由、不写会话日志，也不碰任何官方包。零依赖——一个手写 bundle，只借平台自带的 React 用一下。

[English](README.en.md) | 中文

---

## 为什么写它

跑长任务的时候，最想看清楚的其实是**每一轮**的账：这一轮是不是基本全命中缓存？有没有突然冒出一大截未缓存输入——那通常意味着前缀失效，这一轮的成本会明显抬高？输出占比正不正常？

DSH 官方其实已经给了答案：每条回复末尾的用量气泡点开，能看到「本轮用量」的精确数字。问题不在数字缺不缺，而在于**读数字太慢**——三四个数扫一眼还行，几十轮对话盯下来眼睛会累，而且比例关系要自己在脑子里拼。

所以我把它画了出来。三个数字变成一条三段带：近乎全命中时整条几乎全黄；前缀失效，灰段会立刻鼓起来；输出异常长，绿段就占掉小半条。旁边配一份**常驻图例**——色点、名称、百分比都写在明面上，不用悬停、不用背颜色含义，扫一眼就走。

精确数字仍以官方弹窗为准：两者同源同口径。条负责形状，弹窗负责明细，互不抢戏。

## 它长什么样，以及为什么是这个样子

**三段，顺序固定**：灰（未缓存输入）→ 黄（缓存读取）→ 绿（输出）。条与图例完全同序，从左往右读就是输入到输出的流向。

**132px 的条宽**是折中的结果：再窄，三段同时触发最小可视宽度时会互相挤；再宽，就在图标行里喧宾夺主。

**6px 最小段宽**：只要有 token，这一段至少画 6px。0.1% 的输出也看得见——图例写着 0.1%，你在条上就一定能找到那一小截。条和图例永远对得上，不会出现「图例说有、条上没有」的尴尬。

**图例常驻**。不搞「悬停才显示」那套：悬停适合放补充信息，不适合放理解所必需的信息。

**字号比正文小一号**：`calc(var(--dsh-content-font-size-secondary, 13px) - 1px)`，跟着 DSH 设置里的字号一起缩放。配色全部走 `--dsw-*` 主题 token，浅色深色自动跟随，不硬编码任何颜色。整条在图标行里垂直居中，不撑高那一行。

悬停给出本轮完整明细：缓存命中率，加上每一段的精确 token 数与占比。平时扫一眼，想抠数字的时候再悬停。

> 缓存写入没有单独成段——当前路由上这个值恒为 0，画出来只会是一条永远为空的段。

## 数字从哪来

条读的是本轮 `turn-tail` location data 里的 `tokenUsage`——**本轮**的账，和官方「本轮用量」弹窗同源同口径，不是会话累计。会话累计回答「我一共花了多少」，单轮账回答「刚才那一轮发生了什么」；两个问题都有用，但只有后者能告诉你前缀是哪一轮失效的。

反查的路径值得一提：`conversation.chat.assistant-actions` 这个插槽只把**消息 id** 交给组件，账没有跟过来，所以组件拿 id 通过 `useChat` 回头找。每条完成的 Turn 都会发布一份 `turn-tail`，里面带着它自己的 `tokenUsage`；找到之后，再把**轮内每一条**回复的 id 都登记进索引——会话节点里记着属于这一轮的全部助手消息。

这个「每一条」是新版本特意补上的。任务跑到一半你插了句话（「等等，先换个思路」），这轮并不会就此结束，而是带着新指示继续跑完——于是一个轮里会有多条回复。旧版只把账挂在收尾那条回复上，插队之前那条就查无此账、没有条；现在轮内所有回复都挂**同一份**账，看哪条都是这个数，和官方弹窗的口径完全一致。

`useChat` 是会话级插槽的标配（`dsh-client-ui-chat` 的 `slots.d.ts` 把它挂在 `SessionStandardProps` 上），不需要额外注入什么。

感谢 [dsh-token-counter](https://github.com/OkliaoliO/dsh-token-counter) 提供的实现参考。

## 装上就用

已发布到 npm：[dsh-token-bar](https://www.npmjs.com/package/dsh-token-bar)

```sh
# 从 npm 安装（推荐）
dsh plugin --profile web add dsh-token-bar

# 或直接用 npm 装进项目
npm i dsh-token-bar
```

开发时也可以直接指向本地目录：

```sh
dsh plugin --profile web add /path/to/dsh-token-bar
```

装完**重启 `dsh web`** 才生效。不想要了：

```sh
dsh plugin --profile web remove dsh-token-bar
```

## 兼容性

| 组件 | 支持 |
|---|---|
| DSH | `>=0.2.0-rc.1 <0.3.0-0`，在 `0.2.0-rc.2` 上实测 |
| Node.js | `>=20` |
| 界面 | DSH Web（依赖 `conversation.chat.assistant-actions` 插槽） |
| 系统 | macOS / Linux / Windows（纯 JavaScript） |

## 开发与自检

```sh
npm run check   # 语法检查
npm test        # 纯函数测试 + 渲染测试
```

`npm test` 默认验证**源码** `client.js`。想验证浏览器实际收到的那份构建产物，从运行中的 `dsh web` 抽一份快照再跑一遍：

```sh
node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/?token=<启动时打印的 token>"
npm test        # 检测到 verify-module.js 后，自动改为测试服务端下发的产物
```

### 网络受限时推送

如果所在网络访问不了 `github.com:443`（`git push` 卡住超时）但 `api.github.com` 能通，走 REST API 推送：

```sh
node scripts/push-via-api.mjs <owner>/<repo> --dry-run   # 先看要推什么
node scripts/push-via-api.mjs <owner>/<repo>             # 真正推送
```

它会按 blobs → trees → commits 重放本地历史，再把分支指向**远端生成的**新 commit——API 创建的 commit SHA 和本地不同，本地 `git log` 对不上是正常的。

## 想改样式

没有设置界面，但常用的都集中在 `client.js` 顶部：

| 常量 | 作用 |
|---|---|
| `BUCKETS` | 三段定义（顺序、名称、颜色） |
| `MIN_SEGMENT_PX` | 最小段宽，默认 `6` |
| `TRACK_PX` | 条宽，默认 `132` |
| `FONT_SIZE` | 字号，默认比正文小一号 |

## 已知限制

- 条只出现在**已完成**（`turn/end`）的轮次上，正在流式输出的那一轮要等结束才有。轮内每条回复挂同一份账（插队消息之前那条也有）；被中止、收尾又没有持久 id 的轮（收尾是拿流式 chunk 拼出来的合成消息）仍可能没有条。
- **图标行会常驻**。官方默认只让最新一条回复的图标行一直显示，更早的回复要悬停才淡入——条会跟着一起淡出去。为了不让它忽隐忽现，插件把助手那一行固定为可见，作用范围只限带 `data-clock="end"` 的行，用户气泡不受影响；代价是每条回复的图标行都常显。
- **条的位置是官方定的**。图标行的排列硬编码为「复制 → 插件动作 → 分支 → 用量 → 时间」，留给插件的唯一插槽在复制和分支之间，所以条落在用量左侧，而不是「用量和时间之间」——那里没有插槽。
- 数据依赖官方 `turn-tail` 的结构；DSH 若改动该结构，需要跟着适配。
- 没有设置界面，改样式得动源码（好在都集中在文件顶部）。

## 许可

MIT
