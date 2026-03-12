#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Agent 编排器

负责协调所有 AI 的执行流程
"""

import time
from typing import Dict, Any, List, Optional
from .runtime import UniversalTaskRuntime
from ..agents import (
    TaskPlannerAI, CapabilityMatcherAI,
    GlobalIntentAI, ContextBuilderAI, StrategyAI, DecisionAI,
    ExecutorAI, PerceptionAI, SupervisorAI, InteractionGateAI,
    SummarizerAI, MemoryLearnerAI
)
from ..agents.base import BaseAgent
from ..app_handlers.registry import AppRegistry


class AgentOrchestrator:
    """
    Agent 编排器
    
    负责：
    1. 初始化任务（GlobalIntent → Context → Strategy）
    2. 主循环控制（Supervisor → Decision → Executor → Perception）
    3. 任务总结（Summarizer → MemoryLearner）
    """
    
    def __init__(self, enable_interaction: bool = True, log_callback=None, interaction_callback=None):
        """
        初始化编排器
        
        Args:
            enable_interaction: 是否启用人机交互
            log_callback: 日志回调函数，用于记录执行细节
            interaction_callback: 交互回调函数，当需要人机交互时调用
        """
        self.enable_interaction = enable_interaction
        self.log_callback = log_callback
        self.interaction_callback = interaction_callback
    
    def _log(self, agent_name: str, action: str, details: Dict[str, Any] = None):
        """记录日志"""
        if self.log_callback:
            try:
                self.log_callback({
                    "agent": agent_name,
                    "action": action,
                    "details": details or {}
                })
            except Exception as e:
                print(f"⚠️ [Orchestrator] 记录日志失败: {e}")
    
    def run_task(self, user_message: str):
        """
        主入口：处理用户消息
        
        Args:
            user_message: 用户输入消息
        """
        # 重置 token 统计
        BaseAgent.reset_token_stats()
        
        print(f"\n{'='*80}")
        print(f"用户输入: {user_message}")
        print(f"{'='*80}")
        
        # 0. 任务规划（新增）
        print("\n[Step 0] 任务规划...")
        self._log("TaskPlannerAI", "start", {"message": "开始规划任务"})
        
        task_plan = TaskPlannerAI.run(
            user_message=user_message,
            conversation_history=[]
        )
        
        complexity = task_plan.get("complexity", "simple")
        needs_decomposition = task_plan.get("needs_decomposition", False)
        
        self._log("TaskPlannerAI", "complete", {
            "complexity": complexity,
            "needs_decomposition": needs_decomposition,
            "main_goal": task_plan.get("main_goal", "")
        })
        
        # 如果需要分解，处理子任务
        if needs_decomposition:
            sub_tasks = task_plan.get("sub_tasks", [])
            print(f"\n任务较复杂，已分解为 {len(sub_tasks)} 个子任务")
            # TODO: 实现子任务调度（Phase 2 后续）
            # 暂时只执行第一个子任务
            if sub_tasks:
                print("⚠️ 暂时只执行第一个子任务（子任务调度待实现）")
                first_task = sub_tasks[0]
                self._run_planned_task(first_task, user_message)
            return
        
        # 简单任务，继续原有流程
        # 1. 全局意图识别
        print("\n[Step 1] 识别全局意图...")
        self._log("GlobalIntentAI", "start", {"message": "开始识别全局意图"})
        
        global_intents = GlobalIntentAI.run(
            user_message=user_message,
            session_memory={},
            user_profile={}
        )
        intents_list = global_intents.get('intents', [])
        print(f"[GlobalIntentAI] 识别到 {len(intents_list)} 个意图")
        
        # 安全地提取意图信息
        intents_summary = []
        for intent in intents_list:
            if isinstance(intent, dict):
                intents_summary.append({
                    "app": intent.get('app', 'unknown'),
                    "goal": intent.get('goal', '')
                })
        
        self._log("GlobalIntentAI", "complete", {
            "intents_count": len(intents_list),
            "intents": intents_summary
        })
        
        # 对每个意图执行任务
        for intent in intents_list:
            if isinstance(intent, dict):
                print(f"  - {intent.get('app', 'unknown')}: {intent.get('goal', '')}")
                # 使用能力匹配
                self._run_single_task_with_capability_matching(intent, task_plan)
            else:
                print(f"⚠️ 跳过无效的意图数据类型: {type(intent)}")
    
    def _run_single_task(self, global_intent: Dict):
        """执行单个任务"""
        # 安全地获取意图信息
        app_name = global_intent.get('app', 'unknown') if isinstance(global_intent, dict) else 'unknown'
        goal = global_intent.get('goal', '') if isinstance(global_intent, dict) else ''
        
        print(f"\n{'='*80}")
        print(f"开始执行任务: {app_name} - {goal}")
        if self.enable_interaction:
            print(f"人机交互: ✓ 启用")
        else:
            print(f"人机交互: ✗ 禁用")
        print(f"{'='*80}")
        
        # 2. 构建上下文
        print("\n[Step 2] 构建任务上下文...")
        self._log("ContextBuilderAI", "start", {
            "app": app_name,
            "goal": goal
        })
        
        task_context = ContextBuilderAI.run(
            global_intent=global_intent,
            user_request_excerpt=goal,
            session_memory={},
            user_profile={},
            knowledge_snippets=[]
        )
        print(f"[ContextBuilderAI] 任务画像:")
        print(f"  - 领域: {task_context.get('domain')}")
        print(f"  - 子领域: {task_context.get('sub_domain')}")
        print(f"  - 风险等级: {task_context.get('risk_level')}")
        
        self._log("ContextBuilderAI", "complete", {
            "domain": task_context.get('domain'),
            "sub_domain": task_context.get('sub_domain'),
            "risk_level": task_context.get('risk_level')
        })
        
        # 3. 策略参数生成（使用增强版：会读取历史策略模板）
        print("\n[Step 3] 生成策略参数...")
        self._log("StrategyAI", "start", {"message": "开始生成策略参数"})
        
        # 使用之前提取的 app_name，如果为 unknown 则使用默认值
        if app_name == 'unknown':
            app_name = 'douyin'
        app_capabilities = AppRegistry.get_capabilities(app_name)
        
        if not app_capabilities:
            print(f"⚠️ 未找到 APP: {app_name}，可用的 APP: {AppRegistry.list_apps()}")
            self._log("StrategyAI", "error", {"message": f"未找到 APP: {app_name}"})
            return
        
        strategy_params = StrategyAI.run(
            task_context=task_context,
            app_capabilities=app_capabilities,
            user_style_profile={}
        )
        print(f"[StrategyAI] 策略参数:")
        for key, value in strategy_params.items():
            if key != "historical_strategies":
                print(f"  - {key}: {value}")
        
        self._log("StrategyAI", "complete", {
            "search_keywords": strategy_params.get("search_keywords"),
            "max_objects": strategy_params.get("max_objects"),
            "target_count": strategy_params.get("target_count")
        })
        
        # 4. 初始化 Runtime 状态机
        print("\n[Step 4] 初始化通用 Runtime...")
        app_handler = AppRegistry.get(app_name)
        hard_limits = {
            "max_objects": 6,
            "target_matched": 3,
            "max_time_seconds": 120
        }
        
        runtime = UniversalTaskRuntime(
            task_context=task_context,
            strategy_params=strategy_params,
            hard_limits=hard_limits,
            app_handler=app_handler,
            global_intent=global_intent,
            enable_interaction=self.enable_interaction
        )
        print(f"[Runtime] 初始化完成")
        print(f"  - 目标：处理 {hard_limits['max_objects']} 个对象，匹配 {hard_limits['target_matched']} 个")
        
        # 调用生命周期钩子
        app_handler.on_task_start(task_context)
        
        # 5. 主循环
        print("\n[Step 5] 进入主循环...")
        step_count = 0
        max_steps = 30
        
        self._log("LOOP_START", "开始主循环", {
            "max_steps": max_steps,
            "target_count": runtime.target_count,
            "target_matched": runtime.target_matched
        })
        
        while runtime.is_running() and step_count < max_steps:
            step_count += 1
            
            self._log("LOOP_ITERATION", f"第 {step_count} 次迭代", {
                "step": step_count,
                "progress": runtime.progress,
                "state": runtime.state,
                "current_object_state": runtime.current_object_state,
                "consecutive_no_match": runtime.stats.get("consecutive_no_match", 0)
            })
            
            if runtime.reached_target():
                runtime.stop(reason="达到目标")
                print(f"\n✓ [Runtime] 已达到目标，任务完成 (循环 {step_count} 次)")
                self._log("LOOP_END", "达到目标", {
                    "total_steps": step_count,
                    "progress": runtime.progress
                })
                break
            
            self._execute_step(runtime)
            time.sleep(0.3)
        
        if step_count >= max_steps and runtime.is_running():
            print(f"\n⚠️ [Runtime] 达到最大步数 {max_steps}，停止执行")
            runtime.stop(reason=f"达到最大步数 {max_steps}")
            self._log("LOOP_LIMIT", "达到循环上限", {
                "max_steps": max_steps,
                "final_progress": runtime.progress,
                "final_state": runtime.get_current_state_info()
            })
        
        # 6. 总结
        print(f"\n{'='*80}")
        print("[Step 6] 生成任务总结...")
        print(f"{'='*80}")
        summary = SummarizerAI.run(
            collected_notes=runtime.collected_notes,
            task_context=task_context
        )
        print(f"[SummarizerAI] {summary.get('summary')}")
        if summary.get('key_points'):
            print("关键要点:")
            for point in summary['key_points']:
                print(f"  • {point}")
        
        # 7. 学习与记忆（使用增强版）
        print(f"\n{'='*80}")
        print("[Step 7] 学习与记忆更新（增强版三层记忆系统）...")
        print(f"{'='*80}")
        
        # 收集 InteractionGate 的用户调整记录
        user_adjustments = []
        if hasattr(runtime, 'user_adjustments') and runtime.user_adjustments:
            user_adjustments = runtime.user_adjustments
        
        memory_update = MemoryLearnerAI.run_enhanced(
            summary=summary,
            runtime_stats=runtime.stats,
            task_context=task_context,
            strategy_params=strategy_params,
            user_adjustments=user_adjustments,
            user_feedback={}
        )
        
        print(f"[MemoryLearnerAI] 记忆更新:")
        print(f"  - 生成记忆数: {len(memory_update.get('memories', []))}")
        for mem in memory_update.get('memories', []):
            print(f"    • [{mem['level']}] {mem['type']} (stage={mem['stage']}, confidence={mem['confidence']})")
        print(f"  - 备注: {memory_update.get('note')}")
        
        # 调用生命周期钩子
        app_handler.on_task_end({
            "objects_processed": runtime.progress["objects_processed"],
            "objects_matched": runtime.progress["objects_matched"]
        })
        
        # 打印最终统计
        self._print_statistics(runtime)
        
        # 打印 token 统计
        self._print_token_statistics()
    
    def _execute_step(self, runtime: UniversalTaskRuntime):
        """执行单步"""
        print(f"\n{'='*80}")
        print(f"Step {runtime.stats['total_actions'] + 1}")
        print(f"{'='*80}")
        
        # 0. 状态更新：首次执行后从 INIT 变为 RUNNING
        if runtime.state == "INIT" and runtime.stats['total_actions'] > 0:
            runtime.state = "RUNNING"
        
        # A. Supervisor 风控检查（根据策略决定是否运行）
        should_supervise = runtime.should_run_supervisor()
        
        if should_supervise:
            control = SupervisorAI.run(
                runtime_state=runtime.get_current_state_info(),
                execution_metrics=runtime.metrics,
                risk_policy=runtime.get_risk_policy()
            )
            
            print(f"[SupervisorAI] {control.get('control')} - {control.get('reason')}")
            
            self._log("SupervisorAI", "control", {
                "control": control.get("control"),
                "reason": control.get("reason"),
                "runtime_state": runtime.get_current_state_info()
            })
            
        if control["control"] == "SLEEP":
            duration = control.get("duration_seconds", 1)
            print(f"[Runtime] 休眠 {duration} 秒...")
            time.sleep(duration)
            return
        
        if control["control"] == "STOP":
            runtime.stop(reason=control.get("reason", "监督停止"))
            print(f"[Runtime] 任务已停止")
            self._log("SupervisorAI", "task_stopped", {
                    "reason": control.get("reason", "监督停止"),
                    "final_progress": runtime.progress
                })
            return
        
        # A2. 检测异常并触发 InteractionGateAI
        anomaly = runtime.detect_anomaly()
        if anomaly and not runtime.interaction_triggered:
            # 清空决策缓存（因为出现异常，需要重新规划）
            runtime.clear_decision_cache()
            self._handle_interaction(runtime, anomaly)
            if runtime.state == "STOPPED":
                return
        else:
            print("[SupervisorAI] ⏭️ 跳过监督检查（根据策略配置）")
        
        # B. DecisionAI 决定下一步动作（支持批量决策和缓存）
        # 先尝试从缓存中获取决策
        decision = runtime.get_cached_decision()
        
        if decision:
            print(f"[DecisionAI] 📦 使用缓存决策 ({runtime.decision_cache_index}/{len(runtime.decision_cache)})")
        else:
            # 缓存为空，调用 DecisionAI 生成新决策
            app_capabilities = runtime.app_handler.get_capabilities()
            decision_mode = runtime.strategy_params.get("decision_mode", {})
            batch_size = decision_mode.get("decision_cache_size", 1)
            
            decision_result = DecisionAI.run(
            current_state=runtime.get_current_state_info(),
            object_info=runtime.current_object,
            strategy_params=runtime.strategy_params,
            progress=runtime.progress,
                perception_result=runtime.last_perception,
                app_capabilities=app_capabilities,
                batch_size=batch_size
            )
            
            # 判断是批量决策还是单步决策
            if "decisions" in decision_result:
                # 批量决策
                decisions = decision_result["decisions"]
                print(f"[DecisionAI] 📦 批量规划 {len(decisions)} 步")
                print(f"            理由: {decision_result.get('plan_reasoning')}")
                runtime.set_decision_cache(decisions)
                decision = runtime.get_cached_decision()
            else:
                # 单步决策
                decision = decision_result
        
        print(f"[DecisionAI] 决策: {decision.get('action_type')} -> {decision.get('action')}")
        print(f"            理由: {decision.get('reason')}")
        
        action_type = decision.get("action_type")
        action = decision.get("action")
        params = decision.get("params", [])
        
        self._log("DecisionAI", "decision", {
            "action_type": action_type,
            "action": action,
            "params": params,
            "reason": decision.get('reason'),
            "progress": runtime.progress
        })
        
        # C. 特殊处理：如果是停止指令
        if action_type == "control" and action == "stop":
            runtime.stop(reason=decision.get("reason", "AI决策停止"))
            print("[Runtime] AI决策停止任务")
            return
        
        # D. ExecutorAI 生成执行计划
        command = {"action": action, "params": params}
        executor_result = ExecutorAI.run(
            command=command,
            progress=runtime.progress
        )
        
        print(f"[ExecutorAI] 执行计划: {executor_result.get('action')}")
        
        # E. 实际执行动作（通过 APP Handler）
        self._log("ExecutorAI", "execute", {
            "action": action,
            "params": params,
            "message": "开始执行"
        })
        
        try:
            # 调用钩子
            runtime.app_handler.on_action_before(action, params)
            
            # 执行动作
            result = runtime.app_handler.execute(action, params)
            action_result = result.to_dict()
            
            # 调用钩子
            runtime.app_handler.on_action_after(action, result)
            
            print(f"[Action] 执行成功: {action_result.get('message', 'OK')}")
            
            # 获取返回数据
            data = action_result.get('data', None)
            
            # 🆕 控制日志大小：对大数据进行截断
            log_data = None
            if data is not None:
                if isinstance(data, list):
                    # 如果是列表（如评论），只记录前5条 + 总数
                    log_data = {
                        "type": "list",
                        "total_count": len(data),
                        "sample": data[:5] if len(data) > 5 else data
                    }
                elif isinstance(data, dict):
                    # 如果是字典，直接记录（如果有 items 字段，截断）
                    if "items" in data and isinstance(data["items"], list):
                        log_data = {
                            **data,
                            "items": data["items"][:5] if len(data["items"]) > 5 else data["items"],
                            "items_total_count": len(data["items"])
                        }
                    else:
                        log_data = data
                else:
                    # 其他类型（字符串、数字等）
                    log_data = {"value": data}
            
            self._log("ExecutorAI", "success", {
                "action": action,
                "success": action_result.get('success'),
                "message": action_result.get('message', 'OK'),
                "data": log_data  # 🆕 添加数据字段
            })
        
        except Exception as e:
            print(f"⚠️ [Action] 执行出错: {e}")
            action_result = {"success": False, "error": str(e)}
            runtime.stats["errors"] += 1
            
            # 清空决策缓存（因为出错了，之前的规划可能不再适用）
            runtime.clear_decision_cache()
            
            self._log("ExecutorAI", "error", {
                "action": action,
                "error": str(e)
            })
            return
        
        # F. Runtime 吸收执行结果
        runtime.update_from_action(action_type, action, action_result)
        
        # G. 如果有上下文数据或是 analyze 动作，触发感知判断（通用化）
        metadata = action_result.get("metadata", {})
        has_context = "context_data" in metadata and metadata["context_data"]
        
        if action_type == "analyze" or has_context:
            if runtime.current_object:
                print("[Runtime] 触发感知判断...")
                perception = PerceptionAI.run(
                    object_info=runtime.current_object,
                    user_intent=runtime.global_intent,
                    match_criteria=runtime.strategy_params,
                    context_sample=runtime.context_sample
                )
                
                print(f"[PerceptionAI] 匹配分数: {perception.get('match_score'):.2f} | "
                      f"是否匹配: {perception.get('should_proceed')} | "
                      f"质量: {perception.get('quality_assessment')}")
                if perception.get('match_reasons'):
                    print(f"            原因: {', '.join(perception.get('match_reasons', []))}")
                
                runtime.update_from_perception(perception)
        
        # H. 等待（如果需要）
        wait = decision.get("wait_seconds", 0)
        if wait > 0:
            print(f"[Runtime] 等待 {wait} 秒...")
            time.sleep(wait)
    
    def _handle_interaction(self, runtime: UniversalTaskRuntime, anomaly: str):
        """处理人机交互"""
        print(f"\n⚠️ [Runtime] 检测到异常: {anomaly}")
        
        # 触发 InteractionGateAI
        elapsed = time.time() - runtime.stats["start_time"]
        match_rate = (runtime.progress["objects_matched"] / max(runtime.progress["objects_processed"], 1)) * 100
        
        interaction_result = InteractionGateAI.run(
            anomaly_type=anomaly,
            current_progress={
                "objects_processed": runtime.progress["objects_processed"],
                "objects_matched": runtime.progress["objects_matched"],
                "time_elapsed": f"{int(elapsed // 60)}:{int(elapsed % 60):02d}",
                "match_rate": f"{match_rate:.1f}%"
            },
            task_context=runtime.task_context,
            recent_actions=runtime.recent_actions,
            strategy_params=runtime.strategy_params
        )
        
        print(f"\n[InteractionGateAI] 情况: {interaction_result.get('situation')}")
        print(f"                  详情: {interaction_result.get('details')}")
        print(f"                  严重程度: {interaction_result.get('severity')}")
        
        # 记录交互日志
        self._log("InteractionGateAI", "interaction_required", {
            "situation": interaction_result.get('situation'),
            "severity": interaction_result.get('severity'),
            "anomaly": anomaly
        })
        
        # 获取用户输入
        if self.interaction_callback:
            # 使用回调获取真实用户输入
            user_choice = self._get_user_choice_via_callback(
                interaction_result.get("options", []),
                interaction_result.get("situation", ""),
                interaction_result.get("details", ""),
                interaction_result.get("severity", "medium")
            )
        else:
            # 降级为模拟用户输入
            user_choice = self._simulate_user_input(
            interaction_result.get("options", []),
            interaction_result.get("situation", "")
        )
        
        if user_choice:
            # 应用用户调整
            runtime.apply_user_adjustment(
            user_choice["choice_id"],
            user_choice.get("custom_input")
        )
            
            self._log("InteractionGateAI", "user_choice_applied", {
                "choice": user_choice["choice_id"],
                "custom_input": user_choice.get("custom_input")
            })
        else:
            # 用户没有选择（超时），停止任务
            runtime.stop(reason="用户交互超时")
            print("[Runtime] 用户交互超时，任务已停止")
        
        runtime.interaction_triggered = True
        runtime.last_interaction_time = time.time()
    
    def _get_user_choice_via_callback(self, options: List[Dict], situation: str, details: str, severity: str) -> Optional[Dict]:
        """通过回调获取用户选择"""
        if not self.interaction_callback:
            return None
        
        # 准备交互数据
        interaction_data = {
            "situation": situation,
            "details": details,
            "severity": severity,
            "options": options
        }
        
        print(f"\n{'🔔'*40}")
        print(f"【等待用户交互】")
        print(f"{'🔔'*40}")
        
        # 调用回调，等待用户选择
        choice = self.interaction_callback(interaction_data)
        
        if choice is not None:
            print(f"[Runtime] 用户选择: {choice}")
            
            # 将选择转换为标准格式
            if isinstance(choice, dict):
                return choice
            else:
                # 假设是选项索引
                return {"choice_id": str(choice)}
        
        return None
    
    def _simulate_user_input(self, options: List[Dict], situation: str) -> Dict:
        """模拟用户输入（实际应用中应该是真实的用户交互界面）"""
        print(f"\n{'🔔'*40}")
        print(f"【需要您的确认】")
        print(f"{'🔔'*40}")
        print(f"\n情况说明: {situation}\n")
        print("请选择操作：")
        
        for i, opt in enumerate(options, 1):
            print(f"  [{i}] {opt['label']}")
            print(f"      {opt['description']}")
        
        print(f"\n  [0] 自定义输入")
        print(f"\n{'='*80}")
        
        # 模拟：自动选择第一个选项
        import random
        if random.random() < 0.7 and len(options) > 0:
            choice = options[0]
            print(f"\n[模拟用户] 选择: {choice['label']}")
            return {"choice_id": choice["id"], "custom_input": None}
        elif len(options) > 1:
            choice = options[1]
            print(f"\n[模拟用户] 选择: {choice['label']}")
            return {"choice_id": choice["id"], "custom_input": None}
        else:
            custom = "继续但降低匹配标准"
            print(f"\n[模拟用户] 自定义输入: {custom}")
            return {"choice_id": "custom", "custom_input": custom}
    
    def _print_statistics(self, runtime: UniversalTaskRuntime):
        """打印最终统计"""
        print(f"\n{'='*80}")
        print(f"任务完成统计")
        print(f"{'='*80}")
        print(f"状态: {runtime.state}")
        print(f"处理对象数: {runtime.progress['objects_processed']}")
        print(f"匹配对象数: {runtime.progress['objects_matched']}")
        print(f"互动次数: {runtime.progress['engagements_made']}")
        print(f"总执行次数: {runtime.stats['total_actions']}")
        print(f"错误次数: {runtime.stats['errors']}")
        print(f"运行时长: {time.time() - runtime.stats['start_time']:.2f} 秒")
        print(f"{'='*80}\n")
    
    def _print_token_statistics(self):
        """打印 token 统计"""
        all_stats = BaseAgent.get_all_token_stats()
        
        if not all_stats:
            return
        
        print(f"\n{'='*80}")
        print(f"🔢 Token 消耗统计")
        print(f"{'='*80}\n")
        
        # 计算总计
        total_tokens = 0
        total_calls = 0
        total_prompt = 0
        total_completion = 0
        total_cached = 0
        
        # 按 AI 名称排序
        sorted_agents = sorted(all_stats.items(), key=lambda x: x[1]["total_tokens"], reverse=True)
        
        for agent_name, stats in sorted_agents:
            total_tokens += stats["total_tokens"]
            total_calls += stats["call_count"]
            total_prompt += stats["prompt_tokens"]
            total_completion += stats["completion_tokens"]
            total_cached += stats["cached_tokens"]
            
            print(f"【{agent_name}】")
            print(f"  调用次数: {stats['call_count']}")
            print(f"  总 tokens: {stats['total_tokens']:,}")
            print(f"  输入 tokens: {stats['prompt_tokens']:,}")
            print(f"  输出 tokens: {stats['completion_tokens']:,}")
            if stats["cached_tokens"] > 0:
                print(f"  缓存 tokens: {stats['cached_tokens']:,}")
            print()
        
        print(f"{'='*80}")
        print(f"【总计】")
        print(f"  AI 调用次数: {total_calls}")
        print(f"  总 tokens: {total_tokens:,}")
        print(f"  输入 tokens: {total_prompt:,}")
        print(f"  输出 tokens: {total_completion:,}")
        if total_cached > 0:
            print(f"  缓存 tokens: {total_cached:,} (节省输入)")
        
        # 估算费用（DeepSeek 价格：输入 0.14¥/M，输出 0.28¥/M）
        input_cost_cny = (total_prompt - total_cached) * 0.14 / 1_000_000
        cached_cost_cny = total_cached * 0.014 / 1_000_000  # 缓存价格为输入的1/10
        output_cost_cny = total_completion * 0.28 / 1_000_000
        total_cost_cny = input_cost_cny + cached_cost_cny + output_cost_cny
        
        print(f"\n【估算费用（DeepSeek）】")
        print(f"  输入费用: ¥{input_cost_cny:.4f}")
        if total_cached > 0:
            print(f"  缓存费用: ¥{cached_cost_cny:.4f}")
        print(f"  输出费用: ¥{output_cost_cny:.4f}")
        print(f"  总费用: ¥{total_cost_cny:.4f}")
        print(f"{'='*80}\n")
    
    def _run_planned_task(self, sub_task: Dict, original_message: str):
        """
        执行已规划的任务（子任务）
        
        Args:
            sub_task: 子任务信息
            original_message: 原始用户消息
        """
        task_description = sub_task.get("description", "")
        required_capabilities = sub_task.get("required_capabilities", [])
        capability_actions = sub_task.get("capability_actions", [])
        
        print(f"\n{'='*80}")
        print(f"执行子任务: {task_description}")
        print(f"需要能力: {', '.join(required_capabilities)}")
        print(f"{'='*80}")
        
        # 能力匹配
        print("\n[Step 1.5] 匹配能力提供者...")
        self._log("CapabilityMatcherAI", "start", {
            "task": task_description,
            "required_capabilities": required_capabilities
        })
        
        # 获取可用的提供者列表
        from ..app_handlers.registry import AppRegistry
        import requests
        
        try:
            # 调用 API 获取能力列表
            response = requests.get("http://localhost:8000/api/capabilities")
            if response.ok:
                available_providers = response.json().get("capabilities", [])
            else:
                # 降级：使用注册表
                available_providers = []
                for app_name in AppRegistry.list_apps():
                    caps = AppRegistry.get_capabilities(app_name)
                    provider = {
                        "provider_type": "app",
                        "provider_name": app_name,
                        "category": "unknown",
                        "capabilities": {}
                    }
                    for cap in caps:
                        if cap.type not in provider["capabilities"]:
                            provider["capabilities"][cap.type] = []
                        provider["capabilities"][cap.type].append(cap.name)
                    available_providers.append(provider)
        except Exception as e:
            print(f"⚠️ 获取能力列表失败: {e}")
            available_providers = []
        
        # 调用 CapabilityMatcherAI
        match_result = CapabilityMatcherAI.run(
            task_description=task_description,
            required_capabilities=required_capabilities,
            capability_actions=capability_actions,
            available_providers=available_providers
        )
        
        matched = match_result.get("matched", False)
        
        if not matched:
            missing = match_result.get("missing_capabilities", [])
            suggestion = match_result.get("suggestion", "")
            print(f"\n❌ 无法执行任务：缺少能力 {', '.join(missing)}")
            print(f"建议: {suggestion}")
            self._log("CapabilityMatcherAI", "failed", {
                "missing_capabilities": missing,
                "suggestion": suggestion
            })
            return
        
        # 获取匹配的提供者
        provider = match_result.get("capability_provider", {})
        app_name = provider.get("name")
        
        self._log("CapabilityMatcherAI", "success", {
            "provider": app_name,
            "match_score": provider.get("match_score")
        })
        
        # 构造 global_intent（兼容原有流程）
        global_intent = {
            "app": app_name,
            "goal": task_description,
            "required_capabilities": required_capabilities
        }
        
        # 继续执行任务
        self._run_single_task(global_intent)
    
    def _run_single_task_with_capability_matching(self, global_intent: Dict, task_plan: Dict):
        """
        带能力匹配的任务执行
        
        Args:
            global_intent: 全局意图
            task_plan: 任务规划结果
        """
        # 提取能力需求
        required_capabilities = task_plan.get("required_capabilities", ["short_video_platform"])
        capability_actions = task_plan.get("capability_actions", ["navigation", "read"])
        
        app_name = global_intent.get('app', 'unknown')
        goal = global_intent.get('goal', '')
        
        print(f"\n{'='*80}")
        print(f"能力匹配: {goal}")
        print(f"需要能力: {', '.join(required_capabilities)}")
        print(f"建议的 APP: {app_name}")
        print(f"{'='*80}")
        
        # 获取可用的提供者列表
        import requests
        
        try:
            response = requests.get("http://localhost:8000/api/capabilities")
            if response.ok:
                available_providers = response.json().get("capabilities", [])
            else:
                available_providers = []
        except Exception as e:
            print(f"⚠️ 获取能力列表失败: {e}，使用默认 app")
            # 直接使用 GlobalIntentAI 建议的 app
            self._run_single_task(global_intent)
            return
        
        # 能力匹配
        match_result = CapabilityMatcherAI.run(
            task_description=goal,
            required_capabilities=required_capabilities,
            capability_actions=capability_actions,
            available_providers=available_providers
        )
        
        matched = match_result.get("matched", False)
        
        if matched:
            provider = match_result.get("capability_provider", {})
            matched_app = provider.get("name")
            
            # 如果匹配的 app 与建议的不同，更新 global_intent
            if matched_app != app_name:
                print(f"✓ 匹配到更合适的 APP: {matched_app} (原建议: {app_name})")
                global_intent["app"] = matched_app
        else:
            print(f"⚠️ 能力匹配失败，使用 GlobalIntentAI 建议的 APP: {app_name}")
        
        # 继续执行任务
        self._run_single_task(global_intent)

