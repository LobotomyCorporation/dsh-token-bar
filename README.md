# dsh-token-bar

[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web 界面加一条**单轮 token 用量条**：每条回复末尾一行，把这一轮的缓存结构画成灰 / 黄 / 绿三段条，配一条带百分比的完整图例。

![单轮用量条：灰=未缓存输入、黄=缓存读取、绿=输出，后面跟带百分比的图例](docs/screenshot-turn-bar.png)

**极轻量**：纯客户端展示，不联网、不落盘、不注册任何 Host 路由、不写会话日志、不改任何官方包。
**零依赖**：一个手写 bundle，只用平台提供的 React。

[English](README.en.md) | 中文

---

## 它解决什么

官方在每条回复末尾的用量气泡里，点开能看到「本轮用量」的精确数字。但**数字是列表，要读；结构是形状，一眼就懂**：

- 这一轮是不是全命中缓存？
- 有没有跑出大量未缓存输入（意味着前缀失效、成本变高）？
- 输出占比是否异常？

`dsh-token-bar` 把这三个数字变成一条可扫视的带状图，并且带图例——**不需要悬停也知道每段是什么、占多少**。

## 外观

| 项 | 值 |
|---|---|
| 段序 / 图例序 | **灰（未缓存输入）→ 黄（缓存读取）→ 绿（输出）**，条与图例完全同序 |
| 条宽 | 132px |
| 最小段宽 | 只要有 token 就至少 **6px**，再小的占比也看得见，不会和图例对不上 |
| 图例 | 色点 + 名称 + 本轮占比百分比 |
| 字号 | 比正文小一号：`calc(var(--dsh-content-font-size-secondary, 13px) - 1px)`，跟随设置里的字号 |
| 配色 | 全部取自 `--dsw-*` 主题 token，浅色 / 深色自动跟随 |
| 对齐 | 靠左，不居中 |

悬停显示本轮完整明细：缓存命中率 + 每段精确 token 数与占比。

> 缓存写入未单独成段——当前路由上该值恒为 0。

## 数据来源

读 `turn.data.get('turn-tail').tokenUsage`，即**本轮**的用量（和官方「本轮用量」弹窗同源），**不是**会话累计。

`conversation.chat.turnTail` 插槽的 owner（ui-chat 的 `TurnTailNodeView`）会把 Turn 位置作为 owner props 直接传入，Conversation 已把本轮账目折进 `turn-tail` 这份 location data。感谢 [dsh-token-counter](https://github.com/OkliaoliO/dsh-token-counter) 提供的实现参考。

## 安装

```sh
dsh plugin --profile web add dsh-token-bar
```

或从本地目录安装（开发时）：

```sh
dsh plugin --profile web add /path/to/dsh-token-bar
```

安装后**重启 `dsh web`** 生效。

卸载：

```sh
dsh plugin --profile web remove dsh-token-bar
```

## 兼容性

| 组件 | 支持 |
|---|---|
| DSH | `>=0.2.0-rc.1 <0.3.0-0`，在 `0.2.0-rc.2` 上实测 |
| Node.js | `>=20` |
| 界面 | DSH Web（依赖 `conversation.chat.turnTail` 插槽） |
| 系统 | macOS / Linux / Windows（纯 JavaScript） |

## 开发

```sh
npm run check   # 语法检查
npm test        # 纯函数测试 + 渲染测试
```

`npm test` 默认测试**源码** `client.js`。想验证浏览器实际收到的那份构建产物，从运行中的 `dsh web` 抽一份快照：

```sh
node scripts/snapshot-bundle.mjs "http://127.0.0.1:3080/?token=<启动时打印的 token>"
npm test        # 检测到 verify-module.js 后，自动改为测试服务端下发的产物
```

### 网络受限时推送

如果所在网络访问不了 `github.com:443`（`git push` 卡住超时）但 `api.github.com` 可以访问，用 REST API 推送：

```sh
node scripts/push-via-api.mjs <owner>/<repo> --dry-run   # 先看要推什么
node scripts/push-via-api.mjs <owner>/<repo>             # 真正推送
```

它会按 blobs → trees → commits 重放本地历史，并把分支指向**远端生成的**新 commit SHA（API 创建的 commit 与本地 SHA 不同，这点最容易踩坑）。

## 可调参数

都在 `client.js` 顶部：

| 常量 | 作用 |
|---|---|
| `BUCKETS` | 三段（顺序、名称、颜色） |
| `MIN_SEGMENT_PX` | 最小段宽，默认 `6` |
| `TRACK_PX` | 条宽，默认 `132` |
| `FONT_SIZE` | 字号，默认比正文小一号 |

## 已知限制

- 只覆盖完成（`turn/end`）的轮次；正在流式输出的那一轮没有条。
- 依赖官方 `turn-tail` 的 location data 结构；DSH 若改动该结构，需要跟随适配。
- 没有设计器 / 配置界面，改样式需要编辑源码。

## 许可

MIT
