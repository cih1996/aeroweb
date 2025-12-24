# Poly Apps - 架构与目录结构总结

## 📋 项目概述

Poly Apps 是一个 PC 端聚合聊天平台，通过 Electron 构建统一的桌面应用，在一个 UI 中承载多个 Web 端聊天/社交应用（WhatsApp、Telegram、X、TikTok 等）。通过 JavaScript 注入的方式接管 Web 应用通信，实现多应用聚合、多账号隔离与自动化能力。

## 🏗️ 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (Svelte)                      │
│  ┌──────────────┐  ┌────────────────────────────────────┐  │
│  │   Sidebar    │  │      Content Area                   │  │
│  │              │  │  ┌──────────────────────────────┐  │  │
│  │ - 应用中心   │  │  │   BrowserView (嵌入)          │  │  │
│  │ - 打开的应用 │  │  │   - WhatsApp                  │  │  │
│  │ - AI 助手    │  │  │   - Telegram                  │  │  │
│  │              │  │  │   - X / TikTok                │  │  │
│  └──────────────┘  └────────────────────────────────────┘  │
└───────────────────────▲─────────────────────────────────────┘
                        │ IPC (contextBridge)
┌───────────────────────┴─────────────────────────────────────┐
│              Electron Main Process                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  main/index.ts                                        │  │
│  │  - 窗口管理 (无边框窗口)                              │  │
│  │  - IPC 路由                                           │  │
│  │  - 生命周期管理                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  windows/tab-manager.ts                               │  │
│  │  - BrowserView 管理                                  │  │
│  │  - Tab 生命周期                                       │  │
│  │  - 视图位置计算 (侧边栏240px + 标题栏40px)           │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────▲─────────────────────────────────────┘
                        │ 调用
┌───────────────────────┴─────────────────────────────────────┐
│              Browser Service Layer                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BrowserService                                      │  │
│  │  - 核心服务入口                                       │  │
│  │  - 协调 InjectionManager 和 SessionManager          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  InjectionManager                                    │  │
│  │  - JS 注入管理                                        │  │
│  │  - Adapter 注入                                       │  │
│  │  - Platform SDK 注入                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SessionManager                                      │  │
│  │  - 会话管理                                           │  │
│  │  - Profile 管理                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────────────────▲─────────────────────────────────────┘
                        │ JS 注入 / 事件监听
┌───────────────────────┴─────────────────────────────────────┐
│              Web Application Layer                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Web Apps (WhatsApp, Telegram, X, TikTok...)        │  │
│  │  - 通过 BrowserView 加载                             │  │
│  │  - 注入 Adapter JS                                   │  │
│  │  - 与 Browser Service 通信                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 📁 目录结构详解

