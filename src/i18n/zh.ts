export const zh = {
  // ThemeToggle
  "theme.toggle": "切换主题",
  "theme.light": "浅色",
  "theme.dark": "深色",

  // TokenGauge
  "token.input": "输入",
  "token.output": "输出",
  "token.cache": "cache",
  "token.usage": "token 用量",

  // ConfirmDialog
  "dialog.cancel": "取消",
  "dialog.confirm": "确认",

  // ProjectList
  "sidebar.chats": "对话",
  "sidebar.addFolder": "+ 文件夹",
  "sidebar.addFolderTooltip": "打开文件夹作为新项目",
  "sidebar.workingFolder": "工作目录：{path}\n点击更换",
  "sidebar.noProject": "无项目",
  "sidebar.switchProject": "切换项目",
  "sidebar.newChat": "新对话",
  "sidebar.projects": "Projects",
  "sidebar.chatsCount": " · {count} 个对话",
  "sidebar.removeProject": "移除项目",
  "sidebar.openFolder": "+ 打开文件夹...",
  "sidebar.loadingSessions": "加载会话...",
  "sidebar.noProjectsYet": "暂无项目",
  "sidebar.noChatsYet": "暂无对话",
  "sidebar.teams": "Teams",
  "sidebar.close": "关闭",
  "sidebar.newChatDefault": "新对话",
  "sidebar.cost": "费用",
  "sidebar.newTeam": "新 Team",
  "sidebar.settings": "设置",

  // CostPanel
  "cost.quota": "配额",
  "cost.currentSession": "当前会话",
  "cost.currentWeek": "本周（所有模型）",
  "cost.thisSession": "本次会话",
  "cost.input": "输入",
  "cost.output": "输出",
  "cost.cacheRead": "缓存读取",
  "cost.cacheWrite": "缓存写入",
  "cost.cost": "费用",
  "cost.last30Days": "最近 30 天",
  "cost.totalCost": "总费用",
  "cost.dailyTokens": "每日 Tokens",
  "cost.dailyCost": "每日费用 (USD)",
  "cost.loading": "加载中...",
  "cost.tokens": "Tokens",
  "cost.in": "in",
  "cost.out": "out",
  "cost.resetsAt": "重置于 ~{time}",
  "cost.resetsAtDate": "重置于 ~{date} {time}:00",

  // Composer
  "composer.working": "Agent 运行中...",
  "composer.placeholder": "消息或 /命令",

  // StatusIndicator
  "status.reasoning": "推理中",
  "status.executing": "执行中",

  // Skills
  "skills.title": "Skills",
  "skills.refresh": "刷新",
  "skills.searchPlaceholder": "搜索 skills...",
  "skills.all": "全部",
  "skills.installed": "已安装",
  "skills.scanning": "扫描 ~/.claude/skills/...",
  "skills.noMatch": "无匹配 skill",
  "skills.noSkills": "未找到 skill",
  "skills.installedBadge": "已安装",
  "skills.renameGroup": "重命名分组",
  "skills.moveToGroup": "移至分组",
  "skills.newGroup": "新建分组...",

  // MCP
  "mcp.title": "MCP Servers",
  "mcp.refresh": "刷新",
  "mcp.reading": "读取 ~/.claude/settings.json...",
  "mcp.noServers": "未配置 MCP 服务器",
  "mcp.on": "ON",
  "mcp.transport": "传输",
  "mcp.command": "命令",
  "mcp.args": "参数",
  "mcp.url": "URL",
  "mcp.env": "环境变量",
  "mcp.writesRequireConfirm": "写操作需确认",
  "mcp.source": "来源",
  "mcp.global": "全局",
  "mcp.project": "项目",
  "mcp.projectLocal": "项目本地",

  // Plugins
  "plugins.title": "Plugins",
  "plugins.refresh": "刷新",
  "plugins.reading": "读取已安装插件...",
  "plugins.noPlugins": "未安装插件",
  "plugins.viewOnGithub": "在 GitHub 查看 →",
  "plugins.version": "version",
  "plugins.author": "Author",
  "plugins.license": "License",
  "plugins.installedAt": "Installed",

  // CreateTeamDialog
  "createTeam.title": "创建 Team",
  "createTeam.nameLabel": "Team 名称",
  "createTeam.namePlaceholder": "Refactoring Squad",
  "createTeam.tlLabel": "Team Lead 描述",
  "createTeam.tlHint": "作为 TL 的 system prompt 注入。成员在创建后添加。",
  "createTeam.workingDir": "工作目录：{path}",
  "createTeam.cancel": "取消",
  "createTeam.creating": "创建中...",
  "createTeam.create": "创建并打开",

  // AddMemberDialog
  "addMember.title": "添加 Team 成员",
  "addMember.nameLabel": "名称（@mention 标识符）",
  "addMember.namePlaceholder": "frontend",
  "addMember.nameError": "仅允许小写字母、数字、连字符",
  "addMember.descLabel": "描述（作为 system prompt 注入）",
  "addMember.descPlaceholder": "前端专家。负责 React 组件、CSS 和 UI 实现。",
  "addMember.cancel": "取消",
  "addMember.spawning": "启动中...",
  "addMember.add": "添加",

  // TeamSidebar
  "teamSidebar.noAgents": "暂无 agent",
  "teamSidebar.addMember": "添加成员",
  "teamSidebar.disband": "解散",
  "teamSidebar.disbandTitle": "解散 Team",
  "teamSidebar.disbandDesc": "终止所有 {count} 个 agent 并关闭此 team？",
  "teamSidebar.disbandConfirm": "解散",
  "teamSidebar.agentCount": "{count} 个 agent",
  "teamSidebar.remove": "移除",
  "teamSidebar.statusIdle": "空闲",
  "teamSidebar.statusThinking": "思考中...",
  "teamSidebar.statusToolUse": "工具调用",
  "teamSidebar.statusDone": "完成",
  "teamSidebar.statusError": "错误",
  "teamSidebar.statusSpawning": "启动中...",

  // GroupChatView
  "groupChat.you": "你",
  "groupChat.toolResult": "工具结果",
  "groupChat.teamChat": "Team Chat",
  "groupChat.startMessage": "发送消息开始协作",

  // TeamComposer
  "teamComposer.working": "Agent 运行中...",
  "teamComposer.placeholder": "@agent 消息、/命令，或直接输入与 TL 对话",

  // TeamChatContent
  "teamChat.loading": "加载 team...",
  "teamChat.agentExited": "Agent {name} 已退出（代码 {code}）",

  // ThreadView
  "thread.selectThread": "选择一个线程开始",
  "thread.newThread": "Ctrl+N · 新线程",
  "thread.switchThread": "Alt+↑↓ · 切换",
  "thread.hello": "开始新对话",
  "thread.typeBelow": "在下方输入消息",
  "thread.scrollToBottom": "滚动到底部",
  "thread.spawnFailed": "启动失败：{error}",
  "thread.sendFailed": "发送失败：{error}",
  "thread.agentExited": "Agent 以代码 {code} 退出",

  // UserMessage
  "message.you": "你",

  // ToolCard
  "tool.fold": "折叠",
  "tool.peek": "展开",

  // SlashCommandPopup
  "cmd.soon": "soon",

  // RightPanelContainer
  "panel.cost": "费用",
  "panel.skills": "Skills",
  "panel.mcp": "MCP",
  "panel.plugins": "Plugins",
  "panel.settings": "设置",

  // Commands
  "cmd.clear.desc": "清除线程消息并重置 agent",
  "cmd.cost.desc": "打开费用面板",
  "cmd.help.desc": "显示可用命令",
  "cmd.skills.desc": "打开 Skills 面板",
  "cmd.mcp.desc": "打开 MCP 面板",
  "cmd.plugins.desc": "打开 Plugins 面板",
  "cmd.compact.desc": "压缩对话上下文",
  "cmd.review.desc": "运行代码审查（SDK skill）",
  "cmd.init.desc": "初始化项目（SDK skill）",
  "cmd.config.desc": "打开设置面板",
  "cmd.model.desc": "切换模型（即将推出）",
  "cmd.permissions.desc": "权限管理（即将推出）",
  "cmd.memory.desc": "Memory 文件浏览器（即将推出）",
  "cmd.login.desc": "登录流程（即将推出）",
  "cmd.doctor.desc": "诊断（即将推出）",
  "cmd.cleared": "已清除。",
  "cmd.costOpened": "费用面板已打开。",
  "cmd.skillsOpened": "Skills 面板已打开。",
  "cmd.mcpOpened": "MCP 面板已打开。",
  "cmd.pluginsOpened": "Plugins 面板已打开。",
  "cmd.configOpened": "设置面板已打开。",
  "cmd.notAvailable": "/{name} 尚不可用。即将推出。",
  "cmd.notInTeam": "/{name} 在 team 模式下不可用。",
  "cmd.needsAgent": "/{name} 需要运行中的 agent。请先发送消息启动。",
  "cmd.unknown": "未知命令。输入 /help 查看可用命令。",
  "cmd.available": "可用命令",
  "cmd.comingSoon": "即将推出",

  // Hooks
  "hooks.title": "Hooks",
  "hooks.refresh": "刷新",
  "hooks.loading": "读取 hooks 配置...",
  "hooks.noHooks": "未配置 hooks",
  "hooks.type": "类型",
  "hooks.command": "命令",
  "hooks.prompt": "Prompt",
  "hooks.url": "URL",
  "hooks.tool": "工具",
  "hooks.matcher": "匹配器",
  "hooks.timeout": "超时",
  "hooks.source": "来源",
  "hooks.global": "全局",
  "hooks.project": "项目",
  "hooks.projectLocal": "项目本地",
  "hooks.readOnly": "只读",
  "hooks.condition": "条件",
  "panel.hooks": "Hooks",
  "sidebar.hooks": "Hooks",
  "cmd.hooks.desc": "打开 Hooks 面板",
  "cmd.hooksOpened": "Hooks 面板已打开。",

  // Settings
  "settings.title": "设置",
  "settings.language": "语言",
  "settings.languageDesc": "切换界面语言",
  "settings.chinese": "中文",
  "settings.english": "English",

  // ThreadTabBar
  "threadTab.closeTab": "关闭标签",

  // fmt
  "fmt.justNow": "刚刚",
  "fmt.minsAgo": "{n} 分钟前",
  "fmt.hoursAgo": "{n} 小时前",
  "fmt.daysAgo": "{n} 天前",
} as const;

export type TranslationKey = keyof typeof zh;
