#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class ConversationRouterAI(BaseAgent):
    """对话路由 AI"""
    
    AGENT_NAME = "ConversationRouterAI"
    PROMPT_FILE = "conversation_router.prompt"
    USE_HISTORY = False  # 不需要历史记录
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.3  # 低温度，更确定性的路由决策
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 500
    
    @classmethod
    def run(cls, user_message: str, conversation_history: list = None, 
            user_profile: Dict = None) -> Dict[str, Any]:
        """
        路由用户消息
        
        Args:
            user_message: 用户消息
            conversation_history: 对话历史（最近 10 条）
            user_profile: 用户画像
        
        Returns:
            路由结果
        """
        inputs = {
            "user_message": user_message,
            "conversation_history": conversation_history or [],
            "user_profile": user_profile or {}
        }
        
        result = super(ConversationRouterAI, cls).run(**inputs)
        
        # 打印路由结果
        intent_type = result.get("intent_type")
        confidence = result.get("confidence", 0)
        reasoning = result.get("reasoning", "")
        
        print(f"\n[{cls.AGENT_NAME}] 路由到: {intent_type}")
        print(f"              置信度: {confidence:.2f}")
        print(f"              理由: {reasoning}")
        
        return result
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        """验证结果格式"""
        return (
            "intent_type" in result and 
            result["intent_type"] in ["conversation", "task"] and
            "confidence" in result
        )
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        """默认结果：倾向于对话模式"""
        return {
            "intent_type": "conversation",
            "confidence": 0.5,
            "reasoning": "无法确定意图，默认为对话模式",
            "extracted_info": {
                "topic": "未知",
                "emotion": "中性",
                "needs_memory": False
            },
            "task_hint": None
        }

