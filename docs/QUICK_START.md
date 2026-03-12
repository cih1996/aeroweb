# 快速开始 - AI Agent 集成

## 前置条件

1. Python 3.8+
2. Node.js 18+
3. pnpm

## 启动步骤

### 1. 安装 Python 依赖

```bash
cd ai+
pip install -r requirements_api.txt
```

### 2. 启动 AI Agent 系统

```bash
cd ai+
python api_server.py
```

看到以下输出表示启动成功:
```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🚀 AI Agent 系统 API 服务器                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📡 启动服务器...
📚 API 文档: http://localhost:8000/docs
```

### 3. 安装 Electron 依赖

```bash
cd apps/desktop
pnpm install
```

### 4. 启动 Electron 应用

```bash
cd apps/desktop
pnpm dev
```

## 使用 AI 功能

1. 在应用中打开抖音 (或其他支持的 APP)
2. 点击右侧的 "AI 智能助手" 面板
3. 输入指令，例如:
   - "帮我在抖音上找3个关于人工智能的视频"
   - "点赞当前视频"
   - "获取当前视频信息"

## 验证集成

### 检查回调服务器

在 Electron 应用启动后，终端应该显示:
```
✓ [AI Callback Server] 已启动在端口 5022
  回调地址: http://localhost:5022/execute
```

### 检查能力注册

在 AI 对话面板中输入任何指令后，浏览器控制台应该显示:
```
[Douyin Capabilities] 注册成功
[AI Agent] 注册成功: {...}
```

### 测试 API

访问 http://localhost:8000/docs 查看 API 文档并测试接口。

## 故障排除

### 端口冲突

如果 8000 或 5022 端口被占用:

1. **AI Agent 系统**: 修改 `ai+/api_server.py` 最后一行的端口号
2. **回调服务器**: 会自动尝试下一个可用端口

### 连接失败

1. 确认 AI Agent 系统已启动
2. 检查防火墙设置
3. 查看浏览器控制台和终端日志

### 能力执行失败

1. 确认当前有活动的 tab
2. 检查能力是否正确注册
3. 查看回调服务器日志

## 下一步

- 阅读完整文档: [AI_AGENT_INTEGRATION.md](./AI_AGENT_INTEGRATION.md)
- 查看 AI Agent 系统文档: [../../ai+/docs/](../../ai+/docs/)
- 添加自定义能力

