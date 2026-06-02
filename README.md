# cc-terminal

桌面版 Agent 编排客户端。以 Claude Agent SDK 为驱动层，在 Tauri 桌面壳内 host agent loop，自己控制 system prompt、注入工具、统一调度多实例。

**设计语言**：Operator Console — 终端血脉 + 编辑级排版纪律。IBM Plex 三件套 + 朱砂单点信号色。

## 功能

- **Agent 对话**：单 thread 默认，多 thread 按需，每个 agent = 独立 Node.js sidecar 进程
- **Team 模式**：TL + Members 多 agent 群聊协作，@mention 路由消息
- **Token 看板**：实时 token gauge（顶部 statusline 记忆点）+ Cost 面板（匹配 CLI `/cost` 布局）
- **Git 集成**：agent 完成后自动检测变更，支持 stage / commit / push / PR
- **Extensions 管理**：Skills / MCP Servers / Plugins / Hooks 面板
- **Slash 命令**：`/clear` `/cost` `/skills` `/mcp` `/commit` `/pr` 等
- **i18n**：中文 / English 双语
- **双主题**：浅色（米白纸感）/ 深色（真黑）

## 前置条件

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| [Node.js](https://nodejs.org/) | 18+ | sidecar 运行时 |
| [pnpm](https://pnpm.io/) | 9+ | 包管理 |
| [Rust](https://rustup.rs/) | 1.77+ | Tauri 后端编译 |
| [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) | latest | 需已登录（`claude login`），sidecar 读取 OAuth 凭据 |

> **Windows 额外要求**：需要 Visual Studio Build Tools（C++ 桌面开发工作负荷）和 WebView2 Runtime。  
> **macOS**：需要 Xcode Command Line Tools。  
> **Linux**：需要 `webkit2gtk-4.1` 等系统库，详见 [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)。

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/liwenzhonhg-arch/cc-terminal.git
cd cc-terminal

# 2. 安装前端依赖
pnpm install

# 3. 安装并构建 sidecar
cd agent-sidecar
pnpm install
pnpm build
cd ..

# 4. 安装 Rust 依赖
cd src-tauri
cargo fetch
cd ..

# 5. 启动开发模式
pnpm tauri dev
```

## 构建发布版本

```bash
pnpm tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

## 项目结构

```
cc-terminal/
├── agent-sidecar/       # Node.js sidecar（Claude Agent SDK 驱动）
│   ├── src/index.ts     # NDJSON stdin/stdout ↔ SDK query()
│   └── build.mjs        # esbuild 打包脚本
├── src/                 # React 前端
│   ├── features/        # 功能模块（agents / console / team）
│   ├── components/      # 通用 UI 组件
│   ├── store/           # Zustand 状态管理
│   ├── i18n/            # 国际化
│   └── lib/             # 工具函数
├── src-tauri/           # Rust 后端
│   └── src/commands/    # Tauri commands（agents / git / usage / skills / ...）
└── CLAUDE.md            # 项目规范（AI agent 上下文）
```

## 技术栈

- **桌面 shell**：Tauri 2.x（Rust）
- **Agent 驱动**：`@anthropic-ai/claude-agent-sdk`（Node.js sidecar）
- **前端**：React 19 + TypeScript strict + Vite
- **样式**：TailwindCSS + CSS Variables（双主题）
- **状态管理**：Zustand
- **消息渲染**：react-markdown + shiki

## 认证

cc-terminal 使用 Claude CLI 的 OAuth 凭据（Pro / Max 订阅），**不需要 ANTHROPIC_API_KEY**。

确保已登录：

```bash
claude login
```

## 开发命令

```bash
pnpm tauri dev          # 开发模式（热重载）
pnpm typecheck          # TypeScript 类型检查
pnpm lint               # ESLint
cargo clippy --all-targets -- -D warnings   # Rust lint
cargo test              # Rust 单测
```

## License

MIT
