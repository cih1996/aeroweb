# AI Agent 系统集成文档

## 概述

本项目已集成 Python AI Agent 智能体系统，实现了双向 API 通信架构。Electron 应用作为调用方，向 AI Agent 系统注册能力，AI Agent 系统通过回调执行这些能力。

## 架构说明

```
┌─────────────────────────────────┐         ┌──────────────────────────┐
│   Electron 应用 (调用方)         │         │  Python AI Agent 系统     │
│                                 │         │                          │
│  ┌──────────────────────────┐  │         │  ┌────────────────────┐  │
│  │  回调服务器 (Main 进程)   │  │         │  │  8 层 Agent        │  │
│  │  - Express Server        │  │         │  │  (决策系统)        │  │
│  │  - 端口: 5022           │  │         │  │                    │  │
│  └──────────────────────────┘  │         │  └────────────────────┘  │
│           ▲                     │         │          │               │
│           │ 5. 执行能力          │         │          │               │
│           │                     │         │          │               │
│  ┌──────────────────────────┐  │         │  ┌────────────────────┐  │
│  │  能力注册中心             │  │         │  │  HTTP 客户端       │  │
│  │  - 管理所有能力           │  │         │  │  (回调调用)        │  │
│  │  - 执行能力               │  │         │  │                    │  │
│  └──────────────────────────┘  │         │  └────────────────────┘  │
│           ▲                     │         │          │               │
│           │                     │         │          │               │
│  ┌──────────────────────────┐  │         │          │               │
│  │  AI 对话面板              │  │         │          │               │
│  │  - 发起任务               │  │         │          │               │
│  │  - 显示进度               │  │         │          │               │
│  └──────────────────────────┘  │         │          │               │
└─────────────────────────────────┘         └──────────────────────────┘
           │                                           │
           │ 1. 注册 APP 能力                           │
           ├──────────────────────────────────────────>│
           │   POST /api/register_app                  │
           │                                           │
           │ 2. 发起任务                                │
           ├──────────────────────────────────────────>│
           │   POST /api/task                          │
           │                                           │
           │ 4. 回调执行能力                            │
           │<──────────────────────────────────────────┤
           │   POST http://localhost:5022/execute      │
           │                                           │
           │ 6. 返回执行结果                            │
           ├──────────────────────────────────────────>│
           │                                           │
```

## 核心组件

### 1. 回调服务器 (Main 进程)

**文件**: `apps/desktop/main/ai-callback-server.ts`

- 运行在 Electron Main 进程
- 使用 Express 创建 HTTP 服务器
- 默认端口: 5022
- 接收来自 AI Agent 系统的回调请求
- 将请求转发到渲染进程执行

### 2. AI Agent 客户端服务

**文件**: `apps/desktop/renderer/src/services/ai-agent/index.ts`

- 与 Python AI Agent 系统通信
- 提供注册 APP、创建任务、查询状态等功能
- 默认 AI Agent API 地址: `http://localhost:8000`

### 3. 能力注册中心

**文件**: `apps/desktop/renderer/src/services/ai-agent/capability-registry.ts`

- 管理所有已注册的能力
- 提供能力执行接口
- 支持按 APP 分组管理

### 4. 动作执行器

**文件**: `apps/desktop/renderer/src/services/ai-agent/action-executor.ts`

- 处理来自 AI Agent 系统的回调请求
- 调用能力注册中心执行具体能力
- 返回执行结果

### 5. APP 能力注册

**文件**: `apps/desktop/renderer/src/services/ai-agent/app-registration.ts`

- 负责向 AI Agent 系统注册 APP 能力
- 管理已注册的 APP

### 6. 抖音能力定义

**文件**: `apps/desktop/renderer/src/components/panels/actions/douyin-capabilities.ts`

- 定义抖音的所有能力
- 将抖音操作注册到 AI Agent 系统

## 使用流程

### 1. 启动 AI Agent 系统

```bash
cd ai+
python api_server.py
```

预期输出:
```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🚀 AI Agent 系统 API 服务器                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📡 启动服务器...
📚 API 文档: http://localhost:8000/docs
🔍 交互式文档: http://localhost:8000/redoc

INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 2. 启动 Electron 应用

```bash
cd apps/desktop
pnpm dev
```

应用启动时会自动:
1. 启动回调服务器 (端口 5022)
2. 初始化 AI Agent 客户端
3. 初始化动作执行器

### 3. 使用 AI 对话面板

1. 打开抖音应用
2. 点击右侧的 "AI 对话" 面板
3. 输入指令，例如: "帮我在抖音上找3个关于人工智能的视频"
4. AI 会自动:
   - 注册抖音能力 (首次使用时)
   - 创建任务
   - 执行任务 (通过回调执行抖音操作)
   - 显示进度和结果

## 能力定义规范

### 能力类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `navigation` | 导航类（切换对象、跳转） | next, previous, toJingXuan |
| `read` | 读取类（获取信息） | getVideoInfo, getComments |
| `analyze` | 分析类（触发分析） | analyze |
| `engage` | 互动类（点赞、评论） | digg, sendComment |
| `control` | 控制类（停止、暂停） | stop, pause |

### 能力定义示例

```typescript
{
  name: 'next',
  type: 'navigation',
  description: '切换到下一个视频',
  params: [],
}

