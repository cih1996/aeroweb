#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class SummarizerAI(BaseAgent):
    """总结 AI"""
    
    AGENT_NAME = "SummarizerAI"
    PROMPT_FILE = "summarizer.prompt"
    USE_HISTORY = False
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "summary" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        collected_notes = inputs.get("collected_notes", [])
        return {
            "summary": f"完成任务，处理了 {len(collected_notes)} 个项目",
            "key_points": [f"共收集 {len(collected_notes)} 条笔记"]
        }

