#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class PerceptionAI(BaseAgent):
    """感知判断 AI"""
    
    AGENT_NAME = "PerceptionAI"
    PROMPT_FILE = "perception.prompt"
    USE_HISTORY = False
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1000
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "match_score" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "match_score": 0.5,
            "should_proceed": False,
            "confidence": 0.5,
            "match_reasons": [],
            "quality_assessment": "unknown"
        }

