#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class InteractionGateAI(BaseAgent):
    """人机交互确认 AI"""
    
    AGENT_NAME = "InteractionGateAI"
    PROMPT_FILE = "interaction_gate.prompt"
    USE_HISTORY = False
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.4
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1500
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "situation" in result and "options" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "situation": "系统运行中遇到异常",
            "details": "建议人工介入确认",
            "data_summary": inputs.get("current_progress", {}),
            "options": [
                {"id": "continue", "label": "继续", "description": "维持当前策略"},
                {"id": "stop", "label": "停止", "description": "结束任务"}
            ],
            "recommend_stop": False,
            "severity": "medium"
        }

