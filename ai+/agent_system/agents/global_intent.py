#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent
from ..memory import MemoryRetriever, MemoryScope, MemoryLevel, MemoryStage


class GlobalIntentAI(BaseAgent):
    """全局意图识别 AI（支持记忆检索：读取用户画像）"""
    
    AGENT_NAME = "GlobalIntentAI"
    PROMPT_FILE = "global_intent.prompt"
    USE_HISTORY = True  # 跨任务历史
    HISTORY_FILE = "global_session"
    
    @classmethod
    def run(cls, user_message: str, session_memory: Dict, user_profile: Dict) -> Dict[str, Any]:
        """
        执行全局意图识别（增强版：从记忆中读取用户画像）
        """
        # 1. 检索用户画像（Global 级别）
        retriever = MemoryRetriever()
        
        global_scope = MemoryScope(level=MemoryLevel.GLOBAL)
        
        user_profiles = retriever.retrieve_user_profiles(
            ai_name=cls.AGENT_NAME,
            scope=global_scope,
            min_stage=MemoryStage.STABLE
        )
        
        # 2. 准备输入（附加用户画像）
        enhanced_inputs = {
            "user_message": user_message,
            "session_memory": session_memory,
            "user_profile": user_profile,
            "historical_profiles": []
        }
        
        if user_profiles:
            print(f"[{cls.AGENT_NAME}] 📚 找到 {len(user_profiles)} 个用户画像")
            for mem in user_profiles:
                profile = {
                    "interests": mem.signals.get("interests", []),
                    "preferences": mem.signals.get("preferences", {}),
                    "behavior_patterns": mem.signals.get("behavior_patterns", []),
                    "confidence": mem.confidence
                }
                enhanced_inputs["historical_profiles"].append(profile)
                print(f"    • 兴趣: {', '.join(profile['interests'][:3])}")
        
        # 3. 调用基类方法
        return super(GlobalIntentAI, cls).run(**enhanced_inputs)
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "intents" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        user_message = inputs.get("user_message", "")
        return {
            "intents": [{
                "app": "douyin",
                "intent": "explore",
                "goal": user_message,
                "confidence": 0.5,
                "keywords": []
            }]
        }

