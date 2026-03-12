# 🚀 双向 API 快速开始

## 5 分钟快速测试

### 第 1 步：安装依赖

```bash
cd /Users/cih1996/AI-intelligent-agent-system/ai

# 安装 API 服务器依赖
pip install -r requirements_api.txt
```

### 第 2 步：启动 Agent 系统 API 服务器

```bash
# 终端 1
python api_server.py
```

**预期输出**:
```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🚀 AI Agent 系统 API 服务器                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝

📡 启动服务器...
📚 API 文档: http://localhost:8000/docs
🔍 交互式文档: http://localhost:8000/redoc

INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 第 3 步：启动调用方服务器（模拟抖音）

```bash
# 终端 2（新开一个终端）
python client_example.py server
```

**预期输出**:
```
================================================================================
🚀 抖音模拟器服务器启动
================================================================================
📡 回调接口: http://localhost:5000/execute
🏠 首页: http://localhost:5000/

等待 Agent 系统回调...

 * Running on http://0.0.0.0:5000
```

### 第 4 步：运行客户端测试

```bash
# 终端 3（新开一个终端）
python client_example.py client
```

**预期输出**:
```
================================================================================
🚀 AI Agent 系统 - 客户端示例
================================================================================

[步骤 1] 注册 APP 能力...
✓ 注册成功: APP 'douyin' 注册成功
  能力数量: 9

[步骤 2] 创建任务...
✓ 任务已创建: a1b2c3d4-e5f6-7890-abcd-ef1234567890

[步骤 3] 查询任务状态...
（任务在后台执行，可能需要 30-60 秒）

  状态: running
  状态: completed

================================================================================
📊 任务完成
================================================================================
状态: completed

进度:
  objects_processed: 5
  objects_matched: 3
  engagements_made: 3

💰 Token 统计:
  DecisionAI:
    调用次数: 8
    总 tokens: 32,450
  StrategyAI:
    调用次数: 1
    总 tokens: 5,120
  ...

  总计:
    AI 调用次数: 18
    总 tokens: 85,340
```

### 第 5 步：观察日志

**终端 2（调用方服务器）会显示回调日志**:
```
[收到回调] action=next, params=[]
[收到回调] action=getVideoInfo, params=[]
[收到回调] action=analyze, params=[]
[收到回调] action=like, params=[]
[收到回调] action=next, params=[]
...
```

---

## 📚 访问 API 文档

浏览器打开：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

可以在文档中查看所有 API 接口并直接测试。

---

## 🔧 自定义调用方

### 最小示例（Python）

```python
# 1. 创建 Flask 服务器（server.py）
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/execute', methods=['POST'])
def execute():
    data = request.json
    action = data.get('action')
    params = data.get('params', [])
    
    # 处理不同的 action
    if action == 'next':
        return jsonify({
            "success": True,
            "data": {"video_id": "v123", "title": "示例视频"},
            "message": "成功"
        })
    
    return jsonify({"success": False, "message": "未知操作"})

if __name__ == '__main__':
    app.run(port=5000)
```

```python
# 2. 注册并发起任务（client.py）
import requests

# 注册 APP
requests.post("http://localhost:8000/api/register_app", json={
    "app_name": "my_app",
    "callback_url": "http://localhost:5000",
    "capabilities": [
        {"name": "next", "type": "navigation", "description": "下一个", "params": []}
    ]
})

# 发起任务
response = requests.post("http://localhost:8000/api/task", json={
    "message": "找一些视频",
    "enable_interaction": False
})
task_id = response.json()['task_id']

# 查询状态
status = requests.get(f"http://localhost:8000/api/task/{task_id}").json()
print(status)
```

---

## 🌐 跨网络部署

### Agent 系统在云端

```python
# 调用方需要提供公网可访问的回调 URL
AGENT_API = "http://your-agent-server.com:8000"
CALLBACK_URL = "http://your-server.com:5000"  # 必须是公网 IP

requests.post(f"{AGENT_API}/api/register_app", json={
    "callback_url": CALLBACK_URL,  # 公网地址
    ...
})
```

### 使用 ngrok 暴露本地服务

```bash
# 安装 ngrok
# https://ngrok.com/

# 暴露本地 5000 端口
ngrok http 5000

# 使用 ngrok 提供的 URL 作为 callback_url
# 例如: https://abc123.ngrok.io
```

---

## 📊 监控和调试

### 查看已注册的 APP

```bash
curl http://localhost:8000/api/apps
```

### 查看任务状态

```bash
curl http://localhost:8000/api/task/{task_id}
```

### 日志位置

- **Agent 系统日志**: 终端 1 输出
- **调用方日志**: 终端 2 输出
- **AI 历史记录**: `conversations/` 目录
- **记忆文件**: `memory_storage/` 目录

---

## ⚠️ 常见问题

### Q: 端口被占用

**A**: 修改端口号
```python
# api_server.py 最后一行
uvicorn.run(app, host="0.0.0.0", port=8001)  # 改为 8001

# client_example.py
app.run(port=5001)  # 改为 5001
```

### Q: 连接超时

**A**: 检查防火墙设置，确保端口开放

### Q: 回调失败

**A**: 
1. 检查 callback_url 是否正确
2. 确保调用方服务器已启动
3. 查看终端 2 的日志

### Q: Agent 决策很慢

**A**: 这是正常的，因为：
1. 每次决策都要调用 AI（DeepSeek API）
2. 网络延迟
3. 思考时间

可以在 `api_server.py` 中调整参数加速测试。

---

## 📖 下一步

1. 阅读完整文档: `API_INTEGRATION_GUIDE.md`
2. 查看源码: `api_server.py` 和 `client_example.py`
3. 自定义你的 APP 能力
4. 集成到你的实际应用中

---

## 🎯 架构总结

```
你的应用 (调用方)           Agent 系统
    │                          │
    ├─ Flask/FastAPI ────────> │ 1. 注册能力
    │  服务器                  │
    │                          │
    ├─────────────────────────> │ 2. 发起任务
    │                          │
    │                          │ 3. AI 智能决策
    │                    ┌─────┴─────┐
    │                    │ 8层Agent   │
    │                    │ 决策系统   │
    │                    └─────┬─────┘
    │                          │ 4. 需要执行能力
    │ <─────────────────────── │    (HTTP 回调)
    │                          │
    │ 5. 执行能力并返回结果      │
    ├─────────────────────────> │
    │                          │ 6. 继续决策...
    │                          │
    │ 7. 返回最终结果           │
    │ <─────────────────────── │
    │                          │
```

**核心价值**:
- ✅ 解耦：Agent 系统和具体执行分离
- ✅ 灵活：可以连接任何 APP（抖音、微博、浏览器...）
- ✅ 智能：8 层 AI 自动决策
- ✅ 简单：只需实现 `/execute` 接口

---

**祝你集成顺利！🎉**

如有问题，请查看 `API_INTEGRATION_GUIDE.md` 获取更多细节。

