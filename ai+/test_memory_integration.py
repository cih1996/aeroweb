#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
完整的记忆系统集成测试

测试内容：
1. 第一轮任务执行 → 生成记忆
2. 检查记忆持久化
3. 第二轮任务执行 → 读取并应用记忆
4. 验证 AI 层使用记忆的效果
"""

import sys
import os
import time
import json

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent_system.memory import (
    MemoryManager, MemoryRetriever, MemoryEntry, MemoryScope,
    MemoryLevel, MemoryType, MemoryStage
)
from agent_system.core.orchestrator import AgentOrchestrator


def print_section(title):
    """打印分隔符"""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def test_first_run():
    """第一轮任务：生成记忆"""
    print_section("🚀 第一轮任务：生成记忆")
    
    orchestrator = AgentOrchestrator(enable_interaction=False)
    orchestrator.run_task("帮我在抖音上找一些关于人工智能的视频")
    
    print("\n✅ 第一轮任务完成")


def check_memory_persistence():
    """检查记忆持久化"""
    print_section("📦 检查记忆持久化")
    
    manager = MemoryManager()
    
    # 使用 get_all() 获取所有记忆
    all_memories = manager.get_all()
    
    # 统计各层级的记忆数量
    l0_count = sum(1 for m in all_memories if m.scope.level == MemoryLevel.GLOBAL)
    l1_count = sum(1 for m in all_memories if m.scope.level == MemoryLevel.APP)
    l2_count = sum(1 for m in all_memories if m.scope.level == MemoryLevel.INTENT)
    
    print(f"记忆统计:")
    print(f"  L0 (Global): {l0_count} 条")
    print(f"  L1 (App):    {l1_count} 条")
    print(f"  L2 (Intent): {l2_count} 条")
    print(f"  总计:        {l0_count + l1_count + l2_count} 条")
    
    # 打印记忆详情
    l2_memories = [m for m in all_memories if m.scope.level == MemoryLevel.INTENT]
    if l2_memories:
        print(f"\nL2 (Intent) 记忆详情:")
        for mem in l2_memories[:3]:
            print(f"  • {mem.type.value} | stage={mem.stage.value} | conf={mem.confidence:.2f}")
            print(f"    signals: {list(mem.signals.keys())}")
    
    return l0_count + l1_count + l2_count > 0


def test_second_run():
    """第二轮任务：使用记忆"""
    print_section("🔄 第二轮任务：使用记忆")
    
    orchestrator = AgentOrchestrator(enable_interaction=False)
    
    # 类似的任务，应该能利用历史记忆
    orchestrator.run_task("再找几个关于AI的抖音视频")
    
    print("\n✅ 第二轮任务完成")


def verify_memory_usage():
    """验证 AI 层使用记忆的效果"""
    print_section("🔍 验证记忆使用效果")
    
    retriever = MemoryRetriever()
    
    # 1. 验证 GlobalIntentAI 可以读取用户画像
    print("[1] GlobalIntentAI 读取用户画像:")
    global_scope = MemoryScope(level=MemoryLevel.GLOBAL)
    profiles = retriever.retrieve_user_profiles(
        ai_name="GlobalIntentAI",
        scope=global_scope,
        min_stage=MemoryStage.OBSERVATION
    )
    print(f"    找到 {len(profiles)} 个用户画像")
    
    # 2. 验证 StrategyAI 可以读取策略模板
    print("\n[2] StrategyAI 读取策略模板:")
    intent_scope = MemoryScope(
        level=MemoryLevel.INTENT,
        app="douyin",
        intent="policy_research"
    )
    strategies = retriever.retrieve_strategy_templates(
        ai_name="StrategyAI",
        scope=intent_scope,
        min_stage=MemoryStage.OBSERVATION
    )
    print(f"    找到 {len(strategies)} 个策略模板")
    
    # 3. 验证 DecisionAI 可以读取决策偏好
    print("\n[3] DecisionAI 读取决策偏好:")
    decisions = retriever.retrieve_decision_preferences(
        ai_name="DecisionAI",
        scope=intent_scope,
        min_stage=MemoryStage.OBSERVATION
    )
    print(f"    找到 {len(decisions)} 个决策偏好")
    
    # 4. 验证 SupervisorAI 可以读取用户偏好
    print("\n[4] SupervisorAI 读取用户偏好:")
    prefs = retriever.retrieve_user_profiles(
        ai_name="SupervisorAI",
        scope=global_scope,
        min_stage=MemoryStage.OBSERVATION
    )
    print(f"    找到 {len(prefs)} 个用户偏好")
    
    total_memories = len(profiles) + len(strategies) + len(decisions) + len(prefs)
    print(f"\n总计可用记忆: {total_memories} 条")
    
    return total_memories > 0


def test_memory_evolution():
    """测试记忆演化（多次运行后记忆升级）"""
    print_section("📈 测试记忆演化")
    
    manager = MemoryManager()
    
    # 模拟一个策略模板记忆被多次确认
    scope = MemoryScope(level=MemoryLevel.INTENT, app="douyin", intent="ai_research")
    
    # 第一次：OBSERVATION
    mem1 = MemoryEntry(
        id="test_strategy_1",
        scope=scope,
        type=MemoryType.STRATEGY_TEMPLATE,
        stage=MemoryStage.OBSERVATION,
        created_at=time.time(),
        last_seen=time.time(),
        confidence=0.6,
        count=1,
        signals={
            "strategy_snapshot": {"min_match_score": 0.7},
            "success_rate": 0.6
        },
        negative_samples=[]
    )
    manager.add_memory(mem1)
    print("添加第一次观测 (OBSERVATION, confidence=0.6)")
    
    # 第二次：应该升级到 CANDIDATE
    mem2 = MemoryEntry(
        id="test_strategy_2",
        scope=scope,
        type=MemoryType.STRATEGY_TEMPLATE,
        stage=MemoryStage.OBSERVATION,
        created_at=time.time(),
        last_seen=time.time(),
        confidence=0.7,
        count=1,
        signals={
            "strategy_snapshot": {"min_match_score": 0.7},
            "success_rate": 0.7
        },
        negative_samples=[]
    )
    manager.add_memory(mem2)
    print("添加第二次观测 (OBSERVATION, confidence=0.7)")
    
    # 检查合并结果
    merged_memories = manager.memories.get(MemoryLevel.INTENT, [])
    strategy_mem = next((m for m in merged_memories if m.type == MemoryType.STRATEGY_TEMPLATE), None)
    
    if strategy_mem:
        print(f"\n合并后的记忆:")
        print(f"  • stage: {strategy_mem.stage.value}")
        print(f"  • confidence: {strategy_mem.confidence:.2f}")
        print(f"  • count: {strategy_mem.count}")
        
        if strategy_mem.stage == MemoryStage.CANDIDATE:
            print("\n✅ 记忆成功升级到 CANDIDATE 阶段！")
            return True
        else:
            print(f"\n⚠️ 记忆未升级，当前阶段: {strategy_mem.stage.value}")
            return False
    else:
        print("\n❌ 未找到策略记忆")
        return False


def main():
    """主测试流程"""
    print("""
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🧠 三层记忆系统 - 完整集成测试                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    # 清理旧记忆（可选）
    storage_dir = "memory_storage"
    if os.path.exists(storage_dir):
        print(f"⚠️  清理旧记忆文件: {storage_dir}")
        import shutil
        shutil.rmtree(storage_dir)
    
    # 注册 APP
    from agent_system.app_handlers.registry import AppRegistry
    from agent_system.app_handlers.examples.douyin_mock import DouyinMockHandler
    
    print("📝 注册应用: douyin")
    AppRegistry.register("douyin", DouyinMockHandler())
    
    results = {}
    
    try:
        # 测试 1: 第一轮任务
        test_first_run()
        results["first_run"] = "✅ 通过"
        
        # 测试 2: 检查持久化
        has_memories = check_memory_persistence()
        results["persistence"] = "✅ 通过" if has_memories else "❌ 失败"
        
        # 测试 3: 第二轮任务
        test_second_run()
        results["second_run"] = "✅ 通过"
        
        # 测试 4: 验证记忆使用
        memory_used = verify_memory_usage()
        results["memory_usage"] = "✅ 通过" if memory_used else "⚠️  无记忆"
        
        # 测试 5: 记忆演化
        evolved = test_memory_evolution()
        results["evolution"] = "✅ 通过" if evolved else "⚠️  未升级"
        
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")
        import traceback
        traceback.print_exc()
    
    # 打印测试结果
    print_section("📊 测试结果汇总")
    
    for test_name, status in results.items():
        print(f"  {status}  {test_name}")
    
    passed = sum(1 for s in results.values() if "✅" in s)
    total = len(results)
    
    print(f"\n总体结果: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！记忆系统已完全融合到 8 层 AI！")
    elif passed >= total * 0.8:
        print("\n✅ 大部分测试通过，记忆系统基本融合成功")
    else:
        print("\n⚠️  部分测试失败，请检查日志")


if __name__ == "__main__":
    main()

