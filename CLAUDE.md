# cc-terminal — 桌面 Agent 编排客户端

> 本文件是 Claude Code 进入本项目时的第一上下文，承接 `~/.claude/CLAUDE.md` 全局规范。任何贡献者（含 AI agent）开工前必须先读完本文件，再动代码。
>
> Stack 调整提示：本项目前端默认 React + Vite + TS，后端 Tauri 2.x，agent 驱动层用 Claude Agent SDK。若需替换需先在本文件 §3 更新决策记录，再改实现，不允许反向。

---

## 1. 项目身份

- **名称**：cc-terminal
- **定位**：桌面版 Codex 风格 agent 编排客户端。以 Claude Agent SDK 为驱动层，在 Tauri 桌面壳内 host agent loop——自己控制 system prompt、注入工具、统一调度多实例。类比关系 ≈ Codex desktop 之于 ChatGPT。
- **核心价值**：
  1. **Host, not shell**：不再包 CLI，而是 embed Agent SDK 直接驱动 agent loop。skills / MCP / subagent / hooks 自动继承。
  2. **单 agent 默认，多 agent 按需**：99% 时间单 thread 对话；需要时手动派发到独立 git worktree 并行跑多 agent。
  3. **token 消耗与成本是第一公民**：永远在视野内（顶部 statusline token gauge 记忆点）。
- **目标用户**：作者本人 + 后续 GitHub 开源使用者。
- **平台**：Windows 优先开发与验证；macOS / Linux 通过 Tauri 跨平台能力同步发布。

---

## 2. 核心功能边界

### 2.1 Agent 驱动层

**驱动方式**：每个 agent = 一个 Node.js sidecar 进程，内部跑 `@anthropic-ai/claude-agent-sdk` 的 `query()`。Rust 后端 spawn sidecar → stdin/stdout NDJSON 双向桥接 → 前端消费事件流渲染对话。

**认证**：SDK 自动读 `~/.claude/.credentials.json` 的 OAuth 凭据（Pro/Max 订阅）。**不需要 ANTHROPIC_API_KEY**——Rust spawn sidecar 时显式 `env_remove("ANTHROPIC_API_KEY")` 防止环境变量覆盖 OAuth。

**默认模型**：`claude-opus-4-6`（硬编码），v1.0 再做模型切换 UI。

**能力继承**（通过 Agent SDK 自动获得）：

- Skills / MCP servers / Hooks
- Sub-agents（`Agent` 工具与各类 `subagent_type`）
- Permission 模式
- Plan Mode

### 2.2 UI 布局（以 Codex 桌面为模板）

三栏布局：

| 栏 | 内容 | 默认状态 |
|----|------|----------|
| 左 ProjectList | 项目分组 + Thread 列表，每条 Thread 带状态点（● 运行 / ◐ awaiting / ○ idle / ✕ crashed / ✓ done） | 展开 240px，可折回 56px |
| 中 ActiveThread | 当前 Thread 对话流：Header + Messages（Markdown + tool-call 卡片）+ Composer（输入框 + 运行模式 picker：Local / Worktree） | 主舞台，常驻 |
| 右 TaskSidebar | Plan / Sources / Artifacts / Diff（worktree 待审变更 + 分块暂存 + inline comment） | 默认折叠，按需展开 |

### 2.3 Team 模式（多 agent 群聊协作）

- **独立窗口**：Team Chat 在单独 Tauri 窗口中运行（`WebviewWindow`），不影响主窗口对话
- **TL + Members 架构**：Team Lead 协调 + Members 专长分工，角色差异通过 system prompt 实现
- **@mention 路由**：无 @mention → 消息发 TL；`@member-name` → 直达指定 member
- **统一消息流**：所有 agent 的响应按时间排列在同一聊天流中，通过角色 badge（TL 琥珀 / Member 青苔绿）区分来源
- **动态成员管理**：运行时添加/移除 member agent（每个 = 独立 sidecar 进程）
- **事件隔离**：team agent 的 stdout 走 `team:line` 事件，不走 `agent:line`，两个视图互不干扰
- **主界面内嵌**：Team Chat 嵌入主界面（中栏 GroupChatView + TeamComposer，右栏 TeamSidebar），通过 `activeTeamId` 切换，左栏 ProjectList 保持不变
- 左栏 ProjectList 中列出活跃 Teams，点击切换；点击普通 Thread 回到对话模式

