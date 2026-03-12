#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
完整示例：调用方客户端

包含：
1. Flask 服务器（接收 Agent 系统的回调）
2. 客户端代码（注册 APP 并发起任务）
3. 模拟抖音 APP 的各种能力

使用方法：
1. 启动 Agent 系统 API: python api_server.py
2. 启动本服务器: python client_example.py server
3. 运行客户端测试: python client_example.py client
"""

import sys
import requests
import random
import time
from flask import Flask, request, jsonify
from threading import Thread

# ============================================================================
# Flask 服务器部分（接收回调）
# ============================================================================

app = Flask(__name__)

# 模拟视频数据
videos = [
    {
        "video_id": "v1",
        "title": "GPT-4 完整教程：从入门到精通",
        "description": "详细讲解 GPT-4 的使用方法，包括 API 调用、提示词工程等",
        "tags": ["AI", "GPT-4", "技术", "教程"],
        "likes": 2300,
        "comments_count": 150,
        "author": "AI讲师",
        "duration": "15:30"
    },
    {
        "video_id": "v2",
        "title": "今天吃什么？探店美食推荐",
        "description": "给大家推荐一家好吃的川菜餐厅",
        "tags": ["美食", "探店", "生活"],
        "likes": 1500,
        "comments_count": 80,
        "author": "美食博主",
        "duration": "8:20"
    },
    {
        "video_id": "v3",
        "title": "机器学习基础：零基础入门完整课程",
        "description": "从零开始学习机器学习，包括线性回归、决策树等算法",
        "tags": ["机器学习", "AI", "教程", "算法"],
        "likes": 1800,
        "comments_count": 120,
        "author": "ML老师",
        "duration": "20:15"
    },
    {
        "video_id": "v4",
        "title": "搞笑段子合集 😂",
        "description": "笑到肚子疼的搞笑视频合集",
        "tags": ["搞笑", "娱乐", "段子"],
        "likes": 3500,
        "comments_count": 200,
        "author": "段子手",
        "duration": "10:00"
    },
    {
        "video_id": "v5",
        "title": "深度学习实战：图像分类项目",
        "description": "手把手教你用 PyTorch 实现图像分类",
        "tags": ["深度学习", "AI", "PyTorch", "项目"],
        "likes": 2100,
        "comments_count": 95,
        "author": "DL工程师",
        "duration": "18:45"
    }
]

current_index = 0


@app.route('/')
def home():
    """首页"""
    return {
        "name": "抖音模拟器 API",
        "status": "running",
        "current_video": videos[current_index]['title']
    }


@app.route('/execute', methods=['POST'])
def execute():
    """
    执行能力（Agent 系统回调此接口）
    
    请求格式:
    {
        "action": "能力名称",
        "params": ["参数1", "参数2", ...]
    }
    
    响应格式:
    {
        "success": true/false,
        "data": {...},
        "message": "执行结果描述"
    }
    """
    global current_index
    
    data = request.json
    action = data.get('action')
    params = data.get('params', [])
    
    print(f"\n[收到回调] action={action}, params={params}")
    
    # ========================================
    # 导航类
    # ========================================
    
    if action == 'next':
        # 切换到下一个视频
        current_index = (current_index + 1) % len(videos)
        video = videos[current_index]
        
        return jsonify({
            "success": True,
            "data": {
                "current_object_id": video["video_id"],
                "object_type": "video",
                "title": video["title"],
                "author": video["author"],
                "preview": f"{video['title']} - {video['author']}"
            },
            "message": "已切换到下一个视频"
        })
    
    elif action == 'previous':
        # 切换到上一个视频
        current_index = (current_index - 1) % len(videos)
        video = videos[current_index]
        
        return jsonify({
            "success": True,
            "data": {
                "current_object_id": video["video_id"],
                "title": video["title"]
            },
            "message": "已切换到上一个视频"
        })
    
    # ========================================
    # 读取类
    # ========================================
    
    elif action == 'getVideoInfo':
        # 获取当前视频信息
        video = videos[current_index]
        
        return jsonify({
            "success": True,
            "data": video,
            "message": "获取成功"
        })
    
    elif action == 'getComments':
        # 获取评论列表
        page = params[0] if params else 1
        
        # 模拟评论数据
        comments = [
            {
                "id": f"c{page}_{i}",
                "author": f"用户{random.randint(1000, 9999)}",
                "content": random.choice([
                    "讲得很好！",
                    "学到了，感谢分享",
                    "支持！",
                    "已收藏",
                    "太棒了！"
                ]),
                "likes": random.randint(10, 100),
                "created_at": "2024-01-15 12:30:00"
            }
            for i in range(5)
        ]
        
        return jsonify({
            "success": True,
            "data": {
                "comments": comments,
                "has_more": page < 3,
                "page": page,
                "total": 15
            },
            "message": "获取成功"
        })
    
    # ========================================
    # 分析类
    # ========================================
    
    elif action == 'analyze':
        # 分析当前视频
        video = videos[current_index]
        
        return jsonify({
            "success": True,
            "data": {
                "analysis_complete": True,
                "current_object": video,
                "insights": {
                    "is_ai_related": any(tag in ["AI", "机器学习", "深度学习"] for tag in video.get("tags", [])),
                    "quality_score": 0.85,
                    "engagement_rate": 0.72
                }
            },
            "message": "分析完成"
        })
    
    # ========================================
    # 互动类
    # ========================================
    
    elif action == 'like':
        # 点赞
        videos[current_index]['likes'] += 1
        
        return jsonify({
            "success": True,
            "data": {
                "action": "like",
                "result": "success",
                "new_likes_count": videos[current_index]['likes']
            },
            "message": "点赞成功"
        })
    
    elif action == 'comment':
        # 评论
        content = params[0] if params else "默认评论"
        comment_id = f"c{random.randint(1000, 9999)}"
        
        return jsonify({
            "success": True,
            "data": {
                "action": "comment",
                "comment_id": comment_id,
                "content": content,
                "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            "message": "评论成功"
        })
    
    elif action == 'share':
        # 分享
        return jsonify({
            "success": True,
            "data": {
                "action": "share",
                "share_url": f"https://douyin.com/video/{videos[current_index]['video_id']}"
            },
            "message": "分享成功"
        })
    
    # ========================================
    # 控制类
    # ========================================
    
    elif action == 'stop':
        # 停止
        return jsonify({
            "success": True,
            "data": {"stopped": True},
            "message": "已停止"
        })
    
    # ========================================
    # 未知能力
    # ========================================
    
    else:
        return jsonify({
            "success": False,
            "data": {},
            "message": f"未知的能力: {action}"
        }), 400


def run_server():
    """启动 Flask 服务器"""
    print("=" * 80)
    print("🚀 抖音模拟器服务器启动")
    print("=" * 80)
    print("📡 回调接口: http://localhost:5022/execute")
    print("🏠 首页: http://localhost:5022/")
    print()
    print("等待 Agent 系统回调...")
    print()
    
    app.run(host='0.0.0.0', port=5022, debug=False, use_reloader=False)


# ============================================================================
# 客户端部分（注册并发起任务）
# ============================================================================

# Agent 系统 API 地址
AGENT_API = "http://localhost:8000"

# 调用方回调地址
CALLBACK_URL = "http://localhost:5022"


def register_app():
    """注册 APP 能力"""
    capabilities = [
        # 导航类
        {
            "name": "next",
            "type": "navigation",
            "description": "切换到下一个视频",
            "params": []
        },
        {
            "name": "previous",
            "type": "navigation",
            "description": "切换到上一个视频",
            "params": []
        },
        
        # 读取类
        {
            "name": "getVideoInfo",
            "type": "read",
            "description": "获取当前视频的详细信息",
            "params": []
        },
        {
            "name": "getComments",
            "type": "read",
            "description": "获取视频评论列表",
            "params": ["page"]
        },
        
        # 分析类
        {
            "name": "analyze",
            "type": "analyze",
            "description": "分析当前视频内容",
            "params": []
        },
        
        # 互动类
        {
            "name": "like",
            "type": "engage",
            "description": "点赞当前视频",
            "params": []
        },
        {
            "name": "comment",
            "type": "engage",
            "description": "评论当前视频",
            "params": ["content"]
        },
        {
            "name": "share",
            "type": "engage",
            "description": "分享当前视频",
            "params": []
        },
        
        # 控制类
        {
            "name": "stop",
            "type": "control",
            "description": "停止当前任务",
            "params": []
        }
    ]
    
    try:
        response = requests.post(
            f"{AGENT_API}/api/register_app",
            json={
                "app_name": "douyin",
                "callback_url": CALLBACK_URL,
                "capabilities": capabilities,
                "timeout": 30
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 注册成功: {result['message']}")
            print(f"  能力数量: {result['capabilities_count']}")
            return True
        else:
            print(f"✗ 注册失败: {response.status_code}")
            print(f"  响应: {response.text}")
            return False
    
    except Exception as e:
        print(f"✗ 注册出错: {e}")
        return False


def create_task(message):
    """创建任务"""
    try:
        response = requests.post(
            f"{AGENT_API}/api/task",
            json={
                "message": message,
                "enable_interaction": False
            },
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✓ 任务已创建: {result['task_id']}")
            return result['task_id']
        else:
            print(f"✗ 创建任务失败: {response.status_code}")
            return None
    
    except Exception as e:
        print(f"✗ 创建任务出错: {e}")
        return None


def get_task_status(task_id):
    """查询任务状态"""
    try:
        response = requests.get(f"{AGENT_API}/api/task/{task_id}", timeout=10)
        
        if response.status_code == 200:
            return response.json()
        else:
            return None
    
    except Exception as e:
        print(f"✗ 查询状态出错: {e}")
        return None


def run_client():
    """运行客户端测试"""
    print("=" * 80)
    print("🚀 AI Agent 系统 - 客户端示例")
    print("=" * 80)
    print()
    
    # 1. 注册 APP
    print("[步骤 1] 注册 APP 能力...")
    if not register_app():
        print("注册失败，请检查 Agent 系统是否启动")
        return
    print()
    
    # 2. 创建任务
    print("[步骤 2] 创建任务...")
    task_id = create_task("帮我在抖音上找3个关于人工智能的视频")
    if not task_id:
        print("创建任务失败")
        return
    print()
    
    # 3. 轮询任务状态
    print("[步骤 3] 查询任务状态...")
    print("（任务在后台执行，可能需要 30-60 秒）")
    print()
    
    last_status = None
    while True:
        status = get_task_status(task_id)
        if not status:
            print("查询失败，请检查网络连接")
            break
        
        # 只在状态变化时输出
        if status['status'] != last_status:
            print(f"  状态: {status['status']}")
            last_status = status['status']
        
        if status['status'] in ['completed', 'failed']:
            break
        
        time.sleep(3)
    
    # 4. 输出结果
    print()
    print("=" * 80)
    print("📊 任务完成")
    print("=" * 80)
    print(f"状态: {status['status']}")
    print(f"\n进度:")
    for key, value in status['progress'].items():
        print(f"  {key}: {value}")
    
    if status.get('token_stats'):
        print("\n💰 Token 统计:")
        total_tokens = 0
        total_calls = 0
        for ai_name, stats in status['token_stats'].items():
            total_tokens += stats['total_tokens']
            total_calls += stats['call_count']
            print(f"  {ai_name}:")
            print(f"    调用次数: {stats['call_count']}")
            print(f"    总 tokens: {stats['total_tokens']:,}")
        
        print(f"\n  总计:")
        print(f"    AI 调用次数: {total_calls}")
        print(f"    总 tokens: {total_tokens:,}")
    
    if status.get('error'):
        print(f"\n❌ 错误: {status['error']}")


# ============================================================================
# 主程序
# ============================================================================

def print_usage():
    """打印使用说明"""
    print("""
使用方法:

1. 启动服务器（接收回调）:
   python client_example.py server

2. 运行客户端测试（另开一个终端）:
   python client_example.py client

3. 完整测试流程:
   # 终端 1: 启动 Agent 系统
   python api_server.py
   
   # 终端 2: 启动调用方服务器
   python client_example.py server
   
   # 终端 3: 运行客户端测试
   python client_example.py client
    """)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(0)
    
    mode = sys.argv[1]
    
    if mode == 'server':
        run_server()
    elif mode == 'client':
        run_client()
    else:
        print(f"未知模式: {mode}")
        print_usage()

