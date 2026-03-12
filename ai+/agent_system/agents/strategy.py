#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent
from ..memory import MemoryRetriever, MemoryScope, MemoryLevel, MemoryStage


class StrategyAI(BaseAgent):
    """策略生成 AI（支持记忆检索）"""
    
    AGENT_NAME = "StrategyAI"
    PROMPT_FILE = "strategy.prompt"
    USE_HISTORY = False
    
    @classmethod
    def run(cls, task_context: Dict, app_capabilities: Dict, user_style_profile: Dict) -> Dict[str, Any]:
        """
        执行策略生成（增强版：从记忆中读取历史策略模板）
        """
        # 1. 检索历史策略模板
        retriever = MemoryRetriever()
        app_name = task_context.get("domain", "unknown")
        intent_key = task_context.get("task_name", "default")
        
        scope = MemoryScope(
            level=MemoryLevel.INTENT,
            app=app_name,
            intent=intent_key
        )
        
        strategy_templates = retriever.retrieve_strategy_templates(
            ai_name=cls.AGENT_NAME,
            scope=scope,
            min_stage=MemoryStage.CANDIDATE
        )
        
        # 2. 准备输入（附加历史策略）
        enhanced_inputs = {
            "task_context": task_context,
            "app_capabilities": app_capabilities,
            "user_style_profile": user_style_profile,
            "historical_strategies": []
        }
        
        if strategy_templates:
            print(f"[{cls.AGENT_NAME}] 📚 找到 {len(strategy_templates)} 个历史策略模板")
            for mem in strategy_templates:
                template = {
                    "strategy": mem.signals.get("strategy_snapshot", {}),
                    "success_rate": mem.signals.get("success_rate", 0),
                    "confidence": mem.confidence,
                    "stage": mem.stage.value
                }
                enhanced_inputs["historical_strategies"].append(template)
                print(f"    • 策略模板 (confidence={mem.confidence}, stage={mem.stage.value})")
        
        # 3. 调用基类方法
        return super(StrategyAI, cls).run(**enhanced_inputs)
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "min_match_score" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "per_video_max_pages": 1,
            "comment_style": "neutral",
            "early_stop_threshold": 0.7,
            "max_comments_per_hour": 10,
            "preferred_engagement_action": "like",
            "fallback_engagement_action": "next",
            "min_match_score": 0.6
        }

