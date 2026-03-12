#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent
from ..memory import MemoryRetriever, MemoryScope, MemoryLevel, MemoryStage


class DecisionAI(BaseAgent):
    """决策 AI（支持记忆检索：读取决策偏好）"""
    
    AGENT_NAME = "DecisionAI"
    PROMPT_FILE = "decision.prompt"
    USE_HISTORY = True  # ★ 关键：避免重复决策
    HISTORY_FILE = "decision_session"
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.2  # 低温度，更确定性
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1000
    
    @classmethod
    def run(cls, current_state: Dict, object_info: Dict, strategy_params: Dict, 
            progress: Dict, perception_result: Dict = None, app_capabilities: Dict = None,
            batch_size: int = 1) -> Dict[str, Any]:
        """
        执行决策（增强版：从记忆中读取决策偏好 + 能力列表约束 + 批量决策）
        
        Args:
            batch_size: 一次规划多少步（默认 1）
        """
        # 1. 检索决策偏好
        retriever = MemoryRetriever()
        
        # 从 current_state 中提取 app 和 intent
        app_name = current_state.get("app", "unknown")
        intent_key = current_state.get("intent", "default")
        
        scope = MemoryScope(
            level=MemoryLevel.INTENT,
            app=app_name,
            intent=intent_key
        )
        
        decision_prefs = retriever.retrieve_decision_preferences(
            ai_name=cls.AGENT_NAME,
            scope=scope,
            min_stage=MemoryStage.CANDIDATE
        )
        
        # 2. 准备输入（附加决策偏好 + 能力列表 + 批量大小）
        enhanced_inputs = {
            "current_state": current_state,
            "object_info": object_info,
            "strategy_params": strategy_params,
            "progress": progress,
            "perception_result": perception_result,
            "decision_preferences": [],
            "app_capabilities": app_capabilities or {},  # 🆕 可用的动作列表
            "batch_size": batch_size  # 🆕 批量决策大小
        }
        
        if decision_prefs:
            print(f"[{cls.AGENT_NAME}] 📚 找到 {len(decision_prefs)} 个决策偏好")
            for mem in decision_prefs:
                pref = {
                    "preferred_action": mem.signals.get("preferred_action"),
                    "trigger_condition": mem.signals.get("trigger_condition"),
                    "success_count": mem.signals.get("success_count", 0),
                    "confidence": mem.confidence
                }
                enhanced_inputs["decision_preferences"].append(pref)
                print(f"    • {pref['trigger_condition']} -> {pref['preferred_action']} (conf={mem.confidence})")
        
        # 3. 调用基类方法
        return super(DecisionAI, cls).run(**enhanced_inputs)
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        # 支持单步决策和批量决策两种格式
        if "decisions" in result:
            # 批量决策格式
            return isinstance(result["decisions"], list) and len(result["decisions"]) > 0
        else:
            # 单步决策格式
            return "action" in result and "action_type" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "action_type": "navigate",
            "action": "next",
            "params": [],
            "reason": "默认决策",
            "wait_seconds": 0
        }

