#!/usr/bin/env python
# -*- coding: utf-8 -*-
from typing import Dict, Any, List
from .base import BaseAgent


class TaskPlannerAI(BaseAgent):
    """任务规划 AI"""
    
    AGENT_NAME = "TaskPlannerAI"
    PROMPT_FILE = "task_planner.prompt"
    USE_HISTORY = False  # 不需要历史记录
    
    @classmethod
    def get_temperature(cls) -> float:
        return 0.4  # 中等温度，平衡创造性和确定性
    
    @classmethod
    def get_max_tokens(cls) -> int:
        return 2000
    
    @classmethod
    def run(cls, user_message: str, conversation_history: List[Dict] = None) -> Dict[str, Any]:
        """
        规划任务
        
        Args:
            user_message: 用户任务描述
            conversation_history: 对话历史
        
        Returns:
            任务规划结果
        """
        inputs = {
            "user_message": user_message,
            "conversation_history": conversation_history or []
        }
        
        result = super(TaskPlannerAI, cls).run(**inputs)
        
        # 打印规划结果
        complexity = result.get("complexity", "unknown")
        needs_decomposition = result.get("needs_decomposition", False)
        main_goal = result.get("main_goal", "")
        
        print(f"\n[{cls.AGENT_NAME}] 任务复杂度: {complexity}")
        print(f"              主要目标: {main_goal}")
        
        if needs_decomposition:
            sub_tasks = result.get("sub_tasks", [])
            print(f"              子任务数: {len(sub_tasks)}")
            for i, task in enumerate(sub_tasks, 1):
                print(f"                {i}. {task.get('description')}")
                print(f"                   需要能力: {', '.join(task.get('required_capabilities', []))}")
        else:
            required = result.get("required_capabilities", [])
            print(f"              需要能力: {', '.join(required)}")
        
        return result
    
    @classmethod
    def validate_result(cls, result: Dict[str, Any]) -> bool:
        """验证结果格式"""
        if "complexity" not in result or "needs_decomposition" not in result:
            return False
        
        needs_decomposition = result.get("needs_decomposition", False)
        
        if needs_decomposition:
            # 需要分解的任务必须有 sub_tasks
            return "sub_tasks" in result and isinstance(result["sub_tasks"], list) and len(result["sub_tasks"]) > 0
        else:
            # 简单任务必须有 required_capabilities
            return "required_capabilities" in result
        
        return True
    
    @classmethod
    def get_default_result(cls, **inputs) -> Dict[str, Any]:
        """默认结果：简单任务"""
        return {
            "complexity": "simple",
            "needs_decomposition": False,
            "main_goal": "执行用户请求的任务",
            "required_capabilities": ["short_video_platform"],
            "capability_actions": ["navigation", "read"],
            "reasoning": "无法确定任务复杂度，默认为简单任务"
        }

