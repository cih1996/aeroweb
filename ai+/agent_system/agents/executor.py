#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class ExecutorAI(BaseAgent):
    """执行 AI"""
    
    AGENT_NAME = "ExecutorAI"
    PROMPT_FILE = "executor.prompt"
    USE_HISTORY = False
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.2
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1000
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "type" in result or "action" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        command = inputs.get("command", {})
        return {
            "type": "execute",
            "action": command.get("action", "unknown"),
            "params": command.get("params", []),
            "progress": inputs.get("progress", {})
        }

