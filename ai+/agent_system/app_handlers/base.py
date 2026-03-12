#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
APP 执行器基类

用户只需要继承 BaseAppHandler，实现自己的 APP 操作即可
"""

from typing import Dict, Any, List, Callable, Optional
from abc import ABC, abstractmethod


class AppCapability:
    """
    APP 能力定义（不可变配置）
    """
    
    def __init__(self, app_name: str):
        """
        初始化能力定义
        
        Args:
            app_name: APP 名称（如 "douyin", "bilibili"）
        """
        self.app_name = app_name
        self._capabilities = {
            "navigation": {},
            "read": {},
            "engagement": {}
        }
    
    def add_navigation(self, action_name: str, params: List[str], description: str):
        """添加导航能力"""
        self._capabilities["navigation"][action_name] = {
            "params": params,
            "description": description
        }
        return self
    
    def add_read(self, action_name: str, params: List[str], description: str):
        """添加读取能力"""
        self._capabilities["read"][action_name] = {
            "params": params,
            "description": description
        }
        return self
    
    def add_engagement(self, action_name: str, params: List[str], description: str):
        """添加互动能力"""
        self._capabilities["engagement"][action_name] = {
            "params": params,
            "description": description
        }
        return self
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（给 AI 使用）"""
        return self._capabilities.copy()


class ActionResult:
    """
    动作执行结果（标准化返回）
    """
    
    def __init__(self, success: bool, action: str, data: Any = None, 
                 message: str = "", error: str = "", 
                 metadata: Dict[str, Any] = None):
        """
        初始化执行结果
        
        Args:
            success: 是否成功
            action: 动作名称
            data: 返回数据
            message: 消息
            error: 错误信息
            metadata: 元数据（用于告诉 Runtime 如何更新状态）
                - new_object: Dict - 导航到新对象时提供新对象信息
                - context_data: List/Dict - 读取上下文数据（如评论列表）
                - progress_delta: Dict - 进度增量（如 engagements_made: 1）
        """
        self.success = success
        self.action = action
        self.data = data
        self.message = message
        self.error = error
        self.metadata = metadata or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        result = {
            "success": self.success,
            "action": self.action
        }
        if self.data is not None:
            result["data"] = self.data
        if self.message:
            result["message"] = self.message
        if self.error:
            result["error"] = self.error
        if self.metadata:
            result["metadata"] = self.metadata
        return result
    
    @staticmethod
    def success_result(action: str, data: Any = None, message: str = "操作成功", 
                      metadata: Dict[str, Any] = None):
        """创建成功结果"""
        return ActionResult(success=True, action=action, data=data, 
                          message=message, metadata=metadata)
    
    @staticmethod
    def error_result(action: str, error: str):
        """创建失败结果"""
        return ActionResult(success=False, action=action, error=error)


class BaseAppHandler(ABC):
    """
    APP 执行器基类
    
    用户只需要：
    1. 继承这个类
    2. 实现 register_capabilities() - 注册你的 APP 能力
    3. 实现 execute() - 执行具体动作
    
    示例：
        class DouyinHandler(BaseAppHandler):
            def register_capabilities(self) -> AppCapability:
                cap = AppCapability("douyin")
                cap.add_navigation("next", [], "切换到下一个视频")
                cap.add_read("getVideoInfo", [], "获取视频信息")
                cap.add_read("getComments", [], "获取评论")
                cap.add_engagement("like", [], "点赞")
                return cap
            
            def execute(self, action: str, params: List[Any]) -> ActionResult:
                if action == "next":
                    # 导航动作：提供新对象信息
                    video_info = self._get_current_video()
                    return ActionResult.success_result(
                        "next", 
                        data=video_info,
                        metadata={"new_object": video_info}
                    )
                elif action == "getComments":
                    # 读取动作：提供上下文数据
                    comments = self._fetch_comments()
                    return ActionResult.success_result(
                        "getComments",
                        data=comments,
                        metadata={"context_data": comments}
                    )
                elif action == "like":
                    # 互动动作：增加互动计数
                    return ActionResult.success_result(
                        "like",
                        metadata={"progress_delta": {"engagements_made": 1}}
                    )
                else:
                    return ActionResult.error_result(action, f"未知动作: {action}")
    """
    
    def __init__(self):
        """初始化执行器"""
        self._capabilities = self.register_capabilities()
        self._action_map = self._build_action_map()
    
    @abstractmethod
    def register_capabilities(self) -> AppCapability:
        """
        注册 APP 能力（必须实现）
        
        Returns:
            AppCapability 实例
        """
        pass
    
    @abstractmethod
    def execute(self, action: str, params: List[Any]) -> ActionResult:
        """
        执行动作（必须实现）
        
        Args:
            action: 动作名称（如 "next", "like", "getVideoInfo"）
            params: 参数列表
        
        Returns:
            ActionResult 实例
        """
        pass
    
    def _build_action_map(self) -> Dict[str, str]:
        """构建动作映射表（action -> type）"""
        action_map = {}
        cap_dict = self._capabilities.to_dict()
        
        for action_type, actions in cap_dict.items():
            for action_name in actions.keys():
                action_map[action_name] = action_type
        
        return action_map
    
    def get_capabilities(self) -> Dict[str, Any]:
        """获取能力定义（给 AI 使用）"""
        return self._capabilities.to_dict()
    
    def get_app_name(self) -> str:
        """获取 APP 名称"""
        return self._capabilities.app_name
    
    def get_action_type(self, action: str) -> Optional[str]:
        """获取动作类型"""
        return self._action_map.get(action)
    
    def validate_action(self, action: str) -> bool:
        """验证动作是否存在"""
        return action in self._action_map
    
    # ===== 可选的生命周期钩子 =====
    
    def on_task_start(self, task_context: Dict[str, Any]):
        """任务开始时的钩子（可选重写）"""
        pass
    
    def on_task_end(self, task_summary: Dict[str, Any]):
        """任务结束时的钩子（可选重写）"""
        pass
    
    def on_action_before(self, action: str, params: List[Any]):
        """动作执行前的钩子（可选重写）"""
        pass
    
    def on_action_after(self, action: str, result: ActionResult):
        """动作执行后的钩子（可选重写）"""
        pass

