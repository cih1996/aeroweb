#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
记忆检索器

负责：
- Top-K 检索
- 权限控制（哪些 AI 能读哪些记忆）
- 按优先级排序
"""

from typing import List, Optional
from .types import MemoryEntry, MemoryScope, MemoryType, MemoryLevel, MemoryStage
from .manager import MemoryManager


class MemoryRetriever:
    """
    记忆检索器
    
    实现：
    1. Top-K 检索（防止过长）
    2. 权限控制（白名单）
    3. 按 scope 匹配优先级排序
    """
    
    # 权限控制：哪些 AI 能读哪些层级的记忆
    PERMISSIONS = {
        "GlobalIntentAI": [MemoryLevel.GLOBAL, MemoryLevel.APP],
        "ContextBuilderAI": [MemoryLevel.GLOBAL, MemoryLevel.APP, MemoryLevel.INTENT],
        "StrategyAI": [MemoryLevel.APP, MemoryLevel.INTENT],
        "SupervisorAI": [MemoryLevel.GLOBAL, MemoryLevel.APP, MemoryLevel.INTENT],
        "DecisionAI": [MemoryLevel.INTENT],  # 只读 Intent 层级的决策偏好
        "ExecutorAI": [],  # 禁止
        "PerceptionAI": [],  # 禁止
        "SummarizerAI": [],  # 建议不读
        "MemoryLearnerAI": [MemoryLevel.GLOBAL, MemoryLevel.APP, MemoryLevel.INTENT],  # 读全部
        "DialogAI": [MemoryLevel.GLOBAL],  # 对话 AI 读取用户画像
        "ConversationRouterAI": [MemoryLevel.GLOBAL],  # 路由 AI 读取用户画像
    }
    
    # Top-K 限制（每层最多取几条）
    TOP_K_LIMITS = {
        MemoryLevel.GLOBAL: 2,
        MemoryLevel.APP: 3,
        MemoryLevel.INTENT: 3
    }
    
    def __init__(self, manager: Optional[MemoryManager] = None):
        """
        初始化检索器
        
        Args:
            manager: 记忆管理器（默认使用单例）
        """
        self.manager = manager or MemoryManager()
    
    def retrieve(self, 
                 ai_name: str,
                 scope: MemoryScope,
                 memory_types: Optional[List[MemoryType]] = None,
                 min_stage: MemoryStage = MemoryStage.CANDIDATE) -> List[MemoryEntry]:
        """
        检索记忆（带权限控制和 Top-K）
        
        Args:
            ai_name: AI 名称（用于权限检查）
            scope: 查询的作用域
            memory_types: 记忆类型过滤（None 表示全部）
            min_stage: 最小成熟度（默认：候选偏好）
        
        Returns:
            记忆列表（按优先级排序）
        """
        # 1. 权限检查
        allowed_levels = self.PERMISSIONS.get(ai_name, [])
        if scope.level not in allowed_levels:
            print(f"⚠️ [MemoryRetriever] {ai_name} 无权读取 {scope.level.name} 层级记忆")
            return []
        
        # 2. 清理过期记忆
        self.manager.cleanup_expired()
        
        # 3. 获取所有记忆
        all_memories = self.manager.get_all()
        
        # 4. 过滤
        filtered = []
        for mem in all_memories:
            # 过滤层级
            if mem.scope.level not in allowed_levels:
                continue
            
            # 过滤成熟度
            if mem.stage.value < min_stage.value:
                continue
            
            # 过滤类型
            if memory_types and mem.type not in memory_types:
                continue
            
            # 检查是否匹配（或部分匹配）
            if self._partial_match(mem.scope, scope):
                filtered.append(mem)
        
        # 5. 按优先级排序
        sorted_memories = self._sort_by_priority(filtered, scope)
        
        # 6. Top-K 限制（分层限制）
        result = self._apply_top_k(sorted_memories, scope)
        
        print(f"✓ [MemoryRetriever] {ai_name} 检索到 {len(result)} 条记忆 (scope={scope.level.name})")
        
        return result
    
    def _partial_match(self, mem_scope: MemoryScope, query_scope: MemoryScope) -> bool:
        """部分匹配（允许更宽泛的匹配）"""
        # 如果查询的是 intent 级别
        if query_scope.level == MemoryLevel.INTENT:
            # 可以匹配 intent/app/global
            if mem_scope.level == MemoryLevel.INTENT:
                return mem_scope.app == query_scope.app and mem_scope.intent == query_scope.intent
            elif mem_scope.level == MemoryLevel.APP:
                return mem_scope.app == query_scope.app
            elif mem_scope.level == MemoryLevel.GLOBAL:
                return True
        
        # 如果查询的是 app 级别
        elif query_scope.level == MemoryLevel.APP:
            # 可以匹配 app/global
            if mem_scope.level == MemoryLevel.APP:
                return mem_scope.app == query_scope.app
            elif mem_scope.level == MemoryLevel.GLOBAL:
                return True
        
        # 如果查询的是 global 级别
        elif query_scope.level == MemoryLevel.GLOBAL:
            return mem_scope.level == MemoryLevel.GLOBAL
        
        return False
    
    def _sort_by_priority(self, memories: List[MemoryEntry], query_scope: MemoryScope) -> List[MemoryEntry]:
        """
        按优先级排序
        
        优先级：
        1. scope 匹配度（intent > app > global）
        2. 成熟度（rule > stable > candidate）
        3. 置信度
        4. 更新时间
        """
        def priority_key(mem: MemoryEntry):
            # scope 匹配分数
            scope_score = mem.scope.match_score(query_scope)
            
            # 成熟度分数
            stage_score = mem.stage.value / 4.0
            
            # 置信度
            confidence = mem.confidence
            
            # 时间分数（越新越好）
            time_score = mem.updated_at
            
            return (scope_score, stage_score, confidence, time_score)
        
        return sorted(memories, key=priority_key, reverse=True)
    
    def _apply_top_k(self, memories: List[MemoryEntry], query_scope: MemoryScope) -> List[MemoryEntry]:
        """
        应用 Top-K 限制（分层限制）
        
        按层级分别限制数量
        """
        result = []
        counts_by_level = {
            MemoryLevel.GLOBAL: 0,
            MemoryLevel.APP: 0,
            MemoryLevel.INTENT: 0
        }
        
        for mem in memories:
            level = mem.scope.level
            limit = self.TOP_K_LIMITS.get(level, 3)
            
            if counts_by_level[level] < limit:
                result.append(mem)
                counts_by_level[level] += 1
        
        return result
    
    def retrieve_decision_preferences(self, 
                                     ai_name: str, 
                                     scope: MemoryScope,
                                     min_stage: MemoryStage = MemoryStage.CANDIDATE) -> List[MemoryEntry]:
        """检索决策偏好（专用于 DecisionAI）"""
        return self.retrieve(
            ai_name=ai_name,
            scope=scope,
            memory_types=[MemoryType.DECISION_PREFERENCE, MemoryType.NEGATIVE_PREFERENCE],
            min_stage=min_stage
        )
    
    def retrieve_strategy_templates(self, 
                                    ai_name: str, 
                                    scope: MemoryScope,
                                    min_stage: MemoryStage = MemoryStage.CANDIDATE) -> List[MemoryEntry]:
        """检索策略模板（专用于 StrategyAI）"""
        return self.retrieve(
            ai_name=ai_name,
            scope=scope,
            memory_types=[MemoryType.STRATEGY_TEMPLATE],
            min_stage=min_stage
        )
    
    def retrieve_user_profile(self, 
                             ai_name: str,
                             min_stage: MemoryStage = MemoryStage.OBSERVATION) -> List[MemoryEntry]:
        """检索用户画像（L0 专用）"""
        global_scope = MemoryScope(level=MemoryLevel.GLOBAL)
        return self.retrieve(
            ai_name=ai_name,
            scope=global_scope,
            memory_types=[MemoryType.USER_PROFILE],
            min_stage=min_stage
        )
    
    def retrieve_user_profiles(self, 
                              ai_name: str, 
                              scope: MemoryScope,
                              min_stage: MemoryStage = MemoryStage.OBSERVATION) -> List[MemoryEntry]:
        """检索用户画像（支持不同 scope）"""
        return self.retrieve(
            ai_name=ai_name,
            scope=scope,
            memory_types=[MemoryType.USER_PROFILE],
            min_stage=min_stage
        )