### 2.4 辅助面板（v1.0 收尾阶段）

| 面板 | 能力 |
|------|------|
| Token 看板 | 聚合所有 Thread 的 input / output / cache_read / cache_write；估算成本 |
| 设置 | 默认模型、主题切换；读写 `~/.claude/settings.json` 的合法字段 |
| Skills / MCP | 装载与管理 |

### 2.5 非目标

- 不重新实现 Agent SDK 内核。
- 不做 IDE 功能（编辑器 / 文件树编辑）；但 Diff 面板做分块审查。
- 不做云同步、不做账号系统；所有数据本地。
- 不做 AutoClaw 式 Kanban 看板——多 agent 用 Codex 式 Thread 列表切换。

### 2.6 CLI 功能映射表

cc-terminal 不包 CLI，但要覆盖等价能力。每项 CLI 功能标记为三种策略之一：

- **native**：SDK 原生继承，零额外代码
- **self-build**：SDK 提供底层能力，cc-terminal 自建 UI / 逻辑
- **skip**：桌面客户端场景下不适用，不实现

#### Slash 命令

| CLI 命令 | 策略 | cc-terminal 实现方式 |
|----------|------|----------------------|
| `/help` | self-build | 命令面板（Cmd+K）+ 帮助抽屉 |
| `/clear` | self-build | 清空当前 Thread 消息，重置 SDK conversation |
| `/compact` | self-build | SDK compaction API，Composer 工具栏按钮或自动触发 |
| `/cost` | self-build | TokenGauge（statusline 记忆点）+ Token 看板面板 |
| `/config` | self-build | Settings 面板 |
| `/model` | self-build | Settings 面板模型选择 / statusline 快捷切换 |
| `/permissions` | self-build | 权限管理 UI（当前模式显示 + 切换） |
| `/memory` | self-build | Memory 文件浏览 / 编辑面板 |
| `/login` | self-build | OAuth 状态检测 + 登录引导流程 |
| `/doctor` | self-build | 诊断面板（SDK 连通性、sidecar 状态、依赖检查） |
| `/review` | native | SDK 继承 skill，命令面板触发 |
| `/init` | native | SDK 继承 skill，命令面板触发 |
| `/bug` | skip | 桌面端有自己的反馈入口（Help → Report Bug） |
| `/logout` | skip | 桌面端不管理 CLI 登录态 |
| `/vim` `/emacs` | skip | Composer 组件有独立编辑体验，不模拟终端编辑模式 |

#### CLI Flags

| CLI Flag | 策略 | cc-terminal 实现方式 |
|----------|------|----------------------|
| `--system-prompt` | native | sidecar `hello` 消息 `systemPrompt` 字段 |
| `--cwd` | native | sidecar `hello` 消息 `cwd` 字段 |
| `--allowedTools` | native | sidecar `hello` 消息 `allowedTools` 字段 |
| `--model` | self-build | Settings 面板 / sidecar `hello` 消息 `model` 字段 |
| `--resume` | self-build | 自建 conversation history 序列化，恢复时重新注入 SDK |
| `--max-tokens` | self-build | Settings 面板，传入 sidecar 配置 |
| `--verbose` | self-build | 消息卡片展开/折叠（tool_use 详情、system-reminder 等） |
| `--print` | skip | 输出格式由 UI 层决定 |
| `--output-format` | skip | 同上 |
| `--input-format` | skip | 同上 |
| `--dangerously-skip-permissions` | skip | 桌面端必须有权限确认 UI，不允许跳过 |

#### 核心能力

