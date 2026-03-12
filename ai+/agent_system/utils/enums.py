#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
枚举定义
"""

from enum import Enum


class ObjectState(Enum):
    """对象处理状态"""
    DISCOVERED = "discovered"      # 已发现
    PERCEIVED = "perceived"        # 已感知
    MATCHED = "matched"            # 已匹配
    ENGAGED = "engaged"            # 已互动
    SKIPPED = "skipped"            # 已跳过
    ERROR = "error"                # 处理出错


class ActionType(Enum):
    """动作类型（通用）"""
    NAVIGATE = "navigate"          # 导航类（next, search, scroll）
    READ = "read"                  # 读取类（getInfo, getComments）
    ENGAGE = "engage"              # 互动类（like, comment, share）
    ANALYZE = "analyze"            # 分析类（perception）
    CONTROL = "control"            # 控制类（pause, stop）

