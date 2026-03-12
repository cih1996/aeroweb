#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
记忆类型定义
"""

import time
from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass, field


class MemoryLevel(Enum):
    """记忆层级"""
    GLOBAL = "global"      # L0: 全局记忆（用户相关）
    APP = "app"            # L1: 应用级记忆（平台相关）
    INTENT = "intent"      # L2: 意图/任务级记忆


class MemoryType(Enum):
    """记忆类型"""
    # 决策偏好（给 Supervisor/Runtime 用）
    DECISION_PREFERENCE = "decision_preference"
    
    # 策略模板（给 StrategyAI 用）
    STRATEGY_TEMPLATE = "strategy_template"
    
    # 负样本（用户明确否定的）
    NEGATIVE_PREFERENCE = "negative_preference"
    
    # 观测事件（统计用，不直接复用）
    OBSERVATION = "observation"
    
    # 用户画像（L0 专用）
    USER_PROFILE = "user_profile"


class MemoryStage(Enum):
    """记忆成熟度"""
    OBSERVATION = 1        # 观测事件（只统计）
    CANDIDATE = 2          # 候选偏好（出现2次）
    STABLE = 3             # 稳定偏好（出现3-5次）
    RULE = 4               # 规则/模板（用户明确确认）


@dataclass
class MemoryScope:
    """
    记忆作用域
    
    匹配优先级：intent > app > global
    """
    level: MemoryLevel
    app: Optional[str] = None
    intent: Optional[str] = None
    
    def matches(self, other: 'MemoryScope') -> bool:
        """判断是否匹配"""
        if self.level != other.level:
            return False
        
        if self.level == MemoryLevel.GLOBAL:
            return True
        
        if self.level == MemoryLevel.APP:
            return self.app == other.app
        
        if self.level == MemoryLevel.INTENT:
            return self.app == other.app and self.intent == other.intent
        
        return False
    
    def match_score(self, other: 'MemoryScope') -> float:
        """
        计算匹配分数（用于排序）
        
        Returns:
            0-1 之间的分数，越大越匹配
        """
        if not self.matches(other):
            return 0.0
        
        if self.level == MemoryLevel.INTENT:
            return 1.0
        elif self.level == MemoryLevel.APP:
            return 0.7
        else:  # GLOBAL
            return 0.5
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "level": self.level.value,
            "app": self.app,
            "intent": self.intent
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MemoryScope':
        """从字典创建"""
        return cls(
            level=MemoryLevel(data["level"]),
            app=data.get("app"),
            intent=data.get("intent")
        )


@dataclass
class MemoryEntry:
    """
    记忆条目
    
    符合用户设计文档的完整记忆结构
    """
    # 基础字段
    id: str                              # 唯一 ID
    type: MemoryType                     # 记忆类型
    scope: MemoryScope                   # 作用域
    
    # 内容字段
    signals: Dict[str, Any] = field(default_factory=dict)  # 信号数据
    
    # 元数据
    confidence: float = 0.5              # 置信度 [0, 1]
    stage: MemoryStage = MemoryStage.OBSERVATION  # 成熟度
    count: int = 1                       # 出现次数
    
    # 时间戳
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    
    # TTL（过期时间，天数）
    ttl_days: int = 90
    
    # 额外数据
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def is_expired(self) -> bool:
        """判断是否过期"""
        if self.ttl_days <= 0:
            return False  # 永不过期
        
        current_time = time.time()
        elapsed_days = (current_time - self.updated_at) / 86400
        return elapsed_days > self.ttl_days
    
    def refresh(self):
        """刷新时间戳"""
        self.last_seen = time.time()
        self.updated_at = time.time()
        self.count += 1
    
    def upgrade_stage(self):
        """升级成熟度"""
        if self.stage == MemoryStage.OBSERVATION and self.count >= 2:
            self.stage = MemoryStage.CANDIDATE
        elif self.stage == MemoryStage.CANDIDATE and self.count >= 3:
            self.stage = MemoryStage.STABLE
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于持久化）"""
        return {
            "id": self.id,
            "type": self.type.value,
            "scope": self.scope.to_dict(),
            "signals": self.signals,
            "confidence": self.confidence,
            "stage": self.stage.value,
            "count": self.count,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_seen": self.last_seen,
            "ttl_days": self.ttl_days,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MemoryEntry':
        """从字典创建"""
        return cls(
            id=data["id"],
            type=MemoryType(data["type"]),
            scope=MemoryScope.from_dict(data["scope"]),
            signals=data.get("signals", {}),
            confidence=data.get("confidence", 0.5),
            stage=MemoryStage(data.get("stage", 1)),
            count=data.get("count", 1),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time()),
            last_seen=data.get("last_seen", time.time()),
            ttl_days=data.get("ttl_days", 90),
            metadata=data.get("metadata", {})
        )

