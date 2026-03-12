#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any
from .base import BaseAgent
from ..memory import MemoryManager, MemoryEntry, MemoryScope, MemoryLevel, MemoryStage
import time


class MemoryLearnerAI(BaseAgent):
    """记忆学习 AI"""
    
    AGENT_NAME = "MemoryLearnerAI"
    PROMPT_FILE = "memory_learner.prompt"
    USE_HISTORY = True  # 跨任务学习
    HISTORY_FILE = "memory_session"
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        return "task_signature" in result
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        return {
            "task_signature": {
                "app": "unknown",
                "intent": "unknown",
                "domain": "unknown"
            },
            "strategy_snapshot": {},
            "confidence": 0.5,
            "note": "任务完成"
        }
    
    @classmethod
    def store_conversation_memory(cls, memory_data: Dict[str, Any]) -> bool:
        """
        存储对话相关的记忆
        
        Args:
            memory_data: 记忆数据，格式：
                {
                    "type": "user_profile | user_preference | conversation_context",
                    "content": {...},
                    "importance": "high | medium | low"
                }
        
        Returns:
            bool: 是否存储成功
        """
        try:
            memory_type = memory_data.get("type", "user_preference")
            content = memory_data.get("content", {})
            importance = memory_data.get("importance", "medium")
            
            # 创建记忆条目
            manager = MemoryManager()
            
            # 确定记忆级别和成熟度
            scope = MemoryScope(level=MemoryLevel.GLOBAL)
            
            # 根据重要性确定初始成熟度
            stage_map = {
                "high": MemoryStage.VALIDATED,
                "medium": MemoryStage.CANDIDATE,
                "low": MemoryStage.EXPERIMENTAL
            }
            stage = stage_map.get(importance, MemoryStage.CANDIDATE)
            
            # 创建记忆条目
            entry = MemoryEntry(
                memory_type=memory_type,
                scope=scope,
                ai_name=cls.AGENT_NAME,
                content=content,
                confidence=0.8,
                stage=stage,
                signals=content,  # 使用 content 作为 signals
                timestamp=time.time()
            )
            
            # 存储记忆
            manager.add_memory(entry)
            
            print(f"\n✓ [{cls.AGENT_NAME}] 已存储记忆:")
            print(f"  类型: {memory_type}")
            print(f"  重要性: {importance}")
            print(f"  成熟度: {stage}")
            print(f"  内容: {content}")
            
            return True
        
        except Exception as e:
            print(f"\n❌ [{cls.AGENT_NAME}] 存储记忆失败: {e}")
            return False