| 能力 | 策略 | cc-terminal 实现方式 |
|------|------|----------------------|
| 对话 / tool use | native | SDK `query()` 核心循环 |
| Skills | native | SDK 自动加载 |
| MCP servers | native | SDK 自动连接 |
| Hooks | native | SDK 自动执行 |
| Sub-agents | native | SDK `Agent` 工具 + `subagent_type` |
| Plan Mode | native | SDK 内置，TaskSidebar 展示 |
| Permission 确认 | self-build | SDK permission callback → 自渲染确认弹窗 |
| Context compaction | self-build | SDK compaction API → 自动/手动触发 |
| 会话持久化 | self-build | conversation messages 序列化到本地，恢复时 feed SDK |
| Token 追踪 | self-build | SDK usage 事件 + jsonl 聚合 → TokenGauge + 看板 |
| ANSI 终端渲染 | skip | Markdown + tool-call 卡片替代 |

---

## 3. 技术栈

| 层 | 选型 | 理由 |
|----|------|------|
| 桌面 shell | Tauri 2.x（Rust） | 体积小、安全沙箱好、原生 webview |
| Agent 驱动 | `@anthropic-ai/claude-agent-sdk`（Node.js sidecar） | 拿到 Claude Code 内核能力（skills/MCP/subagent/hooks），不走 CLI 隔靴搔痒 |
| Sidecar 打包 | `pkg` → 单 `.exe`，走 Tauri `externalBin` | 避开 Windows .cmd shim「未响应」陷阱 |
| 前端框架 | React 19 + Vite + TypeScript strict | 生态最稳，Tauri 官方模板支持 |
| 样式 | TailwindCSS + CSS Variables | 主题切换无负担 |
| 状态管理 | Zustand | 轻量、无样板 |
| 消息渲染 | `react-markdown` + `shiki` | Markdown + 代码块语法高亮 + tool-call 卡片 |
| 图表 | Recharts | Token 看板用 |
| 包管理 | pnpm | 锁文件稳定、磁盘友好 |

---

## 3.1 设计语言：Operator Console

按 `frontend-design` skill 方法论敲定。**禁止偏离以下锚点**——任何"AI 默认审美"（紫色渐变、圆角玻璃拟物、Inter 字体、cookie-cutter dashboard）都视为质量不合格。

**调性**：终端血脉 + 编辑级排版纪律。参照对象——Bloomberg Terminal 的信息密度 × Working Copy 的克制 × Linear 的反馈精度。不是赛博朋克，不是科技蓝紫。

**字体（禁用列表 + 选用列表）**：

- ❌ 禁用：Inter / Roboto / Arial / SF Pro / Space Grotesk / Helvetica / 任何系统默认无衬线
- ✅ 数据 / 代码 / 数字：**IBM Plex Mono**（开启 `font-variant-numeric: tabular-nums`，所有 token 数字、cost、时间戳走它）
- ✅ 正文 / UI：**IBM Plex Sans**（500 / 600 字重）
- ✅ 标题 / 品牌点缀：**IBM Plex Serif**（仅 Logo、空状态、章节大标题，制造编辑感反差）

**色板（双主题，单一信号色）**：

- 浅色：底 `#F4EFE6`（米白纸感）/ 墨 `#1A1814` / 边 `#E5DFD3`
- 深色：底 `#0A0A0A`（真黑）/ 字 `#E8E4DA` / 边 `#1F1F1F`
- **信号色：朱砂 `#D33F2A`**——只用于成本告警、token 超阈值、删除确认；其他场景一律不出现。
- 中性强调：琥珀 `#C68A2E`（cache hit 提示）、青苔绿 `#5C7A3F`（success / idle）

**版式**（Codex 桌面风：三栏 + 对话沉浸 + 极致留白）：

- 三栏：左 ProjectList（240px，可折叠至 56px）+ 中 ActiveThread（主舞台）+ 右 TaskSidebar（默认折叠，展开 320px）
- 顶部 statusline 融合所有运行时状态：active thread · model · cwd · permission · token gauge（瘦身版）
- 中央对话流 `max-w-[72ch]` 居中，padding `py-12 px-16`，让对话流呼吸
- 底部大权重 composer + 运行模式 picker（Local / Worktree）
- 左栏 Thread 列表每条带状态点：● 琥珀（运行中）/ ◐ 朱砂（awaiting）/ ○ 灰（idle）/ ✕ 朱砂（crashed）/ ✓ 青苔绿（done）
- 大量负空间，分隔线用 1px 细线 + 微缩 ASCII 装饰（`├──`、`◆`、`·`），**禁止 box-shadow 堆质感**
- 数字一律 tabular-nums，对齐成"账本"

