# 奇易聚合浏览AI+

一款基于AI的多环境管理浏览器应用，支持多标签页管理、AI智能对话、自动化操作等功能。

## 📁 项目结构

```
poly-apps/
├── apps/                          # 应用目录
│   ├── desktop/                   # Electron 桌面应用
│   │   ├── main/                   # 主进程代码
│   │   │   ├── index.ts           # 主进程入口
│   │   │   └── windows/           # 窗口管理相关
│   │   │       ├── tab-manager.ts        # 标签页管理
│   │   │       ├── file-upload-interceptor.ts  # 文件上传拦截
│   │   │       └── network-interceptor.ts      # 网络请求拦截
│   │   ├── preload/               # 预加载脚本
│   │   │   └── index.ts          # 预加载脚本入口
│   │   ├── renderer/              # 渲染进程（前端）
│   │   │   ├── src/              # 源代码
│   │   │   │   ├── components/   # Svelte 组件
│   │   │   │   │   ├── panels/   # 面板组件
│   │   │   │   │   │   ├── actions/      # 操作动作注册
│   │   │   │   │   │   │   ├── action-registry.ts    # 动作注册表
│   │   │   │   │   │   │   ├── common-actions.ts     # 通用操作
│   │   │   │   │   │   │   └── douyin-actions.ts     # 抖音专用操作
│   │   │   │   │   │   │   ├── AIChatPanel.svelte    # AI对话面板
│   │   │   │   │   │   │   ├── JSEditorPanel.svelte  # JS编辑器面板
│   │   │   │   │   │   │   └── TemuUploadPanel.svelte # Temu上传面板
│   │   │   │   │   │   ├── Sidebar.svelte            # 侧边栏
│   │   │   │   │   │   ├── TabBar.svelte             # 标签栏
│   │   │   │   │   │   └── ...
│   │   │   │   │   ├── services/  # 服务层
│   │   │   │   │   │   └── ai/   # AI服务
│   │   │   │   │   │       ├── ai-service.ts         # AI服务核心
│   │   │   │   │   │       ├── config.ts             # AI配置管理
│   │   │   │   │   │       ├── history-manager.ts    # 历史对话管理
│   │   │   │   │   │       ├── prompt-loader.ts      # 提示词加载
│   │   │   │   │   │       ├── action-docs.ts        # 操作文档生成
│   │   │   │   │   │       └── types.ts              # 类型定义
│   │   │   │   │   ├── utils/    # 工具函数
│   │   │   │   │   │   ├── panel-registry.ts         # 面板注册
│   │   │   │   │   │   ├── app-config.ts            # 应用配置
│   │   │   │   │   │   └── browser-config-storage.ts # 浏览器配置存储
│   │   │   │   │   └── types/    # 类型定义
│   │   │   │   ├── public/       # 静态资源
│   │   │   │   │   ├── apps/     # 应用配置和图标
│   │   │   │   │   ├── prompts/  # AI提示词文件
│   │   │   │   │   │   ├── default.txt              # 默认提示词
│   │   │   │   │   │   └── douyin-assistant.txt     # 抖音助手提示词
│   │   │   │   │   └── scripts/  # 注入脚本
│   │   │   │   │       ├── common.js                 # 通用脚本
│   │   │   │   │       ├── douyin/                  # 抖音脚本
│   │   │   │   │       └── temu/                    # Temu脚本
│   │   │   │   └── dist/         # 构建输出
│   │   │   └── scripts/          # 构建脚本
│   │   └── electron-builder.yml  # Electron构建配置
│   │
│   └── browser-service/           # 浏览器服务
│       ├── src/                   # 源代码
│       │   ├── browser-service.ts # 浏览器服务核心
│       │   ├── controller/       # 控制器
│       │   │   ├── index.ts       # 控制器入口
│       │   │   └── session-manager.ts  # 会话管理
│       │   └── injection/         # 注入管理
│       │       ├── index.ts       # 注入入口
│       │       └── injection-manager.ts  # 注入管理器
│       └── dist/                  # 构建输出
│
├── packages/                      # 共享包
│   └── shared/                    # 共享代码
│       ├── src/                   # 源代码
│       │   ├── constants/         # 常量定义
│       │   ├── ipc-schema/        # IPC通信协议
│       │   └── types/             # 类型定义
│       └── dist/                  # 构建输出
│
├── docs/                          # 文档目录
│   ├── API_DOCUMENTATION.md       # API文档
│   ├── ARCHITECTURE.md            # 架构文档
│   ├── BUILD.md                   # 构建文档
│   └── quick-start.md             # 快速开始
│
├── package.json                   # 根package.json（Turbo配置）
├── turbo.json                     # Turbo构建配置
├── pnpm-workspace.yaml            # pnpm工作区配置
└── tsconfig.json                  # TypeScript配置
```

