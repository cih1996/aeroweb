#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
AI 辅助函数
"""

import json
from typing import Dict, Any


def parse_ai_response(content: str) -> Dict[str, Any]:
    """
    解析 AI 返回的内容，提取 JSON
    
    Args:
        content: AI 返回的原始内容
    
    Returns:
        解析后的 JSON 字典
    """
    try:
        content = content.strip()
        
        # 提取 JSON（可能包含在 markdown 代码块中）
        if "```json" in content:
            start = content.find("```json") + 7
            end = content.find("```", start)
            content = content[start:end].strip()
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            content = content[start:end].strip()
        
        return json.loads(content)
    except json.JSONDecodeError as e:
        print(f"⚠️ JSON 解析失败: {e}")
        print(f"原始内容: {content[:200]}...")
        return {"error": "JSON解析失败", "raw_content": content}

