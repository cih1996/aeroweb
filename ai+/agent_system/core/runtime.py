#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
通用任务运行时状态机

负责：
- 维护任务状态和进度
- 检测异常情况
- 管理用户交互
"""

import time
from typing import Dict, Any, Optional, List
from ..utils.enums import ObjectState
from ..app_handlers.base import BaseAppHandler


class UniversalTaskRuntime:
    """
    通用任务运行时状态机
    支持任意平台、任意场景
    """
    
    def __init__(self, task_context: Dict, strategy_params: Dict, 
                 hard_limits: Dict, app_handler: BaseAppHandler, global_intent: Dict,
                 enable_interaction: bool = True):
        """
        初始化 Runtime
        
        Args:
            task_context: 任务画像
            strategy_params: 策略参数
            hard_limits: 硬限制
            app_handler: APP 执行器
            global_intent: 全局意图（包含用户目标）
            enable_interaction: 是否启用人机交互确认（默认 True）
        """
        self.task_context = task_context
        self.strategy_params = strategy_params
        self.hard_limits = hard_limits
        self.app_handler = app_handler
        self.global_intent = global_intent
        self.enable_interaction = enable_interaction
        
        # 状态
        self.state = "INIT"  # 初始化状态，首次 step 后会变为 RUNNING
        self.progress = {
            "objects_processed": 0,
            "objects_matched": 0,
            "engagements_made": 0
        }
        
        # 统计
        self.stats = {
            "start_time": time.time(),
            "total_actions": 0,
            "errors": 0,
            "action_counts": {},
            "last_match_time": None,
            "consecutive_no_match": 0,
            "consecutive_failures": 0,  # 新增：连续失败次数
            "failed_actions": [],  # 新增：失败的动作列表
            "last_progress_time": time.time(),  # 新增：最后一次进度更新时间
            "progress_stalled_duration": 0  # 新增：进度停滞时长（秒）
        }
        
        # 收集的笔记
        self.collected_notes = []
        
        # 当前对象信息和状态
        self.current_object = None
        self.current_object_state = None
        self.context_sample = []  # 上下文样本（如评论）
        
        # 最近的感知结果
        self.last_perception = None
        
        # 风控指标
        self.metrics = {
            "actions_per_minute": 0,
            "last_action_time": time.time()
        }
        
        # 目标
        self.target_count = hard_limits.get("max_objects", 5)
        self.target_matched = hard_limits.get("target_matched", 3)
        
        # 交互确认相关
        self.recent_actions = []
        self.interaction_triggered = False
        self.last_interaction_time = None
        self.user_adjustments = []
        
        # 决策缓存（用于批量决策）
        self.decision_cache = []  # 缓存的决策列表
        self.decision_cache_index = 0  # 当前执行到第几个决策
        self.steps_since_supervisor = 0  # 距离上次 Supervisor 检查的步数
    
    def is_running(self) -> bool:
        """判断是否还在运行"""
        return self.state not in ("STOPPED", "FINISHED")
    
    def reached_target(self) -> bool:
        """判断是否达到目标"""
        matched = self.progress["objects_matched"]
        processed = self.progress["objects_processed"]
        return (matched >= self.target_matched) or (processed >= self.target_count)
    
    def get_current_state_info(self) -> Dict:
        """获取当前状态信息"""
        return {
            "state": self.state,
            "current_object": self.current_object,
            "object_state": self.current_object_state,
            "progress": self.progress,
            "reached_target": self.reached_target(),
            "errors": self.stats["errors"],  # 🆕 错误总数
            "consecutive_failures": self.stats["consecutive_failures"],  # 🆕 连续失败次数
            "total_actions": self.stats["total_actions"],  # 🆕 总动作数
            "recent_failed_actions": self.stats["failed_actions"][-3:] if self.stats["failed_actions"] else []  # 🆕 最近3个失败的动作
        }
    
    def update_from_action(self, action_type: str, action: str, action_result: Dict):
        """
        从执行结果中更新状态（通用化，无需硬编码具体动作名）
        
        通过 action_result 中的 metadata 来指导状态更新：
        - metadata.new_object: 导航到新对象（通常是 navigation 类型动作）
        - metadata.context_data: 读取到上下文数据（通常是 read 类型动作）
        - metadata.progress_delta: 进度增量（通常是 engagement 类型动作）
        """
        # 统计动作
        self.stats["total_actions"] += 1
        self.stats["action_counts"][action] = self.stats["action_counts"].get(action, 0) + 1
        self.metrics["last_action_time"] = time.time()
        
        # 检查动作是否成功
        success = action_result.get("success", False)
        
        # 统计失败
        if not success:
            self.stats["errors"] += 1
            self.stats["consecutive_failures"] += 1
            self.stats["failed_actions"].append({
                "action": action,
                "action_type": action_type,
                "timestamp": time.time(),
                "error": action_result.get("error", action_result.get("message", "Unknown error"))
            })
            # 只保留最近 20 个失败记录
            if len(self.stats["failed_actions"]) > 20:
                self.stats["failed_actions"].pop(0)
        else:
            # 成功则重置连续失败计数
            self.stats["consecutive_failures"] = 0
        
        # 记录最近动作（保留最近 10 个）
        self.recent_actions.append({
            "action": action,
            "action_type": action_type,
            "timestamp": time.time(),
            "success": success
        })
        if len(self.recent_actions) > 10:
            self.recent_actions.pop(0)
        
        # 获取元数据
        metadata = action_result.get("metadata", {})
        
        # 1. 处理导航到新对象（通常是 navigation 类型动作）
        if "new_object" in metadata:
            self.progress["objects_processed"] += 1
            self.current_object = metadata["new_object"]
            self.current_object_state = ObjectState.DISCOVERED.value
            # 清空上下文
            self.context_sample = []
            self.last_perception = None
        
        # 2. 处理上下文数据（通常是 read 类型动作）
        if "context_data" in metadata:
            context = metadata["context_data"]
            # metadata 中的 context_data 已经是正确格式（列表或字典）
            if isinstance(context, list):
                self.context_sample = context
            elif isinstance(context, dict):
                # 如果是字典，尝试提取 items 字段
                self.context_sample = context.get("items", [])
            else:
                self.context_sample = []
        
        # 3. 处理进度增量（通常是 engagement 类型动作）
        if "progress_delta" in metadata:
            delta = metadata["progress_delta"]
            for key, value in delta.items():
                if key in self.progress:
                    self.progress[key] += value
            # 如果有互动，更新对象状态
            if delta.get("engagements_made", 0) > 0:
                if self.current_object_state == ObjectState.MATCHED.value:
                    self.current_object_state = ObjectState.ENGAGED.value
    
    def update_from_perception(self, perception: Dict):
        """从感知结果中更新状态"""
        # 🔧 只保存关键摘要，避免传递大量数据给 DecisionAI（节省 token）
        self.last_perception = {
            "match_score": perception.get("match_score", 0),
            "should_proceed": perception.get("should_proceed", False),
            "quality_assessment": perception.get("quality_assessment", ""),
            "match_reasons": perception.get("match_reasons", [])[:3],  # 只保留前3个原因
            "key_insights": perception.get("key_insights", "")[:200] if perception.get("key_insights") else ""  # 截断长文本
        }
        
        match_score = perception.get("match_score", 0)
        should_proceed = perception.get("should_proceed", False)
        
        # 更新对象状态
        if self.current_object_state == ObjectState.DISCOVERED.value:
            self.current_object_state = ObjectState.PERCEIVED.value
        
        if should_proceed and match_score >= self.strategy_params.get("min_match_score", 0.6):
            self.current_object_state = ObjectState.MATCHED.value
            self.progress["objects_matched"] += 1
            self.stats["last_match_time"] = time.time()
            self.stats["consecutive_no_match"] = 0
            
            # 收集笔记
            self.collected_notes.append({
                "type": "matched_object",
                "object_info": self.current_object,
                "match_score": match_score,
                "perception": perception,
                "timestamp": time.time()
            })
        else:
            self.current_object_state = ObjectState.SKIPPED.value
            self.stats["consecutive_no_match"] += 1
    
    def detect_anomaly(self) -> Optional[str]:
        """检测系统是否陷入异常状态"""
        if not self.enable_interaction:
            return None
        
        # 冷却期检查
        if self.last_interaction_time:
            cooldown = 30
            if time.time() - self.last_interaction_time < cooldown:
                return None
        
        current_time = time.time()
        elapsed = current_time - self.stats["start_time"]
        
        # 1. 长时间无匹配进展
        if self.stats.get("last_match_time"):
            time_since_match = current_time - self.stats["last_match_time"]
            if time_since_match > 30 and self.progress["objects_processed"] >= 5:
                return "no_progress"
        elif elapsed > 30 and self.progress["objects_processed"] >= 3:
            return "no_progress"
        
        # 2. 连续未匹配次数过多
        if self.stats["consecutive_no_match"] >= 5:
            return "low_match_rate"
        
        # 3. 重复执行相同动作
        if len(self.recent_actions) >= 5:
            recent_action_types = [a["action"] for a in self.recent_actions[-5:]]
            for action in set(recent_action_types):
                if recent_action_types.count(action) >= 4 and action != "next":
                    return "repetitive_actions"
        
        # 4. 超时但未达到目标
        max_time = self.hard_limits.get("max_time_seconds", 120)
        if elapsed > max_time * 0.7:
            if self.progress["objects_matched"] < self.target_matched * 0.5:
                return "time_exceeded"
        
        # 5. 🆕 连续失败次数过多
        if self.stats["consecutive_failures"] >= 3:
            return "consecutive_failures"
        
        # 6. 🆕 进度长时间停滞（engagements_made 不增加）
        if self.progress["engagements_made"] == 0 and self.stats["total_actions"] > 10:
            # 检查是否有 engagement 类型的动作
            engagement_attempts = sum(1 for a in self.recent_actions if a.get("action_type") == "engage")
            if engagement_attempts >= 3:
                return "engagement_stalled"
        
        return None
    
    def stop(self, reason: str):
        """停止运行"""
        self.state = "STOPPED"
        self.stats["stop_reason"] = reason
    
    def apply_user_adjustment(self, adjustment_id: str, custom_input: str = None):
        """应用用户调整"""
        adjustment = {
            "id": adjustment_id,
            "custom_input": custom_input,
            "timestamp": time.time()
        }
        self.user_adjustments.append(adjustment)
        
        print(f"\n{'='*80}")
        print(f"[用户调整] {adjustment_id}")
        if custom_input:
            print(f"自定义输入: {custom_input}")
        print(f"{'='*80}")
        
        # 根据调整 ID 修改策略参数
        if adjustment_id == "continue":
            print("[Runtime] 用户选择继续，维持当前策略")
        
        elif adjustment_id == "adjust_criteria":
            old_score = self.strategy_params.get("min_match_score", 0.6)
            new_score = max(0.3, old_score - 0.15)
            self.strategy_params["min_match_score"] = new_score
            print(f"[Runtime] 已放宽匹配标准: {old_score:.2f} → {new_score:.2f}")
            self.stats["consecutive_no_match"] = 0
        
        elif adjustment_id == "increase_target":
            old_target = self.target_count
            self.target_count += 5
            print(f"[Runtime] 已增加处理目标: {old_target} → {self.target_count}")
        
        elif adjustment_id == "stop":
            self.stop(reason="用户主动停止")
            print("[Runtime] 用户选择停止任务")
        
        elif adjustment_id == "skip_and_continue":
            print("[Runtime] 跳过当前对象，继续执行")
            self.stats["consecutive_no_match"] = 0
        
        # 重置交互标志
        self.interaction_triggered = False
    
    def get_risk_policy(self) -> Dict:
        """获取风控规则"""
        return {
            "max_actions_per_minute": 10,
            "min_action_interval": 1,
            "max_errors": 3
        }
    
    def should_run_supervisor(self) -> bool:
        """
        判断是否应该运行 SupervisorAI
        
        Returns:
            bool: True 表示需要运行，False 表示跳过
        """
        decision_mode = self.strategy_params.get("decision_mode", {})
        frequency = decision_mode.get("supervisor_frequency", "always")
        check_interval = decision_mode.get("supervisor_check_interval", 3)
        
        # 总是检查
        if frequency == "always":
            return True
        
        # 只在异常时检查
        if frequency == "anomaly_only":
            # 检查是否有异常
            has_anomaly = (
                self.stats.get("consecutive_failures", 0) >= 2 or
                self.stats.get("consecutive_no_match", 0) >= 5 or
                self.stats.get("errors", 0) > 0
            )
            if has_anomaly:
                self.steps_since_supervisor = 0  # 重置计数
            return has_anomaly
        
        # 每 N 步检查一次
        if frequency == "every_n_steps":
            self.steps_since_supervisor += 1
            if self.steps_since_supervisor >= check_interval:
                self.steps_since_supervisor = 0
                return True
            return False
        
        # 默认总是检查
        return True
    
    def get_cached_decision(self) -> Optional[Dict]:
        """
        从缓存中获取下一个决策
        
        Returns:
            Dict: 决策对象，如果缓存为空则返回 None
        """
        if self.decision_cache_index < len(self.decision_cache):
            decision = self.decision_cache[self.decision_cache_index]
            self.decision_cache_index += 1
            return decision
        return None
    
    def set_decision_cache(self, decisions: List[Dict]):
        """
        设置决策缓存
        
        Args:
            decisions: 决策列表
        """
        self.decision_cache = decisions
        self.decision_cache_index = 0
    
    def clear_decision_cache(self):
        """清空决策缓存"""
        self.decision_cache = []
        self.decision_cache_index = 0

