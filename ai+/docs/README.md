# 🤖 AI Agent 系统 - 纯远程 API 版本

## 📋 系统特点

✅ **纯粹通用系统**
- 不包含任何本地 APP 能力实现
- 完全依赖外部调用方注册能力
- 真正的解耦架构

✅ **双向 API 架构**
- Agent 系统提供 RESTful API
- 调用方提供回调 API
- 类似 MCP（Model Context Protocol）设计

✅ **8 层智能决策**
- GlobalIntentAI: 理解用户意图
- ContextBuilderAI: 构建任务上下文
- StrategyAI: 生成执行策略
- DecisionAI: 智能决策
- ExecutorAI: 执行计划
- PerceptionAI: 感知判断
- SupervisorAI: 风险控制
- MemoryLearnerAI: 学习记忆

✅ **完整功能**
- 三层记忆系统（Global/App/Intent）
- Token 消耗统计
- 任务状态管理
- 异步执行

---

## 🚀 快速开始

### 5 分钟快速测试

#### 1. 安装依赖

```bash
pip install -r requirements_api.txt
```

#### 2. 启动 Agent 系统（终端 1）

```bash
python api_server.py
```

#### 3. 启动调用方服务器（终端 2）

```bash
python client_example.py server
```

#### 4. 运行测试（终端 3）

```bash
python client_example.py client
```

**详细步骤请查看**: [API_QUICKSTART.md](API_QUICKSTART.md)

---

## 📚 文档导航

### 核心文档

1. **[API_QUICKSTART.md](API_QUICKSTART.md)** ⭐ 推荐先看
   - 5 分钟快速测试
   - 最小示例代码
   
2. **[API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)** 📖 完整指南
   - 双向 API 协议详解
   - 调用方需要实现的接口
   - 能力注册规范
   - 完整示例代码

3. **[测试指南.md](测试指南.md)** 🧪 调试必备
   - 详细测试步骤
   - 常见错误处理
   - 验收标准

### 核心代码

1. **[api_server.py](api_server.py)** - Agent 系统 API 服务器
2. **[client_example.py](client_example.py)** - 调用方示例（完整实现）

---

## 🏗️ 架构图

```
┌─────────────────────┐                    ┌──────────────────────┐
│   调用方应用         │                    │  Agent 系统 API       │
│   (Your App)        │                    │  (This System)       │
│                     │                    │                      │
│  ┌───────────────┐  │                    │  ┌────────────────┐  │
│  │ 能力执行器     │  │                    │  │ 8 层 AI        │  │
│  │ (Executor)    │  │                    │  │ (智能决策)     │  │
│  └───────────────┘  │                    │  └────────────────┘  │
│         ▲            │                    │         │            │
│         │            │                    │         │            │
│  ┌───────────────┐  │                    │  ┌────────────────┐  │
│  │ HTTP 服务器    │  │                    │  │ HTTP 客户端    │  │
│  │ (回调接口)    │  │                    │  │ (回调调用)     │  │
│  └───────┬───────┘  │                    │  └────────┬───────┘  │
└──────────┼──────────┘                    └───────────┼──────────┘
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
           │   POST {callback_url}/execute             │
           │                                           │
           │ 5. 返回执行结果                            │
           ├──────────────────────────────────────────>│
           │                                           │
```

---

## 📦 项目结构

```
ai+/
├── api_server.py              # ⭐ Agent 系统 API 服务器
├── client_example.py          # ⭐ 调用方完整示例
│
├── agent_system/              # Agent 系统核心
│   ├── agents/                # 8 层 AI 实现
│   │   ├── global_intent.py   # 意图识别
│   │   ├── context_builder.py # 上下文构建
│   │   ├── strategy.py        # 策略生成
│   │   ├── decision.py        # 智能决策
│   │   ├── executor.py        # 执行计划
│   │   ├── perception.py      # 感知判断
│   │   ├── supervisor.py      # 风险控制
│   │   └── memory_learner*.py # 记忆学习
│   │
│   ├── core/                  # 核心运行时
│   │   ├── orchestrator.py    # 编排器
│   │   └── runtime.py         # 任务运行时
│   │
│   ├── memory/                # 三层记忆系统
│   │   ├── types.py           # 记忆类型
│   │   ├── manager.py         # 记忆管理
│   │   └── retriever.py       # 记忆检索
│   │
│   └── app_handlers/          # APP Handler（现已清空）
│       ├── base.py            # 基类定义
│       └── registry.py        # 注册表
│
├── prompts/                   # AI 提示词
├── memory_storage/            # 记忆持久化
├── conversations/             # 对话历史
│
├── API_QUICKSTART.md          # ⭐ 快速开始
├── API_INTEGRATION_GUIDE.md   # 📖 集成指南
├── 测试指南.md                 # 🧪 测试指南
└── requirements_api.txt       # 依赖列表
```

---

## 🔧 调用方需要实现什么？

### 必需接口

#### `POST /execute` - 执行能力

**请求**:
```json
{
  "action": "next",
  "params": []
}
```

