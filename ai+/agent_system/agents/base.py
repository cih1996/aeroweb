#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI Agent 基类
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

# 导入 SimpleAIClient
sys.path.append(str(Path(__file__).parent.parent.parent))
from services.simple_client import SimpleAIClient
from ..utils.ai_helper import parse_ai_response


class BaseAgent(ABC):
    """
    AI Agent 基类
    
    所有 AI 都继承这个类，提供统一的调用接口
    """
    
    # 子类需要定义这些属性
    AGENT_NAME: str = "BaseAgent"
    PROMPT_FILE: str = ""
    USE_HISTORY: bool = False
    HISTORY_FILE: Optional[str] = None
    
    # 类级别的 token 统计（所有实例共享）
    _token_stats = {}
    
    @classmethod
    def run(cls, **inputs) -> Dict[str, Any]:
        """
        运行 AI（子类实现具体逻辑）
        
        Args:
            **inputs: 输入参数
        
        Returns:
            AI 返回的结果（JSON）
        """
        try:
            # 构建 prompt 文件路径
            prompt_path = Path(__file__).parent.parent.parent / "prompts" / "agents" / cls.PROMPT_FILE
            
            # 创建 SimpleAIClient
            client = SimpleAIClient(
                provider='deepseek',
                name=cls.AGENT_NAME,
                prompt_file=str(prompt_path),
                history_file=cls.HISTORY_FILE if cls.USE_HISTORY else None
            )
            
            # 构建输入消息
            input_text = "输入参数：\n" + json.dumps(inputs, ensure_ascii=False, indent=2)
            
            # 调用 AI
            response = client.chat(
                content=input_text,
                use_history=cls.USE_HISTORY,
                max_tokens=cls.get_max_tokens(),
                temperature=cls.get_temperature()
            )
            
            # 记录 token 使用情况
            cls._record_token_usage(response)
            
            if response.get("success"):
                result = parse_ai_response(response.get("content", ""))
                
                # 验证结果（子类可重写）
                if not cls.validate_result(result):
                    result = cls.get_default_result(**inputs)
                
                return result
            else:
                raise Exception(response.get('message', '未知错误'))
        
        except Exception as e:
            print(f"⚠️ [{cls.AGENT_NAME}] 调用出错: {e}")
            return cls.get_default_result(**inputs)
    
    @classmethod
    def _record_token_usage(cls, response: Dict[str, Any]):
        """
        记录 token 使用情况
        
        Args:
            response: AI 返回的响应（包含 usage 信息）
        """
        if not response.get("success"):
            return
        
        usage = response.get("usage", {})
        if not usage:
            return
        
        # 初始化该 AI 的统计数据
        if cls.AGENT_NAME not in cls._token_stats:
            cls._token_stats[cls.AGENT_NAME] = {
                "call_count": 0,
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "cached_tokens": 0
            }
        
        # 累加统计
        stats = cls._token_stats[cls.AGENT_NAME]
        stats["call_count"] += 1
        stats["total_tokens"] += usage.get("total_tokens", 0)
        stats["prompt_tokens"] += usage.get("prompt_tokens", 0)
        stats["completion_tokens"] += usage.get("completion_tokens", 0)
        
        # DeepSeek 和 OpenAI 可能有缓存的 tokens
        prompt_details = usage.get("prompt_tokens_details", {})
        stats["cached_tokens"] += prompt_details.get("cached_tokens", 0)
    
    @classmethod
    def get_token_stats(cls) -> Dict[str, Any]:
        """
        获取该 AI 的 token 统计
        
        Returns:
            统计数据字典
        """
        return cls._token_stats.get(cls.AGENT_NAME, {
            "call_count": 0,
            "total_tokens": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "cached_tokens": 0
        })
    
    @classmethod
    def get_all_token_stats(cls) -> Dict[str, Dict[str, Any]]:
        """
        获取所有 AI 的 token 统计
        
        Returns:
            所有 AI 的统计数据
        """
        return cls._token_stats.copy()
    
    @classmethod
    def reset_token_stats(cls):
        """重置所有 AI 的 token 统计"""
        cls._token_stats = {}
    
    @classmethod
    def get_max_tokens(cls) -> int:
        """获取最大 token 数（子类可重写）"""
        return 2000
    
    @classmethod
    def get_temperature(cls) -> float:
        """获取温度参数（子类可重写）"""
        return 0.3
    
    @classmethod
    @abstractmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        """
        验证结果是否有效（子类必须实现）
        
        Args:
            result: AI 返回的结果
        
        Returns:
            是否有效
        """
        pass
    
    @classmethod
    @abstractmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        """
        获取默认结果（子类必须实现）
        
        Args:
            **inputs: 输入参数
        
        Returns:
            默认结果
        """
        pass

