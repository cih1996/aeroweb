#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
APP 注册表

管理所有已注册的 APP 执行器
"""

from typing import Dict, Optional
from .base import BaseAppHandler


class AppRegistry:
    """
    APP 注册表（单例模式）
    
    用法：
        # 1. 注册你的 Handler
        AppRegistry.register("douyin", DouyinHandler())
        AppRegistry.register("bilibili", BilibiliHandler())
        
        # 2. 系统会自动查找和使用
        handler = AppRegistry.get("douyin")
    """
    
    _instance = None
    _handlers: Dict[str, BaseAppHandler] = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @classmethod
    def register(cls, app_name: str, handler: BaseAppHandler):
        """
        注册 APP 执行器
        
        Args:
            app_name: APP 名称（如 "douyin"）
            handler: 执行器实例
        """
        if not isinstance(handler, BaseAppHandler):
            raise TypeError(f"handler 必须是 BaseAppHandler 的子类，但收到: {type(handler)}")
        
        cls._handlers[app_name] = handler
        print(f"✓ [AppRegistry] 已注册 APP: {app_name}")
    
    @classmethod
    def get(cls, app_name: str) -> Optional[BaseAppHandler]:
        """
        获取 APP 执行器
        
        Args:
            app_name: APP 名称
        
        Returns:
            执行器实例，如果不存在返回 None
        """
        return cls._handlers.get(app_name)
    
    @classmethod
    def list_apps(cls) -> list:
        """列出所有已注册的 APP"""
        return list(cls._handlers.keys())
    
    @classmethod
    def get_capabilities(cls, app_name: str) -> Optional[Dict]:
        """获取指定 APP 的能力定义"""
        handler = cls.get(app_name)
        return handler.get_capabilities() if handler else None
    
    @classmethod
    def get_all_capabilities(cls) -> Dict[str, Dict]:
        """获取所有 APP 的能力定义"""
        return {
            app_name: handler.get_capabilities()
            for app_name, handler in cls._handlers.items()
        }
    
    @classmethod
    def clear(cls):
        """清空注册表（用于测试）"""
        cls._handlers.clear()
    
    @classmethod
    def unregister(cls, app_name: str):
        """注销 APP"""
        if app_name in cls._handlers:
            del cls._handlers[app_name]
            print(f"✓ [AppRegistry] 已注销 APP: {app_name}")

