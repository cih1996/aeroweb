#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any, List
from .base import BaseAgent


class CapabilityMatcherAI(BaseAgent):
    """能力匹配 AI"""
    
    AGENT_NAME = "CapabilityMatcherAI"
    PROMPT_FILE = "capability_matcher.prompt"
    USE_HISTORY = False  # 不需要历史记录
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.2  # 低温度，需要精确匹配
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1500
    
    @classmethod
    def run(cls, task_description: str, required_capabilities: List[str],
            capability_actions: List[str], available_providers: List[Dict]) -> Dict[str, Any]:
        """
        匹配能力提供者
        
        Args:
            task_description: 任务描述
            required_capabilities: 所需能力类型
            capability_actions: 所需能力动作
            available_providers: 可用的提供者列表
        
        Returns:
            匹配结果
        """
        inputs = {
            "task_description": task_description,
            "required_capabilities": required_capabilities,
            "capability_actions": capability_actions,
            "available_providers": available_providers
        }
        
        result = super(CapabilityMatcherAI, cls).run(**inputs)
        
        # 打印匹配结果
        matched = result.get("matched", False)
        
        if matched:
            provider = result.get("capability_provider", {})
            provider_name = provider.get("name", "未知")
            provider_type = provider.get("type", "未知")
            match_score = provider.get("match_score", 0)
            
            print(f"\n[{cls.AGENT_NAME}] ✓ 匹配成功")
            print(f"              提供者: {provider_name} ({provider_type})")
            print(f"              匹配分数: {match_score:.2f}")
            print(f"              理由: {provider.get('reasoning', '')}")
            
            alternatives = result.get("alternatives", [])
            if alternatives:
                print(f"              备选方案: {len(alternatives)} 个")
        else:
            missing = result.get("missing_capabilities", [])
            suggestion = result.get("suggestion", "")
            
            print(f"\n[{cls.AGENT_NAME}] ✗ 未找到匹配")
            print(f"              缺失能力: {', '.join(missing)}")
            print(f"              建议: {suggestion[:100]}...")
        
        return result
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        """验证结果格式"""
        return "matched" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        """默认结果：未匹配"""
        required_capabilities = inputs.get("required_capabilities", [])
        
        return {
            "matched": False,
            "capability_provider": None,
            "alternatives": [],
            "missing_capabilities": required_capabilities,
            "suggestion": "无法找到匹配的能力提供者，请检查是否已注册相关 APP 或服务。",
            "reasoning": "匹配失败，使用默认结果"
        }