```
qiyi/
├── apps/                          # 应用层
│   ├── desktop/                   # Electron 桌面应用
│   │   ├── main/                  # 主进程代码
│   │   │   ├── index.ts          # 应用入口，窗口管理，IPC 路由
│   │   │   └── windows/           # 窗口管理模块
│   │   │       └── tab-manager.ts # Tab 和 BrowserView 管理
│   │   ├── preload/               # Preload 脚本 (⭐ Svelte-Electron 交互封装层)
│   │   │   └── index.ts          # IPC 桥梁，使用 contextBridge 暴露 electronAPI
│   │   │                          # - 封装所有 IPC 调用为统一的 API
│   │   │                          # - 提供类型安全的接口
│   │   │                          # - 作为渲染进程和主进程的唯一通信桥梁
│   │   ├── renderer/              # 渲染进程 (UI - Svelte)
│   │   │   ├── src/
│   │   │   │   ├── App.svelte    # 主应用组件
│   │   │   │   ├── components/   # UI 组件
│   │   │   │   │   ├── TitleBar.svelte    # 自定义标题栏
│   │   │   │   │   ├── Sidebar.svelte     # 左侧菜单栏
│   │   │   │   │   ├── AppGrid.svelte     # 应用网格
│   │   │   │   │   ├── LoadingOverlay.svelte  # 加载状态组件
│   │   │   │   │   └── icons/             # SVG 图标组件
│   │   │   │   ├── vite-env.d.ts # TypeScript 类型定义 (electronAPI 类型)
│   │   │   │   └── main.ts       # Svelte 应用入口
│   │   │   ├── vite.config.ts    # Vite 配置
│   │   │   └── index.html        # HTML 入口
│   │   ├── scripts/               # 构建脚本
│   │   │   └── start-electron.js  # Electron 启动脚本
│   │   └── package.json           # 应用依赖配置
│   │
│   └── browser-service/           # 浏览器服务核心
│       ├── src/
│       │   ├── browser-service.ts      # 核心服务类
│       │   ├── injection/               # JS 注入模块
│       │   │   └── injection-manager.ts # 注入管理器
│       │   ├── controller/              # 控制器模块
│       │   │   └── session-manager.ts   # 会话管理器
│       │   ├── adapters/                # Adapter 实现 (待完善)
│       │   ├── fingerprint/             # 浏览器指纹 (待完善)
│       │   └── network/                 # 网络模块 (待完善)
│       └── package.json
│
├── packages/                       # 共享包
│   ├── shared/                     # 共享类型和常量
│   │   ├── src/
│   │   │   ├── types/              # TypeScript 类型定义
│   │   │   │   └── index.ts        # Tab, Session, Profile 等类型
│   │   │   ├── constants/          # 常量定义
│   │   │   │   └── index.ts        # APP_IDS, APP_URLS, IPC_CHANNELS
│   │   │   └── ipc-schema/         # IPC 通信协议
│   │   │       └── index.ts        # IPC 事件和消息类型
│   │   └── package.json
│   │
│   ├── platform-sdk/               # 平台 SDK (待实现)
│   │   └── ...                     # 给注入 Adapter 用的 SDK
│   │
│   └── automation/                 # 自动化模块 (待实现)
│       ├── agents/                 # AI 代理
│       ├── rules/                  # 规则引擎
│       └── workflows/              # 工作流
│
├── configs/                        # 配置文件
│   ├── chromium/                   # Chromium 配置
│   ├── electron/                   # Electron 配置
│   └── profiles/                   # 用户配置
│
├── docs/                           # 文档
│   ├── project-status.md           # 项目状态
│   └── quick-start.md              # 快速开始指南
│
├── scripts/                        # 构建和工具脚本
│
├── package.json                    # 根 package.json
├── pnpm-workspace.yaml             # pnpm workspace 配置
├── turbo.json                      # Turbo 构建配置
├── tsconfig.json                   # TypeScript 根配置
└── README.MD                       # 项目说明
```

## 🔄 模块关系与依赖

### 依赖关系图

```
apps/desktop (Electron App)
  ├── 依赖 @qiyi/browser-service
  │   └── 依赖 @qiyi/shared
  │
  └── 依赖 @qiyi/shared (直接使用类型和常量)

apps/browser-service
  └── 依赖 @qiyi/shared

packages/shared
  └── 无依赖 (基础包)
```

### 包说明

| 包名 | 类型 | 说明 | 主要导出 |
|------|------|------|----------|
| `@qiyi/desktop` | App | Electron 桌面应用 | - |
| `@qiyi/browser-service` | Package | 浏览器服务核心 | `BrowserService`, `InjectionManager`, `SessionManager` |
| `@qiyi/shared` | Package | 共享类型和常量 | `Tab`, `Session`, `Profile`, `APP_IDS`, `APP_URLS` |

## 🔀 数据流

### 1. 创建 Tab 流程

```
用户点击应用卡片
  ↓
App.svelte: createTab()
  ↓
IPC: electronAPI.tab.create(appId, url)
  ↓
Main Process: ipcMain.handle('tab:create')
  ↓
TabManager.createTab()
  ├── 创建 BrowserView
  ├── 设置视图位置 (x: 240, y: 40, width/height 计算)
  ├── 加载 URL
  ├── BrowserService.injectScript()
  │   └── InjectionManager.injectPlatformSDK()
  │   └── InjectionManager.injectAdapter()
  └── 激活 Tab
  ↓
IPC: 发送 'tab:update' 事件
  ↓
App.svelte: 更新 UI，显示浏览器内容
```

### 2. 窗口布局计算

```
窗口大小: width × height
  ↓
侧边栏: 240px (固定)
标题栏: 40px (固定)
  ↓
BrowserView 位置:
  x: 240px
  y: 40px
  width: window.width - 240px
  height: window.height - 40px
```

### 3. IPC 通信 (Svelte-Electron 交互流程)