**动效（克制原则）**：

- 光标稳定闪烁 1.06s
- 新消息单帧高亮淡出 200ms
- token 数字滚动用平滑数值动画，**不要 spring bounce**
- 禁止滑入 / 弹跳 / 缓动堆叠

**纹理**：

- 深色模式 1% 不透明 noise overlay；浅色模式无
- 卡片用 0.5px 内描边 + 微微 inset 高光，**禁止 drop-shadow 堆叠**

**记忆点（不可移除）**：

> **顶部 statusline 右侧的瘦身 token gauge**——单行三段彩条（input · output · cache）+ Mono 数字（k/M 格式），超阈值瞬间切朱砂。它常驻视野，永不滚动出屏。这是 cc-terminal 的视觉签名，承载 §2 核心价值"token 永远在视野内"。

---

## 4. 目录结构约定

```
cc-terminal/
├── CLAUDE.md                  # 本文件（约束基线）
├── README.md                  # GitHub 门面（发布前补）
├── LICENSE                    # MIT
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── agent-sidecar/             # Node.js sidecar（Agent SDK 驱动）
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   └── index.ts           # 入口：stdin/stdout NDJSON ↔ SDK query()
│   └── dist/                  # pkg 构建产物（不入 git）
├── src/                       # 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/            # 通用 UI 组件（PascalCase 文件夹）
│   │   ├── StatusBar.tsx      # 顶部 statusline（保留）
│   │   ├── TokenGauge.tsx     # token 三段彩条（保留，记忆点）
│   │   ├── ThemeToggle.tsx    # 主题切换（保留）
│   │   ├── ConfirmDialog.tsx  # 写操作确认对话框（红线合规）
│   │   ├── SlashCommandPopup.tsx # Slash 命令自动补全弹窗
│   │   ├── ResizeDivider.tsx  # 可拖拽分割线（水平/垂直）
│   │   ├── ThreadTabBar.tsx  # 中栏 VS Code 风格标签页
│   │   └── SettingsPanel.tsx # 设置面板（语言选择器）
│   ├── features/
│   │   ├── agents/            # 核心功能区
│   │   │   ├── ProjectList.tsx      # 左栏：项目 + Thread 列表
│   │   │   ├── ThreadView.tsx       # 中栏：Header / Messages / Composer
│   │   │   ├── TaskSidebar.tsx      # 右栏：Plan / Sources / Artifacts / Diff
│   │   │   └── NewThreadDialog.tsx  # +Thread 弹窗
│   │   ├── console/           # Extensions 管理面板
│   │   │   ├── SkillsPanelContent.tsx   # Skills 管理（搜索/过滤/安装/卸载）
│   │   │   ├── McpPanelContent.tsx      # MCP servers 管理（列表/toggle/添加）
│   │   │   ├── PluginsPanelContent.tsx  # Plugins 查看（只读 + 外链）
│   │   │   └── HooksPanelContent.tsx   # Hooks 查看（只读，按事件分组）
│   │   └── team/              # 多 agent 群聊协作（独立窗口）
│   │       ├── TeamChatContent.tsx       # Team 中栏组件（事件监听 + GroupChatView + Composer）
│   │       ├── GroupChatView.tsx        # 统一消息流（多 agent 交错显示）
│   │       ├── TeamComposer.tsx         # 输入框 + @mention 补全
│   │       ├── TeamSidebar.tsx          # 成员列表 + 状态 + 添加/解散
│   │       ├── AddMemberDialog.tsx      # 添加成员对话框
│   │       └── CreateTeamDialog.tsx     # 创建 Team 对话框（主窗口触发）
│   ├── lib/                   # 通用工具（fmt、time、cost-calc、commands）
│   │   ├── commands.ts        # Slash 命令注册表 + 执行逻辑
│   │   └── useSlashCommands.ts # 共享 hook：命令检测 / 过滤 / 键盘导航
│   ├── i18n/                  # 国际化（Zustand + 对象映射）
│   │   ├── zh.ts              # 中文翻译（默认语言，导出 TranslationKey 类型）
│   │   ├── en.ts              # 英文翻译（类型受 zh.ts 约束）
│   │   └── index.ts           # useT() hook + t() 辅助函数
│   ├── store/
│   │   ├── agents.ts          # Zustand：projects / threads / activeThreadId
│   │   ├── console.ts         # Zustand：skills / mcpServers / plugins / hooks
│   │   ├── settings.ts        # Zustand：locale + localStorage 持久化
│   │   └── team.ts            # Zustand：team config / agents / messages
│   └── styles/                # tailwind base + 主题变量
├── src-tauri/                 # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── binaries/              # sidecar .exe 放置点（不入 git）
│   └── src/
│       ├── main.rs
│       ├── commands/          # #[tauri::command]，按功能切片
│       │   ├── agents.rs      # sidecar 生命周期：spawn / kill / list / send
│       │   ├── worktree.rs    # git worktree add / remove / list
│       │   ├── usage.rs       # jsonl 聚合（继承 v1 tokens 逻辑）
│       │   ├── skills.rs      # ~/.claude/skills/ 扫描 + 安装/卸载
│       │   ├── mcp.rs         # settings.json mcpServers 读写
│       │   ├── plugins.rs     # installed_plugins.json 只读
│       │   ├── hooks.rs       # settings.json hooks 只读（全局 + 项目级）
│       │   └── team.rs        # TeamState + 多窗口 team 生命周期 + 消息路由
│       ├── claude_paths.rs    # 解析 ~/.claude 目录的统一入口（只读）
│       └── pricing.rs         # 模型单价表（版本化）
└── docs/                      # 设计稿、ADR、smoke-test 清单
```

