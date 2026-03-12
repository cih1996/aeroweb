#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any, List
from .base import BaseAgent
from ..memory import MemoryRetriever, MemoryScope, MemoryLevel, MemoryStage


class DialogAI(BaseAgent):
    """对话 AI"""
    
    AGENT_NAME = "DialogAI"
    PROMPT_FILE = "dialog.prompt"
    USE_HISTORY = True  # 使用对话历史
    HISTORY_FILE = "dialog_session"
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.7  # 较高温度，更自然的对话
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 1000
    
    @classmethod
    def run(cls, user_message: str, conversation_history: List[Dict] = None,
            router_info: Dict = None) -> Dict[str, Any]:
        """
        处理对话
        
        Args:
            user_message: 用户消息
            conversation_history: 对话历史
            router_info: 路由 AI 提取的信息
        
        Returns:
            对话响应
        """
        # 1. 从记忆中检索用户画像
        retriever = MemoryRetriever()
        
        # 检索所有全局记忆（不过滤类型，因为对话场景使用的是字符串类型）
        user_memories = retriever.retrieve(
            ai_name=cls.AGENT_NAME,
            scope=MemoryScope(level=MemoryLevel.GLOBAL),
            memory_types=None,  # 不过滤类型，读取所有全局记忆
            min_stage=MemoryStage.OBSERVATION
        )
        
        # 构建用户画像（只提取 user_profile 和 user_preference 类型）
        user_profile = {}
        
        if user_memories:
            print(f"[{cls.AGENT_NAME}] 📚 找到 {len(user_memories)} 个全局记忆")
            for mem in user_memories:
                # 过滤出用户相关的记忆
                if mem.type in ["user_profile", "user_preference"]:
                    content = mem.content
                    if isinstance(content, dict):
                        user_profile.update(content)
        
        # 2. 准备输入
        inputs = {
            "user_message": user_message,
            "conversation_history": conversation_history or [],
            "user_profile": user_profile,
            "router_info": router_info or {}
        }
        
        # 3. 调用基类方法
        result = super(DialogAI, cls).run(**inputs)
        
        # 4. 打印结果
        response = result.get("response", "")
        should_memorize = result.get("should_memorize", False)
        
        print(f"\n[{cls.AGENT_NAME}] 响应: {response[:100]}{'...' if len(response) > 100 else ''}")
        if should_memorize:
            memory_data = result.get("memory_data", {})
            memory_type = memory_data.get("type", "未知")
            importance = memory_data.get("importance", "medium")
            print(f"              需要记忆: {memory_type} (重要性: {importance})")
        
        suggestions = result.get("suggestions", [])
        if suggestions:
            print(f"              建议: {len(suggestions)} 条")
        
        return result
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        """验证结果格式"""
        return "response" in result and "should_memorize" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        """默认结果"""
        return {
            "response": "抱歉，我没有理解你的意思。能再说一遍吗？",
            "should_memorize": False,
            "memory_data": None,
            "suggestions": [],
            "follow_up_questions": []
        }

