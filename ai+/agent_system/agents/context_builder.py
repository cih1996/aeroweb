#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent


class ContextBuilderAI(BaseAgent):
    """上下文构建 AI"""
    
    AGENT_NAME = "ContextBuilderAI"
    PROMPT_FILE = "context_builder.prompt"
    USE_HISTORY = False
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "domain" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "domain": "social_media",
            "sub_domain": ["video_platform"],
            "risk_level": "low",
            "user_style_hint": "谨慎探索",
            "match_criteria": {}
        }