**新文件落地规则**：先在本文件 §4 更新树状图，再 `git add`。文件不允许出现在未列规划目录里。

---

## 5. 命名规则

| 对象 | 规则 | 示例 |
|------|------|------|
| React 组件文件 | PascalCase.tsx | `TokenGauge.tsx` |
| TS hooks / utils | camelCase.ts | `useSessionStream.ts` |
| Rust 模块 | snake_case.rs | `claude_paths.rs` |
| Tauri command | snake_case | `list_sessions`、`stream_chat` |
| 前端文件夹 | kebab-case | `features/token-dashboard/` |
| 组件文件夹 | PascalCase | `components/TokenGauge/` |
| CSS 变量 | `--kebab-case` | `--color-signal-vermilion` |
| 类型 / interface | PascalCase | `Session`、`TokenStat` |

---

## 6. 数据契约（核心）

### 6.1 Sidecar NDJSON 协议

**前端 → sidecar (stdin)：**
```
{"type":"hello","cwd":"<abs path>","systemPrompt":"...","model":"claude-opus-4-6","allowedTools":[...],"permissionMode":"acceptEdits"}
{"type":"user","content":"重构 src/foo.ts 让它支持流式"}
{"type":"interrupt"}
{"type":"shutdown"}
```

**sidecar → 前端 (stdout)：**
```
{"type":"event","data":<SDK event 原始透传>}
{"type":"usage","input":1234,"output":456,"cache_read":7890,"cache_write":11,"costUsd":0.0234}
{"type":"status","state":"idle|thinking|tool_use|awaiting_input|done"}
{"type":"error","message":"..."}
```

### 6.2 Token 数据来源（不允许另造）

- **路径**：`~/.claude/projects/<project-hash>/<session-uuid>.jsonl`
- **格式**：每行一个 JSON
- **关注字段**：`message.usage.{input_tokens,output_tokens,cache_creation_input_tokens,cache_read_input_tokens}`、`message.model`、`timestamp`
- **聚合粒度**：日 / 周 / 月 × 项目 × 模型
- **成本估算**：`src-tauri/src/pricing.rs` 内置版本化模型单价表，覆盖 Opus / Sonnet / Haiku 各档 input / output / cache。单价表更新时同步 bump pricing 模块版本号。

### 6.3 前后端共享类型

TS 端定义 `Thread / Project / Message / Artifact / GitDiff` 接口，Rust 端用 `serde` derive 对应 struct。两侧字段对齐通过 `ts-rs` 自动生成（首选）或人工 review（次选）。

---

## 7. 红线（继承全局 CLAUDE.md，加项目特化）

