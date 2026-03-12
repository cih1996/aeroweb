#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
记忆学习 AI（增强版）

负责：
1. 分析任务执行结果
2. 生成三层记忆（L0/L1/L2）
3. 提取决策偏好和策略模板
4. 管理记忆成熟度
"""

from typing import Dict, Any, List
from .base import BaseAgent
from ..memory import (
    MemoryManager, MemoryEntry, MemoryScope, MemoryType,
    MemoryLevel, MemoryStage, MemoryRetriever
)


class MemoryLearnerAI(BaseAgent):
    """
    记忆学习 AI（增强版）
    
    新增功能：
    1. 三层记忆生成
    2. 决策偏好提取
    3. 策略模板保存
    4. InteractionGate 记录分析
    """
    
    AGENT_NAME = "MemoryLearnerAI"
    PROMPT_FILE = "memory_learner.prompt"
    USE_HISTORY = True  # 跨任务学习
    HISTORY_FILE = "memory_session"
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        # 新格式验证
        return ("memory_updates" in result or "task_signature" in result)
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "memory_updates": [],
            "task_signature": {
                "app": "unknown",
                "intent": "unknown",
                "domain": "unknown"
            },
            "confidence": 0.5,
            "note": "任务完成"
        }
    
    @classmethod
    def run_enhanced(cls, 
                     summary: Dict,
                     runtime_stats: Dict,
                     task_context: Dict,
                     strategy_params: Dict,
                     user_adjustments: List[Dict] = None,
                     user_feedback: Dict = None) -> Dict[str, Any]:
        """
        增强的运行方法（生成三层记忆）
        
        Args:
            summary: 任务总结
            runtime_stats: 运行时统计
            task_context: 任务上下文
            strategy_params: 策略参数
            user_adjustments: 用户调整记录
            user_feedback: 用户反馈
        
        Returns:
            包含记忆更新的结果
        """
        # 1. 调用基础 AI
        ai_result = cls.run(
            summary=summary,
            runtime_stats=runtime_stats,
            user_feedback=user_feedback or {}
        )
        
        # 2. 提取关键信息
        app_name = task_context.get("app", "unknown")
        intent = cls._extract_intent(task_context)
        
        # 3. 生成记忆
        manager = MemoryManager()
        memory_updates = []
        
        # 3.1 从 InteractionGate 提取决策偏好
        if user_adjustments:
            for adjustment in user_adjustments:
                decision_pref = cls._create_decision_preference(
                    app_name, intent, adjustment
                )
                if decision_pref:
                    mem_id = manager.add_or_update(decision_pref)
                    memory_updates.append({
                        "type": "decision_preference",
                        "id": mem_id,
                        "scope": decision_pref.scope.to_dict()
                    })
        
        # 3.2 如果任务成功，保存策略模板
        if cls._is_successful(runtime_stats):
            strategy_template = cls._create_strategy_template(
                app_name, intent, strategy_params, summary, user_feedback
            )
            mem_id = manager.add_or_update(strategy_template)
            memory_updates.append({
                "type": "strategy_template",
                "id": mem_id,
                "scope": strategy_template.scope.to_dict()
            })
        
        # 3.3 更新用户画像（L0）
        if user_feedback:
            user_profile = cls._update_user_profile(user_feedback, task_context)
            if user_profile:
                mem_id = manager.add_or_update(user_profile)
                memory_updates.append({
                    "type": "user_profile",
                    "id": mem_id,
                    "scope": user_profile.scope.to_dict()
                })
        
        # 4. 返回结果
        ai_result["memory_updates"] = memory_updates
        ai_result["memory_stats"] = manager.get_stats()
        
        print(f"✓ [MemoryLearnerAI] 生成了 {len(memory_updates)} 条记忆更新")
        
        return ai_result
    
    @staticmethod
    def _extract_intent(task_context: Dict) -> str:
        """提取意图名称"""
        # 从任务画像中提取
        domain = task_context.get("domain", "")
        sub_domain = task_context.get("sub_domain", [])
        
        # 简单规则
        if "policy" in domain or "policy" in str(sub_domain):
            return "policy_research"
        elif "lead" in domain or "lead" in str(sub_domain):
            return "lead_generation"
        elif "content" in domain:
            return "content_research"
        else:
            return "general_exploration"
    
    @staticmethod
    def _create_decision_preference(app: str, intent: str, adjustment: Dict) -> MemoryEntry:
        """
        从用户调整中创建决策偏好
        
        用户在 InteractionGate 的选择 → 决策偏好
        """
        adjustment_id = adjustment.get("id", "")
        custom_input = adjustment.get("custom_input")
        
        # 分析用户偏好
        signals = {}
        
        if adjustment_id == "continue":
            signals["when_uncertain"] = "prefer_continue"
            signals["interrupt_tolerance"] = "low"
        
        elif adjustment_id == "adjust_criteria":
            signals["when_no_match"] = "relax_criteria"
            signals["strategy_flexibility"] = "high"
        
        elif adjustment_id == "skip_and_continue":
            signals["when_stuck"] = "skip_current"
            signals["patience_level"] = "medium"
        
        elif adjustment_id == "stop":
            signals["when_uncertain"] = "prefer_stop"
            signals["risk_tolerance"] = "low"
        
        elif adjustment_id == "custom" and custom_input:
            signals["custom_preference"] = custom_input
        
        if not signals:
            return None
        
        # 创建记忆
        scope = MemoryScope(
            level=MemoryLevel.INTENT,
            app=app,
            intent=intent
        )
        
        entry_id = MemoryManager.generate_id("decision_preference", scope, signals)
        
        return MemoryEntry(
            id=entry_id,
            type=MemoryType.DECISION_PREFERENCE,
            scope=scope,
            signals=signals,
            confidence=0.6,
            stage=MemoryStage.OBSERVATION,  # 初始为观测
            ttl_days=60
        )
    
    @staticmethod
    def _create_strategy_template(app: str, intent: str, strategy_params: Dict,
                                   summary: Dict, user_feedback: Dict) -> MemoryEntry:
        """创建策略模板"""
        # 提取关键策略参数
        strategy_snapshot = {
            key: value for key, value in strategy_params.items()
            if key in ["min_match_score", "per_video_max_pages", "preferred_engagement_action"]
        }
        
        # 用户反馈
        feedback_signal = user_feedback.get("satisfaction", "neutral")
        
        # 创建记忆
        scope = MemoryScope(
            level=MemoryLevel.INTENT,
            app=app,
            intent=intent
        )
        
        signals = {
            "strategy_snapshot": strategy_snapshot,
            "user_feedback": feedback_signal,
            "success_metrics": {
                "matched": summary.get("matched_count", 0),
                "processed": summary.get("processed_count", 0)
            }
        }
        
        entry_id = MemoryManager.generate_id("strategy_template", scope, signals)
        
        # 如果用户满意，置信度更高
        confidence = 0.8 if feedback_signal == "satisfied" else 0.6
        
        return MemoryEntry(
            id=entry_id,
            type=MemoryType.STRATEGY_TEMPLATE,
            scope=scope,
            signals=signals,
            confidence=confidence,
            stage=MemoryStage.CANDIDATE,  # 至少是候选
            ttl_days=90
        )
    
    @staticmethod
    def _update_user_profile(user_feedback: Dict, task_context: Dict) -> MemoryEntry:
        """更新用户画像（L0）"""
        # 提取全局偏好
        signals = {}
        
        if "communication_style" in user_feedback:
            signals["communication_style"] = user_feedback["communication_style"]
        
        if "risk_tolerance" in user_feedback:
            signals["risk_tolerance"] = user_feedback["risk_tolerance"]
        
        if "preferred_pace" in user_feedback:
            signals["preferred_pace"] = user_feedback["preferred_pace"]
        
        if not signals:
            return None
        
        # 创建 L0 记忆
        scope = MemoryScope(level=MemoryLevel.GLOBAL)
        
        entry_id = MemoryManager.generate_id("user_profile", scope, signals)
        
        return MemoryEntry(
            id=entry_id,
            type=MemoryType.USER_PROFILE,
            scope=scope,
            signals=signals,
            confidence=0.7,
            stage=MemoryStage.OBSERVATION,
            ttl_days=0  # 永不过期
        )
    
    @staticmethod
    def _is_successful(runtime_stats: Dict) -> bool:
        """判断任务是否成功"""
        # 简单规则：没有错误、有匹配
        errors = runtime_stats.get("errors", 0)
        stop_reason = runtime_stats.get("stop_reason", "")
        
        return errors == 0 and stop_reason in ["达到目标", "用户主动停止"]

