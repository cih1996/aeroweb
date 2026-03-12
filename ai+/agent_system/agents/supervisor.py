#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent
from ..memory import MemoryRetriever, MemoryScope, MemoryLevel, MemoryStage


class SupervisorAI(BaseAgent):
    """监督 AI（支持记忆检索：读取用户偏好）"""
    
    AGENT_NAME = "SupervisorAI"
    PROMPT_FILE = "supervisor.prompt"
    USE_HISTORY = False
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.2
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1000
    
    @classmethod
    def run(cls, runtime_state: Dict, execution_metrics: Dict, risk_policy: Dict) -> Dict[str, Any]:
        """
        执行监督（增强版：从记忆中读取用户偏好）
        """
        # 1. 检索用户偏好（Global 级别）
        retriever = MemoryRetriever()
        
        global_scope = MemoryScope(level=MemoryLevel.GLOBAL)
        
        user_profiles = retriever.retrieve_user_profiles(
            ai_name=cls.AGENT_NAME,
            scope=global_scope,
            min_stage=MemoryStage.STABLE
        )
        
        # 2. 准备输入（附加用户偏好）
        enhanced_inputs = {
            "runtime_state": runtime_state,
            "execution_metrics": execution_metrics,
            "risk_policy": risk_policy,
            "user_preferences": {}
        }
        
        if user_profiles:
            print(f"[{cls.AGENT_NAME}] 📚 找到 {len(user_profiles)} 个用户偏好")
            for mem in user_profiles:
                prefs = mem.signals.get("preferences", {})
                enhanced_inputs["user_preferences"].update(prefs)
                print(f"    • interrupt_tolerance={prefs.get('interrupt_tolerance', 'N/A')}")
                print(f"    • pace_preference={prefs.get('pace_preference', 'N/A')}")
        
        # 3. 调用基类方法
        return super(SupervisorAI, cls).run(**enhanced_inputs)
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "control" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "control": "CONTINUE",
            "duration_seconds": 0,
            "reason": "正常运行"
        }