{
  name: 'getComments',
  type: 'read',
  description: '获取视频评论列表',
  params: ['pageCount'],
}

{
  name: 'sendComment',
  type: 'engage',
  description: '发送评论',
  params: ['commentText', 'commentIndex'],
}
```

### 能力执行器示例

```typescript
async function next(tabId: string | null): Promise<any> {
  // 执行切换到下一个视频的操作
  return await douyinActions.next(tabId);
}
```

## 添加新 APP 能力

### 1. 定义能力

创建文件: `apps/desktop/renderer/src/components/panels/actions/[app-name]-capabilities.ts`

```typescript
import type { AppCapability } from '../../../services/ai-agent/index';
import { appRegistrationManager } from '../../../services/ai-agent/app-registration';
import * as appActions from './[app-name]-actions';

export const APP_CAPABILITIES: AppCapability[] = [
  {
    name: 'action1',
    type: 'navigation',
    description: '操作1描述',
    params: [],
  },
  // ... 更多能力
];

export async function registerAppCapabilities(): Promise<void> {
  await appRegistrationManager.registerApp({
    appName: '[app-name]',
    capabilities: [
      {
        capability: APP_CAPABILITIES[0],
        executor: appActions.action1,
      },
      // ... 更多能力
    ],
    timeout: 30,
  });
}
```

### 2. 在 AI 对话面板中注册

修改 `apps/desktop/renderer/src/components/panels/AIChatPanel.svelte`:

```typescript
async function initCapabilities() {
  if (appId === '[app-name]') {
    if (!isAppRegistered()) {
      await registerAppCapabilities();
    }
  }
}
```

## 配置

### AI Agent API 地址

默认: `http://localhost:8000`

可以通过 localStorage 修改:

```javascript
localStorage.setItem('ai_agent_config', JSON.stringify({
  agentApiUrl: 'http://your-server:8000',
  callbackUrl: 'http://localhost:5022'
}));
```

### 回调服务器端口

默认: 5022

如果端口被占用，会自动尝试下一个端口。

## API 文档

### AI Agent 系统 API

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### 主要接口

#### 1. 注册 APP

```http
POST http://localhost:8000/api/register_app
Content-Type: application/json

{
  "app_name": "douyin",
  "callback_url": "http://localhost:5022",
  "capabilities": [...],
  "timeout": 30
}
```

#### 2. 创建任务

```http
POST http://localhost:8000/api/task
Content-Type: application/json

{
  "message": "帮我在抖音上找3个关于人工智能的视频",
  "enable_interaction": false
}
```

#### 3. 查询任务状态

```http
GET http://localhost:8000/api/task/{task_id}
```

#### 4. 执行能力回调

```http
POST http://localhost:5022/execute
Content-Type: application/json

{
  "action": "next",
  "params": []
}
```

## 调试

### 查看日志

- **Main 进程**: 终端输出
- **渲染进程**: 浏览器开发者工具控制台
- **AI Agent 系统**: Python 终端输出

### 常见问题

#### Q: 回调服务器启动失败

**A**: 检查端口是否被占用，或查看 Main 进程日志

#### Q: 注册能力失败

**A**: 
1. 确认 AI Agent 系统已启动
2. 检查网络连接
3. 查看浏览器控制台错误信息

#### Q: 任务执行失败

**A**:
1. 检查能力是否正确注册
2. 查看回调服务器日志
3. 确认 tabId 是否有效

## 文件结构

```
apps/desktop/
├── main/
│   ├── index.ts                          # 主进程入口 (启动回调服务器)
│   └── ai-callback-server.ts             # AI 回调服务器
├── preload/
│   └── index.ts                          # Preload 脚本 (暴露 API)
└── renderer/src/
    ├── App.svelte                        # 应用入口 (初始化 AI Agent 系统)
    ├── services/
    │   └── ai-agent/
    │       ├── index.ts                  # AI Agent 客户端
    │       ├── capability-registry.ts    # 能力注册中心
    │       ├── action-executor.ts        # 动作执行器
    │       ├── app-registration.ts       # APP 注册管理器
    │       └── init.ts                   # 初始化
    └── components/
        └── panels/
            ├── AIChatPanel.svelte        # AI 对话面板
            └── actions/
                ├── douyin-actions.ts     # 抖音操作
                └── douyin-capabilities.ts # 抖音能力定义
```

## 依赖

### 新增依赖

- `express`: HTTP 服务器 (Main 进程)
- `@types/express`: TypeScript 类型定义

### 安装

```bash
cd apps/desktop
pnpm install
```

## 下一步

1. 添加更多 APP 能力 (TikTok, 微博等)
2. 实现能力配置界面
3. 添加任务历史记录
4. 支持流式输出
5. 添加错误重试机制

## 参考文档

- [AI Agent 系统文档](../../ai+/docs/README.md)
- [API 集成指南](../../ai+/docs/API_INTEGRATION_GUIDE.md)
- [快速开始](../../ai+/docs/API_QUICKSTART.md)

