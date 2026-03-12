#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Token 统计功能测试

演示：
1. 每个 AI 的 token 消耗记录
2. 任务完成后统一输出统计报告
3. 费用估算
"""

import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent_system.core.orchestrator import AgentOrchestrator
from agent_system.app_handlers.registry import AppRegistry
from agent_system.app_handlers.examples.douyin_mock import DouyinMockHandler


def main():
    """主测试流程"""
    print("""
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           📊 Token 统计功能测试                                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # 注册 APP
    print("📝 注册应用: douyin\n")
    AppRegistry.register("douyin", DouyinMockHandler())
    
    # 创建 orchestrator（禁用人机交互，加快测试）
    orchestrator = AgentOrchestrator(enable_interaction=False)
    
    # 执行一个简单的任务
    print("🚀 开始执行任务...\n")
    orchestrator.run_task("帮我在抖音上找2个关于AI的视频")
    
    print("\n✅ 测试完成！")
    print("\n💡 说明:")
    print("  - 每个 AI 的调用次数和 token 消耗已被记录")
    print("  - 任务完成后会自动输出统计报告")
    print("  - 费用按 DeepSeek 价格估算（输入 0.14¥/M，输出 0.28¥/M）")
    print("  - 如果使用缓存，缓存 token 费用为输入的 1/10")


if __name__ == "__main__":
    main()