**即使在 auto-accept 模式下，碰到以下操作必须停下来问用户**：

1. 写入或修改 `~/.claude/settings.json`、`~/.claude/CLAUDE.md`、`~/.claude/.credentials.json`（用户私域）。
2. 触碰 `~/.claude/projects/` 下任何 jsonl 文件——**只读**，损坏即丢失会话历史。
3. 删除 / 迁移 / 重写用户已安装的 skills、plugins、MCP servers。
4. 任何形式的 API key / token 泄露：进代码、进 commit、进日志、进异常栈、进网络请求 body。
5. `git push`、`git rebase`、`git reset --hard`、强制推送。
6. 公开发布动作：`gh release create`、`npm publish`、Tauri 安装包上传分发渠道。
7. 安装新依赖前先在 PR 描述里列出体积、license、维护活跃度。

---

## 8. 工程纪律

- **改完跑验证**：
  - 前端逻辑改 → `pnpm test` + `pnpm tauri dev` 走一遍受影响 UI 路径
  - Rust 改 → `cargo test` + `cargo clippy --all-targets -- -D warnings`
  - 数据契约改 → 双端类型重新生成并跑端到端 smoke-test
- **类型先行**：先在 `src-tauri` 定义 struct → 生成 TS 类型 → 前端消费。不允许前端先猜字段。
- **不绕错**：jsonl 解析失败时记录该行并跳过，**禁止静默吞错**。错误统一走 `tracing` 落本地日志，不打印到生产终端。
- **大改动先 Plan Mode**：超出单一 feature 切片的修改必须先出方案。
- **commit 粒度**：一个 commit 一件事，commit message 用中文动宾结构（"添加 token 仪表三段式横条"）。

---

## 9. 关键命令速查

```bash
# 安装
pnpm install
cd agent-sidecar && pnpm install
cd src-tauri && cargo fetch

# Sidecar 构建（需在 pnpm tauri dev 之前）
cd agent-sidecar && pnpm build   # pkg → cc-agent-sidecar-<triple>.exe
# 产物自动拷到 src-tauri/binaries/

# 开发
pnpm tauri dev

# 构建
pnpm tauri build

# 验证
pnpm test            # 前端单测
cargo test           # Rust 单测
pnpm lint            # eslint + prettier
cargo clippy --all-targets -- -D warnings
pnpm typecheck       # tsc --noEmit
```

---

## 10. GitHub 发布前清单（owner 意识，闭环再上线）

- [ ] `README.md`：截图 + 安装说明 + 功能列表 + 设计语言简述
- [ ] `LICENSE`：MIT
- [ ] `.gitignore` 至少包含：`node_modules/`、`src-tauri/target/`、`dist/`、`.env*`、`.DS_Store`
- [ ] 全文 grep：`grep -r "sk-ant-"`、`grep -r "F:\\\\claude_project"`，确保无 API key 与作者本地绝对路径
- [ ] CI（GitHub Actions）：lint + test + cross-platform build（Win / macOS / Linux）
- [ ] release：`tauri-action` 自动产出三平台安装包
- [ ] 能力对等 smoke-test 通过（≥10 项能力清单全绿）
- [ ] **必须用户人工确认才能 `git push origin main` 与 `gh release create`**——红线第 5、6 条

---

## 11. 决策记录（ADR 简版）

