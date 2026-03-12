# 🔌 AI Agent 系统 API 集成指南

## 📋 目录

1. [架构概述](#架构概述)
2. [双向 API 协议](#双向-api-协议)
3. [调用方需要实现的接口](#调用方需要实现的接口)
4. [Agent 系统提供的接口](#agent-系统提供的接口)
5. [完整示例代码](#完整示例代码)
6. [能力注册规范](#能力注册规范)
7. [常见问题](#常见问题)

---

## 架构概述

### 双向 API 架构

```
┌─────────────────────┐                    ┌──────────────────────┐
│   调用方应用         │                    │  Agent 系统 API       │
│   (Client App)      │                    │  (Agent Server)      │
│                     │                    │                      │
│  ┌───────────────┐  │                    │  ┌────────────────┐  │
│  │ 能力提供者     │  │                    │  │ 8 层 Agent     │  │
│  │ (Executor)    │  │                    │  │ (决策系统)     │  │
│  └───────────────┘  │                    │  └────────────────┘  │
│         ▲            │                    │         │            │
│         │ 5. 执行     │                    │         │            │
│         │            │                    │         │            │
│  ┌───────────────┐  │                    │  ┌────────────────┐  │
│  │ API 服务器     │  │                    │  │ HTTP 客户端    │  │
│  │ (Flask/FastAPI│  │                    │  │ (回调调用)     │  │
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
           │ 6. 返回执行结果                            │
           ├──────────────────────────────────────────>│
           │                                           │
           │ 7. 查询任务状态                            │
           ├──────────────────────────────────────────>│
           │   GET /api/task/{task_id}                 │
           │                                           │
```

### 核心概念

1. **能力注册**: 调用方向 Agent 系统注册 APP 能力和回调 URL
2. **任务执行**: Agent 系统接收任务并通过 8 层 AI 智能决策
3. **能力回调**: Agent 系统通过 HTTP 回调执行调用方的能力
4. **结果返回**: 调用方返回执行结果，Agent 系统继续决策

---

## 双向 API 协议

### 1. 调用方 → Agent 系统

#### 1.1 注册 APP 能力

```http
POST http://agent-server:8000/api/register_app
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
    },
    {
      "name": "getVideoInfo",
      "type": "read",
      "description": "获取当前视频信息",
      "params": []
    },
    {
      "name": "like",
      "type": "engage",
      "description": "点赞当前视频",
      "params": []
    }
  ],
  "timeout": 30
}
```

**响应**:
```json
{
  "success": true,
  "message": "APP 'douyin' 注册成功",
  "app_name": "douyin",
  "capabilities_count": 3
}
```

#### 1.2 创建任务

```http
POST http://agent-server:8000/api/task
Content-Type: application/json

{
  "message": "帮我在抖音上找5个关于人工智能的视频",
  "enable_interaction": false
}
```

**响应**:
```json
{
  "success": true,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message": "任务已创建，正在后台执行",
  "status_url": "/api/task/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

#### 1.3 查询任务状态

```http
GET http://agent-server:8000/api/task/{task_id}
```

**响应**:
```json
{
  "success": true,
  "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "progress": {
    "objects_processed": 8,
    "objects_matched": 5,
    "engagements_made": 5
  },
  "result": {
    "message": "任务执行完成"
  },
  "token_stats": {
    "DecisionAI": {
      "call_count": 12,
      "total_tokens": 45823,
      "prompt_tokens": 38240,
      "completion_tokens": 7583
    }
  },
  "error": null
}
```

**任务状态说明**:
- `pending`: 等待执行
- `running`: 正在执行
- `completed`: 执行完成
- `failed`: 执行失败

---

### 2. Agent 系统 → 调用方

#### 2.1 执行能力回调

```http
POST http://your-server:5000/execute
Content-Type: application/json

{
  "action": "next",
  "params": []
}
```

**调用方需要返回**:
```json
{
  "success": true,
  "data": {
    "video_id": "v12345",
    "title": "深度学习入门教程",
    "author": "AI讲师",
    "likes": 2300,
    "description": "从零开始学习深度学习..."
  },
  "message": "已切换到下一个视频"
}
```

**错误响应**:
```json
{
  "success": false,
  "data": {},
  "message": "操作失败：网络错误"
}
```

---

## 调用方需要实现的接口

### 必需接口

#### `POST /execute` - 执行能力

**请求格式**:
```json
{
  "action": "能力名称",
  "params": ["参数1", "参数2", ...]
}
```

**响应格式**:
```json
{
  "success": true/false,
  "data": {
    // 返回的数据（根据不同的 action 返回不同的数据）
  },
  "message": "执行结果描述"
}
```

### 能力类型与返回数据规范

#### 1. `navigation` - 导航类

**示例**:
```json
// 请求
{
  "action": "next",
  "params": []
}

// 响应
{
  "success": true,
  "data": {
    "current_object_id": "v12345",
    "object_type": "video",
    "title": "视频标题",
    "author": "作者名",
    "preview": "预览信息..."
  },
  "message": "已切换到下一个对象"
}
```

#### 2. `read` - 读取类

**示例**:
```json
// 请求 - 获取视频信息
{
  "action": "getVideoInfo",
  "params": []
}

// 响应
{
  "success": true,
  "data": {
    "video_id": "v12345",
    "title": "视频标题",
    "description": "视频描述",
    "tags": ["AI", "技术"],
    "likes": 2300,
    "comments_count": 150,
    "author": {
      "name": "作者名",
      "followers": 10000
    }
  },
  "message": "获取成功"
}
```

```json
// 请求 - 获取评论
{
  "action": "getComments",
  "params": [1]  // 页码
}

// 响应
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": "c1",
        "author": "用户A",
        "content": "讲得很好！",
        "likes": 50
      },
      {
        "id": "c2",
        "author": "用户B",
        "content": "学到了",
        "likes": 30
      }
    ],
    "has_more": true,
    "page": 1
  },
  "message": "获取成功"
}
```

#### 3. `analyze` - 分析类

**示例**:
```json
// 请求
{
  "action": "analyze",
  "params": []
}

// 响应
{
  "success": true,
  "data": {
    "analysis_complete": true,
    "current_object": {
      // 当前对象的完整信息
    }
  },
  "message": "分析完成"
}
```

#### 4. `engage` - 互动类

**示例**:
```json
// 请求 - 点赞
{
  "action": "like",
  "params": []
}

// 响应
{
  "success": true,
  "data": {
    "action": "like",
    "result": "success",
    "new_likes_count": 2301
  },
  "message": "点赞成功"
}
```

```json
// 请求 - 评论
{
  "action": "comment",
  "params": ["这个视频讲得很好！"]
}

// 响应
{
  "success": true,
  "data": {
    "action": "comment",
    "comment_id": "c12345",
    "content": "这个视频讲得很好！"
  },
  "message": "评论成功"
}
```

#### 5. `control` - 控制类

**示例**:
```json
// 请求 - 停止
{
  "action": "stop",
  "params": []
}

// 响应
{
  "success": true,
  "data": {
    "stopped": true
  },
  "message": "已停止"
}
```

---

## Agent 系统提供的接口

### 1. `POST /api/register_app` - 注册 APP

### 2. `GET /api/apps` - 列出已注册的 APP

```http
GET http://agent-server:8000/api/apps
```

**响应**:
```json
{
  "success": true,
  "apps": [
    {
      "app_name": "douyin",
      "callback_url": "http://your-server:5000",
      "capabilities_count": 10,
      "capabilities": [
        {
          "name": "next",
          "type": "navigation",
          "description": "切换到下一个视频"
        }
      ]
    }
  ]
}
```

### 3. `POST /api/task` - 创建任务

### 4. `GET /api/task/{task_id}` - 查询任务状态

### 5. `POST /api/task/{task_id}/cancel` - 取消任务（暂未实现）

---

## 完整示例代码

### 示例 1: Python Flask 调用方

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
调用方示例 - Flask 服务器

提供：
1. /execute 接口（接收 Agent 系统的回调）
2. 模拟抖音 APP 的各种能力
"""

from flask import Flask, request, jsonify
import random

app = Flask(__name__)

# 模拟数据
videos = [
    {
        "video_id": "v1",
        "title": "GPT-4 完整教程：从入门到精通",
        "description": "详细讲解 GPT-4 的使用方法...",
        "tags": ["AI", "GPT-4", "技术"],
        "likes": 2300,
        "author": "AI讲师"
    },
    {
        "video_id": "v2",
        "title": "今天吃什么？探店美食",
        "description": "给大家推荐一家好吃的餐厅...",
        "tags": ["美食", "探店"],
        "likes": 1500,
        "author": "美食博主"
    },
    {
        "video_id": "v3",
        "title": "机器学习基础：零基础入门",
        "description": "从零开始学习机器学习...",
        "tags": ["机器学习", "AI", "教程"],
        "likes": 1800,
        "author": "ML老师"
    }
]

current_index = 0


@app.route('/execute', methods=['POST'])
def execute():
    """执行能力"""
    global current_index
    
    data = request.json
    action = data.get('action')
    params = data.get('params', [])
    
    print(f"[收到回调] action={action}, params={params}")
    
    # 导航类
    if action == 'next':
        current_index = (current_index + 1) % len(videos)
        return jsonify({
            "success": True,
            "data": videos[current_index],
            "message": "已切换到下一个视频"
        })
    
    # 读取类
    elif action == 'getVideoInfo':
        return jsonify({
            "success": True,
            "data": videos[current_index],
            "message": "获取成功"
        })
    
    elif action == 'getComments':
        page = params[0] if params else 1
        comments = [
            {"id": f"c{i}", "author": f"用户{i}", "content": "很棒！", "likes": random.randint(10, 100)}
            for i in range(5)
        ]
        return jsonify({
            "success": True,
            "data": {
                "comments": comments,
                "has_more": page < 3,
                "page": page
            },
            "message": "获取成功"
        })
    
    # 分析类
    elif action == 'analyze':
        return jsonify({
            "success": True,
            "data": {
                "analysis_complete": True,
                "current_object": videos[current_index]
            },
            "message": "分析完成"
        })
    
    # 互动类
    elif action == 'like':
        videos[current_index]['likes'] += 1
        return jsonify({
            "success": True,
            "data": {
                "action": "like",
                "new_likes_count": videos[current_index]['likes']
            },
            "message": "点赞成功"
        })
    
    elif action == 'comment':
        content = params[0] if params else "默认评论"
        return jsonify({
            "success": True,
            "data": {
                "action": "comment",
                "comment_id": f"c{random.randint(1000, 9999)}",
                "content": content
            },
            "message": "评论成功"
        })
    
    # 控制类
    elif action == 'stop':
        return jsonify({
            "success": True,
            "data": {"stopped": True},
            "message": "已停止"
        })
    
    # 未知能力
    else:
        return jsonify({
            "success": False,
            "data": {},
            "message": f"未知的能力: {action}"
        }), 400


if __name__ == '__main__':
    print("🚀 调用方服务器启动")
    print("📡 回调接口: http://localhost:5000/execute")
    app.run(host='0.0.0.0', port=5000, debug=True)
```

### 示例 2: Python 客户端（注册并发起任务）

```python
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
客户端示例 - 注册 APP 并发起任务
"""

import requests
import time

# Agent 系统 API 地址
AGENT_API = "http://localhost:8000"

# 调用方回调地址
CALLBACK_URL = "http://localhost:5000"


def register_app():
    """注册 APP 能力"""
    capabilities = [
        {
            "name": "next",
            "type": "navigation",
            "description": "切换到下一个视频",
            "params": []
        },
        {
            "name": "getVideoInfo",
            "type": "read",
            "description": "获取当前视频信息",
            "params": []
        },
        {
            "name": "getComments",
            "type": "read",
            "description": "获取视频评论",
            "params": ["page"]
        },
        {
            "name": "analyze",
            "type": "analyze",
            "description": "分析当前视频",
            "params": []
        },
        {
            "name": "like",
            "type": "engage",
            "description": "点赞视频",
            "params": []
        },
        {
            "name": "comment",
            "type": "engage",
            "description": "评论视频",
            "params": ["content"]
        },
        {
            "name": "stop",
            "type": "control",
            "description": "停止任务",
            "params": []
        }
    ]
    
    response = requests.post(
        f"{AGENT_API}/api/register_app",
        json={
            "app_name": "douyin",
            "callback_url": CALLBACK_URL,
            "capabilities": capabilities,
            "timeout": 30
        }
    )
    
    result = response.json()
    print(f"✓ 注册成功: {result['message']}")
    return result


def create_task(message):
    """创建任务"""
    response = requests.post(
        f"{AGENT_API}/api/task",
        json={
            "message": message,
            "enable_interaction": False
        }
    )
    
    result = response.json()
    print(f"✓ 任务已创建: {result['task_id']}")
    return result['task_id']


def get_task_status(task_id):
    """查询任务状态"""
    response = requests.get(f"{AGENT_API}/api/task/{task_id}")
    return response.json()


def main():
    print("=" * 80)
    print("🚀 AI Agent 系统 - 客户端示例")
    print("=" * 80)
    print()
    
    # 1. 注册 APP
    print("[步骤 1] 注册 APP 能力...")
    register_app()
    print()
    
    # 2. 创建任务
    print("[步骤 2] 创建任务...")
    task_id = create_task("帮我在抖音上找3个关于人工智能的视频")
    print()
    
    # 3. 轮询任务状态
    print("[步骤 3] 查询任务状态...")
    while True:
        status = get_task_status(task_id)
        print(f"  状态: {status['status']}")
        
        if status['status'] in ['completed', 'failed']:
            break
        
        time.sleep(2)
    
    # 4. 输出结果
    print()
    print("=" * 80)
    print("📊 任务完成")
    print("=" * 80)
    print(f"状态: {status['status']}")
    print(f"进度: {status['progress']}")
    
    if status.get('token_stats'):
        print("\nToken 统计:")
        for ai_name, stats in status['token_stats'].items():
            print(f"  {ai_name}: {stats['total_tokens']} tokens")
    
    if status.get('error'):
        print(f"\n错误: {status['error']}")


if __name__ == '__main__':
    main()
```

---

## 能力注册规范

### 能力类型（type）

| 类型 | 说明 | 示例 |
|------|------|------|
| `navigation` | 导航类（切换对象、跳转） | next, previous, search |
| `read` | 读取类（获取信息） | getVideoInfo, getComments, getProfile |
| `analyze` | 分析类（触发分析） | analyze, evaluate |
| `engage` | 互动类（点赞、评论） | like, comment, share, follow |
| `control` | 控制类（停止、暂停） | stop, pause, resume |

### 参数规范

```python
# 无参数
{
  "name": "next",
  "params": []
}

# 单个参数
{
  "name": "getComments",
  "params": ["page"]  # 参数名列表
}

# 多个参数
{
  "name": "search",
  "params": ["keyword", "page", "sort"]
}
```

### 能力命名规范

1. **使用小驼峰命名**: `getVideoInfo`, `nextPage`
2. **动词开头**: `get`, `set`, `add`, `remove`, `update`
3. **语义清晰**: 一看就知道功能

---

## 常见问题

### Q1: 回调超时怎么办？

**A**: 默认超时时间是 30 秒，可以在注册时设置：

```json
{
  "timeout": 60  // 60 秒超时
}
```

如果超时，Agent 系统会返回错误并尝试其他策略。

### Q2: 能力执行失败如何处理？

**A**: 返回 `success: false` 即可：

```json
{
  "success": false,
  "data": {},
  "message": "执行失败：网络错误"
}
```

Agent 系统的 SupervisorAI 会检测错误并决定是否重试或停止。

### Q3: 如何支持流式返回？

**A**: 当前版本暂不支持流式返回，建议：
- 如果数据量大，分页返回
- 如果处理时间长，先返回部分结果

### Q4: 可以动态注册新能力吗？

**A**: 可以！随时调用 `/api/register_app` 重新注册，会覆盖之前的配置。

### Q5: 如何保证安全性？

**建议**:
1. 使用 HTTPS
2. 添加 API Key 验证
3. IP 白名单
4. 限流保护

---

## 📞 技术支持

如有问题，请查看：
- API 文档: `http://localhost:8000/docs`
- 源码: `ai/api_server.py`
- 示例: `ai/client_example.py`

---

**祝集成顺利！🎉**