## 🏗️ 技术栈

- **框架**: Electron + Svelte
- **构建工具**: Turbo (Monorepo) + Vite
- **包管理**: pnpm
- **语言**: TypeScript
- **AI服务**: 支持 OpenAI、DeepSeek 等

## 📦 核心模块说明

### 1. Desktop 应用 (`apps/desktop/`)

Electron 桌面应用，包含三个主要进程：

#### 主进程 (`main/`)
- **`index.ts`**: 应用入口，管理窗口生命周期
- **`windows/tab-manager.ts`**: 标签页管理，创建和管理浏览器标签
- **`windows/file-upload-interceptor.ts`**: 拦截文件上传请求
- **`windows/network-interceptor.ts`**: 拦截网络请求

#### 预加载脚本 (`preload/`)
- **`index.ts`**: 在渲染进程和主进程之间建立安全的IPC通信桥梁

#### 渲染进程 (`renderer/`)
前端界面，使用 Svelte 构建：

- **组件 (`components/`)**:
  - `panels/`: 各种功能面板
    - `AIChatPanel.svelte`: AI对话面板，支持流式响应和任务执行
    - `JSEditorPanel.svelte`: JavaScript代码编辑器
    - `TemuUploadPanel.svelte`: Temu商品上传面板
    - `actions/`: 操作动作注册系统
      - `action-registry.ts`: 动态动作注册表
      - `common-actions.ts`: 通用浏览器操作（延迟、滚动、获取信息等）
      - `douyin-actions.ts`: 抖音专用操作（点赞、评论、获取视频信息等）

- **服务 (`services/ai/`)**:
  - `ai-service.ts`: AI服务核心，处理API调用和流式响应
  - `config.ts`: AI配置管理（API密钥、模型、代理等）
  - `history-manager.ts`: 对话历史持久化存储
  - `prompt-loader.ts`: 动态加载提示词文件
  - `action-docs.ts`: 根据appId动态生成操作文档

- **静态资源 (`public/`)**:
  - `prompts/`: AI提示词文件
  - `scripts/`: 注入到浏览器页面的JavaScript脚本
  - `apps/`: 应用配置和图标

### 2. Browser Service (`apps/browser-service/`)

浏览器服务模块，提供浏览器控制能力：

- **`browser-service.ts`**: 浏览器服务核心
- **`controller/session-manager.ts`**: 管理浏览器会话
- **`injection/injection-manager.ts`**: 管理脚本注入

### 3. Shared Package (`packages/shared/`)

共享代码包，包含：

- **`constants/`**: 常量定义
- **`ipc-schema/`**: IPC通信协议定义
- **`types/`**: 共享类型定义

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

### 构建

```bash
# 构建所有包
pnpm build

# 仅构建桌面应用
pnpm build:desktop
```

### 打包分发

```bash
# 打包所有平台
pnpm dist

# 打包特定平台
pnpm dist:win    # Windows
pnpm dist:mac    # macOS
pnpm dist:linux  # Linux
```

## 📝 主要功能

1. **多标签页管理**: 支持创建多个独立的浏览器标签，每个标签可配置不同的应用环境
2. **AI智能对话**: 集成AI服务，支持流式响应和自动化任务执行
3. **动态操作注册**: 通过 `action-registry` 系统动态注册和调用操作
4. **提示词管理**: 支持按应用加载不同的AI提示词
5. **历史对话持久化**: 对话历史自动保存到本地存储
6. **脚本注入**: 支持向浏览器页面注入自定义JavaScript脚本

## 🔧 开发指南

### 添加新的操作动作

1. 在 `apps/desktop/renderer/src/components/panels/actions/` 创建新的动作文件
2. 在 `action-registry.ts` 中注册新动作
3. 更新 `action-docs.ts` 生成对应的文档

### 添加新的应用

1. 在 `apps/desktop/renderer/public/apps/` 添加应用配置和图标
2. 如需专用操作，在 `actions/` 目录创建对应的动作文件
3. 如需专用提示词，在 `public/prompts/` 添加提示词文件

### 添加新的面板

1. 在 `apps/desktop/renderer/src/components/panels/` 创建新的面板组件
2. 在 `utils/panel-registry.ts` 中注册新面板

## 📚 更多文档

- [API文档](./docs/API_DOCUMENTATION.md)
- [架构文档](./docs/ARCHITECTURE.md)
- [构建文档](./docs/BUILD.md)
- [快速开始](./docs/quick-start.md)

## 📄 许可证

私有项目