| 日期 | 决策 | 理由 |
|------|------|------|
| 2026-04-29 | 选 Tauri 而非 Electron | 体积小、Rust 后端、安全沙箱 |
| 2026-04-29 | CLI 桥接而非重新实现 Agent | 能力对等性硬约束，1:1 等价 |
| 2026-04-29 | Token 源 = 本地 jsonl | 与 `/cost` 同源，无鉴权成本 |
| 2026-04-29 | 设计语言 = Operator Console | 反 AI slop，IBM Plex 三件套 + 朱砂单点信号 |
| 2026-04-29 | Step 1 脚手架完成 | Tauri 2 + React 19 + TS strict + Tailwind 3.4 + IBM Plex 三件套；三栏壳 + ThemeToggle + TokenGauge stub；CLAUDE.md 受 robocopy `/XF` 保护未被覆盖 |
| 2026-04-29 | Step 1.5 改用 Codex CLI 风版式 | 三栏密集 → 对话沉浸单栏 + 56px IconRail + 顶部 StatusBar；TokenGauge 记忆点从右下角迁到顶部 statusline，承载"token 永远在视野内"诉求 |
| 2026-04-29 | Step A 用量看板前端壳 | TokensView + Recharts 折线图 + KPI 四宫格 + 模型 / 项目双表；IconRail 受控视图切换；演示数据 fixtures 临时占位 |
| 2026-04-29 | Step B 接入真实 jsonl | Rust `commands/tokens.rs` 流式扫 ~/.claude/projects/**/*.jsonl，pricing.rs 单价表（v2026-04，含 Opus 1M 溢价）；前端删 fixtures.ts，TokensView + AppShell 通过 useTokenStats 共用真数据；3 个 pricing 单测全绿，clippy `-D warnings` 通过 |
| 2026-04-29 | Step C pty 桥接 claude CLI | Rust `commands/chat.rs` 用 portable-pty 起子进程 + std::thread 阻塞读 reader 流式 emit；4 个命令 spawn_chat / chat_input / chat_resize / chat_kill；前端 PtyTerminal（xterm + FitAddon + ResizeObserver + 主题 MutationObserver）；ChatView 常驻 DOM 解决视图切换 kill session 问题；clippy 0 警告 |
| 2026-04-29 | 排期决策：功能先于视觉 | 用户决定先把 Skills / 会话管理 / Plugins / 设置 全部做完，再做整体 UI 优化。每一步功能保持当前 xterm 渲染不变 |
| 2026-04-29 | UI 范式重构待办（Step F） | xterm 终端流 → VS Code 插件式（消息气泡 / Markdown / tool-call 卡片 / 折叠 system-reminder）。底层切换：spawn 时加 `--output-format stream-json` 拿 NDJSON；slash 命令 / permission 切换需要自渲染 UI。计划在所有功能闭环后整体重构，xterm 模式保留为"专家模式"备选 |
| 2026-04-29 | Step D Skills 面板（只读版） | Rust `commands/skills.rs` 扫 ~/.claude/skills/ + 子目录递归识别 plugin-namespaced；前端 SkillsView 双栏（左列表按命名空间分组 + 搜索过滤，右详情）；3 个 frontmatter 单测全绿。启停 / `/skill-vetter` 触发留 Step D2（涉 settings.json 红线） |
| 2026-04-29 | Step E 会话管理 | Rust `commands/sessions.rs` peek 每个 jsonl 头 64 行抓 cwd / firstTs，文件 mtime 当 lastTs；前端 SessionsView 按 cwd 分组 + 搜索；ChatView 通过 key={resumeId} 强制重建 + spawn `claude --resume <uuid>` |
| 2026-04-29 | Step F Plugins 面板（只读版） | Rust `commands/plugins.rs` 读 installed_plugins.json + 每个 .claude-plugin/plugin.json；前端 PluginsView 双栏 + 详情显示版本/作者/许可/路径；启停 / 升级 / 卸载留 Step F2 |
| 2026-04-29 | Step G Settings 面板（只读版） | Rust `commands/settings.rs` 读 settings.json + claude --version；前端 SettingsView 展示 theme / effortLevel / 启用插件数 / 完整 raw JSON 折叠；明确写操作触发红线，留 Step G2 |
| 2026-04-29 | Step H1+H4 双模式对话视图 | 实测验证 `--print --input-format/--output-format stream-json --verbose --include-partial-messages` 持续会话可行；新建 chat_json.rs 用 std pipe 而非 pty 桥接；前端 MessageView 自渲染消息气泡（user/assistant blocks/tool_use/tool_result/result）；ExpertView 保留 xterm 模式作"专家"备选；ChatView 顶部 toggle 切换。原 ADR 关于"slash 命令需自渲染"的悲观结论被推翻——init 事件显示 -p 模式下 tools/skills/slash_commands 全部可用 |
| 2026-04-29 | Step I 修复主线程阻塞「程序未响应」 | 所有 `#[tauri::command]` 同步 `pub fn` 全部改 `pub async fn`；IO 重活用 `tauri::async_runtime::spawn_blocking` 移到阻塞线程池。v2 全程沿用此纪律 |
| 2026-04-30 | **v2 Pivot：CLI shell → Agent 编排客户端** | 从「包 CLI」升级到「embed Agent SDK」。删除 chat.rs / chat_json.rs / sessions / skills / plugins / settings / portable-pty。驱动层改 Claude Agent SDK + Node.js sidecar（pkg 打包单 .exe → Tauri externalBin）。UI 以 Codex 桌面为模板——三栏布局（ProjectList / ActiveThread / TaskSidebar），放弃 VSCode split pane 与 AutoClaw Kanban |
| 2026-04-30 | 认证策略：OAuth，不用 API key | Pro/Max 用户没有 API key。SDK 自动读 `~/.claude/.credentials.json` OAuth 凭据。sidecar spawn 时 `env_remove("ANTHROPIC_API_KEY")` 防覆盖 |
| 2026-04-30 | 默认模型 = `claude-opus-4-6` | 用户选定；v1.0 再做模型切换 UI |
| 2026-04-30 | worktree 根 = `<repo>/.cc-terminal-worktrees/` | 和项目并置、迁移跟随；首次创建时自动追加到 `.gitignore` |
| 2026-04-30 | Team 模式 = 手动派发 + Thread 列表 | 不让主 agent 自动 fan-out（避免失控并行成本）；Codex 风左栏 Thread 切换，**不** split pane |
| 2026-05-16 | §2.6 CLI 功能映射表 | 明确 cc-terminal 对 CLI 每项功能的覆盖策略（native / self-build / skip），作为功能边界契约。不是复刻 CLI，而是同引擎不同车身——桌面端用 SDK 底层能力 + 自建 UI 达到等价或超越 |
| 2026-05-20 | Extensions 管理控制台 | 参照 cc-switch 项目模式，在右侧面板新增 Skills / MCP / Plugins 三个 tab。Skills 支持搜索/过滤/GitHub 仓库浏览/安装卸载；MCP 支持列表/toggle/预设模板添加；Plugins 只读查看。所有写操作经 ConfirmDialog 确认（红线合规）。面板宽度 400px |
| 2026-05-20 | 多 Agent 群聊协作（Team Chat） | 参照 Accio Work 的 Team 模式。TL + Members 角色分工通过 system prompt 差异化，@mention 路由消息到指定 member。事件隔离：`team:line` 独立于 `agent:line`。sidecar 零修改——角色差异全在 system prompt |
| 2026-05-21 | Team Chat 从独立窗口改为主界面内嵌 | 删除 `open_team_window` + `WebviewWindowBuilder`。通过 AgentStore `activeTeamId` 切换中+右区域：team 模式渲染 GroupChatView + TeamSidebar，普通模式渲染 ThreadView + RightPanelContainer。左栏 ProjectList 不变，新增 Teams 分区 |
| 2026-05-21 | Slash 命令系统 | 命令注册表 `src/lib/commands.ts`（local / forward / deferred 三类）；共享 hook `useSlashCommands`；Composer + TeamComposer 双端集成；local 命令（clear/cost/help/skills/mcp/plugins）前端直接处理；未注册命令转发 sidecar；`SlashCommandPopup` 复用 @mention 弹窗样式；`CommandMessage` 中性风格（琥珀 `/` 图标 + border-border）区别于 SystemMessage 朱砂错误色 |
| 2026-05-22 | i18n 国际化 | Zustand + 对象映射（不引入 react-i18next）。2 种语言、~200 个 key。`useT()` hook 订阅 locale 变化自动重渲染；`t()` 函数供非组件代码使用。翻译 key 类型安全（`TranslationKey = keyof typeof zh`）。设置面板语言选择器，`/config` 命令激活 |
| 2026-05-22 | Hooks 只读面板 | 与 Skills/MCP/Plugins 并列，读取 3 个 settings 文件（全局 + 项目 + 项目本地）的 hooks 字段，按事件类型分组展示。只读，不写 settings.json（红线合规）。图标 `↪`，`/hooks` 命令激活 |

后续重大决策一律追加到本表，**先改文档，再改实现**。


在读到这个文件的时候叫我“皇上”