#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
记忆管理器

负责：
- 记忆的增删改查
- TTL 过期管理
- 合并同类记忆
- 升级成熟度
"""

import os
import json
import hashlib
from typing import Dict, Any, List, Optional
from pathlib import Path
from .types import MemoryEntry, MemoryScope, MemoryType, MemoryLevel, MemoryStage


class MemoryManager:
    """
    记忆管理器（单例模式）
    
    功能：
    1. 增删改查记忆
    2. 自动过期清理
    3. 合并同类记忆
    4. 升级成熟度
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, storage_dir: str = "memory_storage"):
        """
        初始化记忆管理器
        
        Args:
            storage_dir: 存储目录
        """
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        
        # 存储路径
        project_root = Path(__file__).parent.parent.parent
        self.storage_dir = project_root / storage_dir
        self.storage_dir.mkdir(exist_ok=True)
        
        # 分层存储
        self.l0_file = self.storage_dir / "l0_global.json"
        self.l1_file = self.storage_dir / "l1_app.json"
        self.l2_file = self.storage_dir / "l2_intent.json"
        
        # 内存缓存
        self._memories: Dict[str, MemoryEntry] = {}
        
        # 加载现有记忆
        self._load_all()
    
    def _load_all(self):
        """加载所有记忆"""
        for file_path in [self.l0_file, self.l1_file, self.l2_file]:
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    
                    for entry_data in data:
                        entry = MemoryEntry.from_dict(entry_data)
                        self._memories[entry.id] = entry
                
                except Exception as e:
                    print(f"⚠️ [MemoryManager] 加载记忆失败: {file_path}, {e}")
        
        print(f"✓ [MemoryManager] 已加载 {len(self._memories)} 条记忆")
    
    def _save_all(self):
        """保存所有记忆（分层存储）"""
        l0_memories = []
        l1_memories = []
        l2_memories = []
        
        for entry in self._memories.values():
            if entry.scope.level == MemoryLevel.GLOBAL:
                l0_memories.append(entry.to_dict())
            elif entry.scope.level == MemoryLevel.APP:
                l1_memories.append(entry.to_dict())
            elif entry.scope.level == MemoryLevel.INTENT:
                l2_memories.append(entry.to_dict())
        
        # 保存到文件
        try:
            with open(self.l0_file, 'w', encoding='utf-8') as f:
                json.dump(l0_memories, f, ensure_ascii=False, indent=2)
            
            with open(self.l1_file, 'w', encoding='utf-8') as f:
                json.dump(l1_memories, f, ensure_ascii=False, indent=2)
            
            with open(self.l2_file, 'w', encoding='utf-8') as f:
                json.dump(l2_memories, f, ensure_ascii=False, indent=2)
        
        except Exception as e:
            print(f"⚠️ [MemoryManager] 保存记忆失败: {e}")
    
    def add_or_update(self, entry: MemoryEntry) -> str:
        """
        添加或更新记忆
        
        自动处理：
        1. 合并同类记忆
        2. 升级成熟度
        3. 更新置信度
        
        Args:
            entry: 记忆条目
        
        Returns:
            记忆 ID
        """
        # 查找是否有相同的记忆
        existing_id = self._find_similar(entry)
        
        if existing_id:
            # 合并
            existing = self._memories[existing_id]
            existing.refresh()
            existing.confidence = max(existing.confidence, entry.confidence)
            
            # 合并 signals
            for key, value in entry.signals.items():
                existing.signals[key] = value
            
            # 升级成熟度
            existing.upgrade_stage()
            
            print(f"✓ [MemoryManager] 合并记忆: {existing_id} (count={existing.count}, stage={existing.stage.name})")
            
            # 保存
            self._save_all()
            
            return existing_id
        else:
            # 新增
            self._memories[entry.id] = entry
            
            print(f"✓ [MemoryManager] 新增记忆: {entry.id} (type={entry.type.name}, scope={entry.scope.level.name})")
            
            # 保存
            self._save_all()
            
            return entry.id
    
    def _find_similar(self, entry: MemoryEntry) -> Optional[str]:
        """查找相似记忆（用于合并）"""
        for mem_id, mem in self._memories.items():
            # 相同类型、相同作用域
            if mem.type == entry.type and mem.scope.matches(entry.scope):
                # 检查 signals 是否相似
                if self._signals_similar(mem.signals, entry.signals):
                    return mem_id
        
        return None
    
    def _signals_similar(self, signals1: Dict, signals2: Dict, threshold: float = 0.8) -> bool:
        """判断两个 signals 是否相似"""
        # 简单判断：如果有共同的 key，就认为相似
        common_keys = set(signals1.keys()) & set(signals2.keys())
        
        if not common_keys:
            return False
        
        # 至少有 80% 的 key 相同
        similarity = len(common_keys) / max(len(signals1), len(signals2))
        return similarity >= threshold
    
    def get(self, memory_id: str) -> Optional[MemoryEntry]:
        """获取记忆"""
        return self._memories.get(memory_id)
    
    def delete(self, memory_id: str):
        """删除记忆"""
        if memory_id in self._memories:
            del self._memories[memory_id]
            self._save_all()
            print(f"✓ [MemoryManager] 删除记忆: {memory_id}")
    
    def cleanup_expired(self) -> int:
        """清理过期记忆"""
        expired_ids = []
        
        for mem_id, mem in self._memories.items():
            if mem.is_expired():
                expired_ids.append(mem_id)
        
        for mem_id in expired_ids:
            del self._memories[mem_id]
        
        if expired_ids:
            self._save_all()
            print(f"✓ [MemoryManager] 清理了 {len(expired_ids)} 条过期记忆")
        
        return len(expired_ids)
    
    def get_all(self) -> List[MemoryEntry]:
        """获取所有记忆"""
        return list(self._memories.values())
    
    def get_by_scope(self, scope: MemoryScope) -> List[MemoryEntry]:
        """根据作用域获取记忆"""
        return [
            mem for mem in self._memories.values()
            if mem.scope.matches(scope)
        ]
    
    def get_by_type(self, memory_type: MemoryType) -> List[MemoryEntry]:
        """根据类型获取记忆"""
        return [
            mem for mem in self._memories.values()
            if mem.type == memory_type
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        stats = {
            "total": len(self._memories),
            "by_level": {
                "global": 0,
                "app": 0,
                "intent": 0
            },
            "by_type": {},
            "by_stage": {
                "observation": 0,
                "candidate": 0,
                "stable": 0,
                "rule": 0
            }
        }
        
        for mem in self._memories.values():
            # 按层级统计
            stats["by_level"][mem.scope.level.value] += 1
            
            # 按类型统计
            type_name = mem.type.value
            stats["by_type"][type_name] = stats["by_type"].get(type_name, 0) + 1
            
            # 按成熟度统计
            stats["by_stage"][mem.stage.name.lower()] += 1
        
        return stats
    
    @staticmethod
    def generate_id(type_name: str, scope: MemoryScope, signals: Dict) -> str:
        """生成记忆 ID"""
        # 基于类型、作用域和 signals 生成唯一 ID
        content = f"{type_name}_{scope.to_dict()}_{signals}"
        hash_obj = hashlib.md5(content.encode('utf-8'))
        return hash_obj.hexdigest()[:16]