**响应**:
```json
{
  "success": true,
  "data": {"video_id": "v123", "title": "视频标题"},
  "message": "成功"
}
```

### 最小示例（Python）

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/execute', methods=['POST'])
def execute():
    data = request.json
    action = data['action']
    params = data.get('params', [])
    
    # 你的实现
    if action == 'next':
        result = your_next_function()
        return jsonify({
            "success": True,
            "data": result,
            "message": "成功"
        })
    
    return jsonify({"success": False, "message": "未知动作"})

app.run(port=5000)
```

**详细说明**: [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)

---

## 🎯 核心 API

### 1. 注册 APP

```http
POST http://localhost:8000/api/register_app
Content-Type: application/json

{
  "app_name": "douyin",
  "callback_url": "http://your-server:5000",
  "capabilities": [
    {
      "name": "next",
      "type": "navigation",
      "description": "切换到下一个视频",
      "params": []
    }
  ]
}
```

### 2. 创建任务

```http
POST http://localhost:8000/api/task
Content-Type: application/json

{
  "message": "帮我找5个AI视频",
  "enable_interaction": false
}
```

### 3. 查询状态

```http
GET http://localhost:8000/api/task/{task_id}
```

**更多 API**: http://localhost:8000/docs

---

## 💡 特色功能

### 1. 三层记忆系统

- **L0 (Global)**: 用户全局偏好
- **L1 (App)**: 应用级记忆
- **L2 (Intent)**: 任务级记忆

自动学习、演化、持久化。

### 2. Token 统计

任务完成后自动输出：
```
💰 Token 统计:
  DecisionAI: 12 次调用, 45,823 tokens
  StrategyAI: 1 次调用, 8,456 tokens
  ...
  总费用: ¥0.0198
```

### 3. 智能决策

- 自动规划执行路径
- 动态调整策略
- 风险控制
- 异常处理

---

## 📊 应用场景

### 1. 社交媒体自动化

- 抖音/快手内容筛选
- 小红书/微博数据采集
- 自动点赞/评论/关注

### 2. 浏览器自动化

- 网页数据采集
- 表单自动填写
- 智能浏览

### 3. 办公自动化

- Excel/Word 操作
- 邮件处理
- 文档整理

### 4. 游戏自动化

- 任务自动完成
- 资源采集
- 智能战斗

---

## ⚙️ 配置说明

### 环境变量 (.env)

```bash
# DeepSeek API（推荐，便宜）
DEEPSEEK_API_KEY=your_api_key
DEEPSEEK_MODEL=deepseek-chat

# 或使用 OpenAI
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4o-mini
```

### 修改 AI 提供商

在 `agent_system/agents/base.py` 中修改：
```python
client = SimpleAIClient(
    provider='deepseek',  # 改为 'openai'
    ...
)
```

---

## 🔍 调试技巧

### 1. 查看详细日志

访问 Swagger UI:
```
http://localhost:8000/docs
```

### 2. 测试回调接口

```bash
curl -X POST http://localhost:5000/execute \
  -H "Content-Type: application/json" \
  -d '{"action": "test", "params": []}'
```

### 3. 查看记忆文件

```bash
cat memory_storage/l2_intent.json | python -m json.tool
```

---

## ❓ 常见问题

### Q: 为什么移除了本地 APP 实现？

**A**: 为了让系统更纯粹、更通用：
- ✅ 完全解耦：Agent 系统不依赖任何具体 APP
- ✅ 灵活扩展：调用方可以连接任何 APP
- ✅ 独立部署：Agent 系统可以部署在云端，服务多个调用方

### Q: 如何连接多个 APP？

**A**: 多次调用注册接口：
```python
# 注册抖音
register_app("douyin", "http://localhost:5000")

# 注册微博
register_app("weibo", "http://localhost:5001")

# 注册浏览器
register_app("browser", "http://localhost:5002")
```

### Q: 性能如何？

**A**: 
- 每个决策需要调用 AI（约 1-3 秒）
- 可以通过缓存、并行调用优化
- 实际测试：完成一个任务约 30-60 秒

### Q: 安全性如何保证？

**A**: 建议：
- 使用 HTTPS
- 添加 API Key 验证
- IP 白名单
- 限流保护

---

## 📞 技术支持

### 文档

- **快速开始**: [API_QUICKSTART.md](API_QUICKSTART.md)
- **完整指南**: [API_INTEGRATION_GUIDE.md](API_INTEGRATION_GUIDE.md)
- **测试指南**: [测试指南.md](测试指南.md)

### 示例代码

- **调用方示例**: [client_example.py](client_example.py)
- **API 服务器**: [api_server.py](api_server.py)

### 在线文档

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🎉 总结

这是一个**真正解耦的智能 Agent 系统**：

✅ Agent 系统 = 纯决策大脑  
✅ 调用方 = 提供执行能力  
✅ 双向 API = 灵活连接  
✅ 8 层 AI = 智能决策  
✅ 记忆系统 = 持续学习  
✅ Token 统计 = 成本可控  

**开始使用**: [API_QUICKSTART.md](API_QUICKSTART.md)

---

**祝你使用愉快！🚀**