```
Renderer Process (Svelte UI)
  ↓ 调用 window.electronAPI.tab.create()
  ↓ (通过 contextBridge，安全隔离)
Preload Script (preload/index.ts) ⭐ 封装层
  ↓ ipcRenderer.invoke('tab:create', { appId, url })
  ↓ (IPC 消息传递)
Main Process (main/index.ts)
  ↓ ipcMain.handle('tab:create', ...)
  ↓ 调用
TabManager / BrowserService

反向通信（事件）:
Main Process
  ↓ mainWindow.webContents.send('tab:update', data)
  ↓ (IPC 事件)
Preload Script
  ↓ ipcRenderer.on('tab:update', callback)
  ↓ (通过 contextBridge 转发)
Renderer Process (Svelte UI)
  ↓ window.electronAPI.on('tab:update', callback)
  ↓ 更新 Svelte 组件状态
```

## 🛠️ 技术栈

### 前端技术
- **Svelte 4** - UI 框架
- **Vite 5** - 构建工具和开发服务器
- **TypeScript 5** - 类型系统
- **CSS** - 样式（渐变、动画、AI 科技感设计）

### 桌面应用
- **Electron 28** - 桌面应用框架
- **BrowserView** - 嵌入浏览器视图
- **IPC (Inter-Process Communication)** - 进程间通信

### 构建工具
- **pnpm** - 包管理器
- **Turbo** - Monorepo 构建系统
- **TypeScript Compiler** - 类型检查和编译

### 项目结构
- **Monorepo** - 使用 pnpm workspace
- **TypeScript Project References** - 项目引用配置

## 🔌 Svelte-Electron 交互封装层

### 封装架构

Svelte 和 Electron 的交互通过 **Preload 层**进行封装，这是 Electron 的安全桥梁层：

```
┌─────────────────────────────────────────┐
│     Svelte Components (Renderer)        │
│  - App.svelte                           │
│  - 直接使用 window.electronAPI.*        │
└──────────────────┬──────────────────────┘
                   │ window.electronAPI
                   │ (类型安全，通过 vite-env.d.ts)
┌──────────────────▼──────────────────────┐
│  Preload Layer (preload/index.ts) ⭐    │
│  - contextBridge.exposeInMainWorld()    │
│  - 封装 IPC 调用为 Promise API          │
│  - 提供统一的接口                        │
└──────────────────┬──────────────────────┘
                   │ ipcRenderer.invoke/on
                   │ (IPC 消息)
┌──────────────────▼──────────────────────┐
│  Main Process (main/index.ts)            │
│  - ipcMain.handle()                      │
│  - 处理业务逻辑                          │
└─────────────────────────────────────────┘
```

### 封装位置

**核心封装文件**：
- `apps/desktop/preload/index.ts` - 封装实现
- `apps/desktop/renderer/src/vite-env.d.ts` - 类型定义

### 封装内容

Preload 层封装了以下 API 模块：

1. **Tab 操作** (`electronAPI.tab.*`)
   - `create(appId, url)` - 创建 Tab
   - `close(tabId)` - 关闭 Tab
   - `activate(tabId)` - 激活 Tab
   - `list()` - 获取 Tab 列表

2. **浏览器操作** (`electronAPI.browser.*`)
   - `navigate(tabId, url)` - 导航
   - `reload(tabId)` - 刷新

3. **窗口控制** (`electronAPI.window.*`)
   - `minimize()` - 最小化
   - `maximize()` - 最大化/还原
   - `close()` - 关闭

4. **视图控制** (`electronAPI.view.*`)
   - `hideBrowser()` - 隐藏浏览器视图
   - `showBrowser(tabId)` - 显示浏览器视图

5. **事件监听** (`electronAPI.on/off`)
   - `on(channel, callback)` - 监听事件
   - `off(channel, callback)` - 移除监听

### 使用方式

在 Svelte 组件中直接使用：

```typescript
// 创建 Tab
await window.electronAPI.tab.create('whatsapp', 'https://web.whatsapp.com');

// 监听事件
window.electronAPI.on('tab:update', (data) => {
  // 更新 UI
});

// 窗口控制
await window.electronAPI.window.minimize();
```

### 安全机制

- 使用 `contextBridge` 确保安全隔离
- 渲染进程无法直接访问 Node.js API
- 所有交互必须通过 Preload 层
- 类型安全通过 TypeScript 保证

## 🎯 核心特性

### 1. 无边框窗口
- 使用 `frame: false` 移除系统标题栏
- 自定义 `TitleBar` 组件实现窗口控制
- 支持拖拽、最小化、最大化、关闭

### 2. 浏览器嵌入
- 使用 `BrowserView` 在 UI 内嵌入浏览器
- 每个 Tab 对应一个独立的 BrowserView
- 自动计算位置，考虑侧边栏和标题栏

### 3. JS 注入机制
- 通过 `InjectionManager` 注入 Platform SDK
- 根据 URL 自动选择对应的 Adapter
- 实现 Web 应用通信接管

### 4. 模块化设计
- UI 与浏览器内核解耦
- Browser Service 作为核心抽象层
- 支持未来切换自定义 Chromium

## 📝 关键文件说明

### 主进程入口
- **`apps/desktop/main/index.ts`**
  - Electron 应用入口
  - 窗口创建和管理
  - IPC 路由处理
  - 生命周期管理

### Tab 管理
- **`apps/desktop/main/windows/tab-manager.ts`**
  - BrowserView 创建和销毁
  - Tab 状态管理
  - 视图位置计算和更新
  - 窗口大小变化监听

### IPC 桥梁 (Svelte-Electron 交互封装层)
- **`apps/desktop/preload/index.ts`** ⭐ **核心封装层**
  - 使用 `contextBridge.exposeInMainWorld` 暴露 `electronAPI`
  - 封装所有 IPC 调用为统一的 Promise-based API
  - 提供类型安全的接口（通过 TypeScript 类型声明）
  - 作为渲染进程（Svelte）和主进程的唯一通信桥梁
  - 提供的 API 模块：
    - `tab.*` - Tab 操作（create, close, activate, list）
    - `browser.*` - 浏览器操作（navigate, reload）
    - `window.*` - 窗口控制（minimize, maximize, close）
    - `view.*` - 视图控制（hideBrowser, showBrowser）
    - `on/off` - 事件监听（tab:update, tab:activate, tab:loaded 等）

### 类型定义层
- **`apps/desktop/renderer/src/vite-env.d.ts`**
  - 为 Svelte 组件提供 `window.electronAPI` 的 TypeScript 类型定义
  - 确保类型安全，IDE 自动补全
  - 与 preload 层的类型声明保持一致

### UI 主组件
- **`apps/desktop/renderer/src/App.svelte`**
  - 应用根组件
  - 布局管理（标题栏 + 侧边栏 + 内容区）
  - Tab 状态同步
  - 视图切换（应用中心 / 打开的应用）

### 浏览器服务
- **`apps/browser-service/src/browser-service.ts`**
  - 核心服务类
  - 协调注入和会话管理
  - 提供统一的浏览器操作接口

### 共享类型
- **`packages/shared/src/types/index.ts`**
  - `Tab` - Tab 数据结构
  - `Session` - 会话数据
  - `Profile` - 用户配置

## 🚀 开发工作流

### 启动开发
```bash
pnpm dev
```
启动流程：
1. 编译 main 进程 (watch)
2. 编译 preload 脚本 (watch)
3. 启动 Vite 开发服务器 (renderer)
4. 等待资源就绪后启动 Electron

### 构建
```bash
pnpm build
```
构建所有包：
- `@qiyi/shared` → `dist/`
- `@qiyi/browser-service` → `dist/`
- `@qiyi/desktop` → `dist/main/`, `dist/preload/`, `dist/renderer/`

## 🔮 未来扩展

### 待实现模块
- **Adapter 具体实现** - 各应用的 JS 注入逻辑
- **Platform SDK** - 注入到 Web 应用的 SDK
- **自动化模块** - AI 代理、规则引擎、工作流
- **多账号隔离** - Profile 管理和切换
- **消息通信** - Web → Browser Service → UI 的消息流

### 架构演进
- **当前**: Electron 内置 Chromium
- **未来**: 外部自定义 Chromium (RPC 接入)
- **目标**: 浏览器内核可替换，保持接口一致性

## 📚 相关文档

- [README.MD](./README.MD) - 项目概述和快速开始
- [docs/quick-start.md](./docs/quick-start.md) - 详细开发指南
- [docs/project-status.md](./docs/project-status.md) - 项目状态和待办

---

**最后更新**: 2024-12-13
**架构版本**: v1.0.0

