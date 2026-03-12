# Agent Prompts 说明文档

## 📋 概述

本目录包含 10 个 AI Agent 的提示词文件，每个文件定义了一个 AI 组件的职责、输入输出格式和行为规则。

## 🗂️ 文件列表

| 文件名 | AI 组件 | 职责 | 历史上下文 |
|--------|---------|------|-----------|
| `global_intent.prompt` | GlobalIntentAI | 全局意图识别 | ✅ 需要（跨任务） |
| `context_builder.prompt` | ContextBuilderAI | 任务上下文构建 | ⚠️ 部分（仅初始化） |
| `strategy.prompt` | StrategyAI | 策略参数生成 | ⚠️ 部分（跨任务只读） |
| `decision.prompt` | DecisionAI | 动态决策（新增） | ❌ 不需要（每次独立） |
| `executor.prompt` | ExecutorAI | 执行计划生成 | ❌ 不需要（纯函数） |
| `perception.prompt` | PerceptionAI | 感知判断 | ❌ 不需要（纯函数） |
| `supervisor.prompt` | SupervisorAI | 风控监督 | ❌ 不需要（当前状态） |
| `interaction_gate.prompt` | InteractionGateAI | 人机交互确认（新增） | ❌ 不需要（条件触发） |
| `summarizer.prompt` | SummarizerAI | 任务总结 | ⚠️ 仅任务内摘要 |
| `memory_learner.prompt` | MemoryLearnerAI | 策略学习与记忆 | ✅ 需要（跨任务） |

## 🎯 优化重点

### 1. DecisionAI（新增，核心优化）

**问题：** 原来的决策逻辑写死在 `TaskRuntime.decide_next_action()` 中，无法灵活应对不同场景。

**解决方案：**
- 新增 `decision.prompt` 文件
- 支持动态决策，根据当前状态、感知结果、策略参数智能选择动作
- 输出更丰富的信息：`confidence`（置信度）、`alternative_action`（备选动作）

**输出格式（灵活）：**
```json
{
  "action_type": "navigate | read | engage | analyze | control",
  "action": "具体动作名称",
  "params": [],
  "reason": "决策理由",
  "wait_seconds": 0,
  "confidence": 0.0-1.0,
  "alternative_action": "备选动作"
}
```

### 2. GlobalIntentAI（大幅增强）

**新增字段：**
- `keywords`: 关键词列表
- `quantity`: 数量要求（target, type）
- `quality_criteria`: 质量要求
- `interaction_type`: 互动类型
- `constraints`: 约束条件
- `priority`: 任务优先级

**示例：**
```json
{
  "intents": [{
    "app": "douyin",
    "intent": "explore",
    "goal": "找5个关于AI技术的优质视频",
    "keywords": ["AI", "技术", "教程"],
    "quantity": {"target": 5, "type": "matched"},
    "quality_criteria": "高质量、专业",
    "interaction_type": ["like"],
    "confidence": 0.9,
    "priority": 1
  }]
}
```

### 3. ContextBuilderAI（增强匹配标准）

**新增字段：**
- `match_criteria`: 详细的匹配标准
  - `required_keywords`: 必须包含的关键词
  - `optional_keywords`: 可选关键词
  - `excluded_keywords`: 排除关键词
  - `quality_indicators`: 质量指标
  - `content_type`: 内容类型偏好
- `task_complexity`: 任务复杂度
- `estimated_difficulty`: 难度评估

**作用：** 为 PerceptionAI 提供明确的判断依据。

### 4. StrategyAI（参数丰富化）

**新增参数组：**
- `info_collection`: 信息收集策略
  - `always_read_comments`: 是否总是读取评论
  - `max_comment_pages`: 最大评论页数
  - `skip_if_clear`: 信息明确时是否跳过
- `risk_control`: 风控策略
  - `min_action_interval`: 最小动作间隔
  - `max_actions_per_minute`: 最大频率
  - `randomize_delay`: 是否随机延迟
- `efficiency`: 效率策略
  - `quick_reject`: 快速拒绝
  - `batch_size`: 批处理大小
- `adaptation`: 自适应策略
  - `allow_dynamic_adjustment`: 允许动态调整
  - `match_score_step`: 调整步长

**示例：**
```json
{
  "min_match_score": 0.6,
  "preferred_engagement_action": "like",
  "info_collection": {
    "always_read_comments": false,
    "max_comment_pages": 1,
    "skip_if_clear": true
  },
  "risk_control": {
    "min_action_interval": 1.5,
    "max_actions_per_minute": 8,
    "randomize_delay": true
  },
  "adaptation": {
    "allow_dynamic_adjustment": true,
    "match_score_step": 0.1
  }
}
```

### 5. PerceptionAI（全面优化）

**新增判断维度：**
1. 内容相关性（40%）
2. 质量评估（35%）
3. 作者可信度（15%）
4. 新鲜度/时效性（10%）

**新增字段：**
- `match_reasons`: 匹配原因列表（具体、可验证）
- `mismatch_reasons`: 不匹配原因
- `quality_assessment`: 多维度质量评估
  - `relevance`: 相关性分数
  - `quality`: 质量分数
  - `credibility`: 可信度分数
  - `freshness`: 新鲜度分数
- `key_findings`: 关键发现
- `quick_reject_reason`: 快速拒绝理由

**示例：**
```json
{
  "match_score": 0.85,
  "should_proceed": true,
  "confidence": 0.9,
  "match_reasons": [
    "标题包含关键词'AI'和'技术'",
    "标签完全匹配：AI、技术、教程",
    "点赞数2300，高于平均水平"
  ],
  "quality_assessment": {
    "overall": "high",
    "relevance": 0.9,
    "quality": 0.85,
    "credibility": 0.8,
    "freshness": 0.75
  },
  "key_findings": [
    "专业AI研究员发布",
    "内容深度适中",
    "评论质量较高"
  ]
}
```

### 6. ExecutorAI（标准化输出）

**新增字段：**
- `execution_context`: 执行上下文
  - `timestamp`: 时间戳
  - `retry_count`: 重试次数
  - `expected_result`: 预期结果
- `validation`: 参数验证
  - `params_valid`: 参数是否合法
  - `ready_to_execute`: 是否准备执行
  - `warnings`: 警告信息

**作用：** 提供更详细的执行信息，便于调试和日志记录。

### 7. SupervisorAI（全面监控）

**监督维度扩展：**
1. 频率监控
2. 错误监控
3. 状态监控
4. 资源监控
5. 平台风控

**新增字段：**
- `severity`: 严重程度（low/medium/high）
- `risk_indicators`: 风险指标列表
- `recommendations`: 后续建议
- `metrics_snapshot`: 指标快照

**示例：**
```json
{
  "control": "SLEEP",
  "duration_seconds": 3,
  "reason": "操作频率接近上限（8次/分钟，限制10次/分钟）",
  "severity": "medium",
  "risk_indicators": [
    "操作频率达到80%阈值",
    "距上次动作仅0.5秒"
  ],
  "recommendations": [
    "建议降低频率至6次/分钟",
    "增加随机延迟"
  ],
  "metrics_snapshot": {
    "current_frequency": "8次/分钟",
    "time_since_last_action": "0.5秒",
    "error_rate": "0%"
  }
}
```

### 8. SummarizerAI（结构化总结）

**新增字段：**
- `completion`: 完成情况
  - `target`: 目标
  - `achieved`: 实际完成
  - `completion_rate`: 完成率
- `quality_metrics`: 质量指标
  - `average_match_score`: 平均匹配分数
  - `match_score_distribution`: 分数分布
  - `content_quality`: 内容质量
- `efficiency_metrics`: 效率指标
  - `objects_per_minute`: 处理速度
  - `match_rate`: 匹配率
  - `time_to_first_match`: 首次匹配用时
- `successful_patterns`: 成功模式
- `failed_patterns`: 失败模式
- `recommendations`: 改进建议
- `notable_finds`: 意外发现

**作用：** 提供全面的任务总结，为学习和优化提供数据支持。

### 9. MemoryLearnerAI（深度学习）

**新增字段：**
- `task_signature`: 任务签名（扩展）
  - 新增 `keywords`, `scenario` 字段
- `strategy_snapshot`: 策略快照
  - `effective_params`: 有效参数
  - `ineffective_params`: 无效参数
  - `recommended_adjustments`: 推荐调整
- `success_patterns`: 成功模式（结构化）
  - `pattern`: 模式描述
  - `conditions`: 条件列表
  - `effectiveness`: 有效性分数
- `failure_patterns`: 失败模式（结构化）
  - `pattern`: 模式描述
  - `causes`: 可能原因
  - `avoidance`: 避免方法
- `user_preference_updates`: 用户偏好更新
  - `quality_standard`: 质量标准
  - `interaction_style`: 互动风格
  - `content_preferences`: 内容偏好
  - `time_sensitivity`: 时间敏感度
- `confidence_factors`: 置信度影响因素
- `applicability`: 适用性
  - `similar_tasks`: 适用任务
  - `limitations`: 局限性
- `priority`: 优先级（high/medium/low）

**作用：** 更精准的学习和策略优化。

### 10. InteractionGateAI（新增）

**完整字段：**
```json
{
  "situation": "当前情况描述",
  "details": "详细说明",
  "data_summary": {
    "objects_processed": 8,
    "objects_matched": 0,
    "time_elapsed": "01:05",
    "match_rate": "0%",
    "last_action": "getComments"
  },
  "options": [
    {
      "id": "continue",
      "label": "继续执行",
      "description": "维持当前策略继续",
      "impact": "预期效果"
    }
  ],
  "recommend_stop": false,
  "severity": "low | medium | high",
  "next_check_in": "30秒后"
}
```

**特点：**
- 友好的用户交互
- 根据 anomaly_type 定制化选项
- 考虑任务上下文和用户偏好
- 提供多种调整方向

## 📊 输出格式对比

### 优化前（固定）
```json
{
  "action": "next",
  "params": []
}
```

### 优化后（灵活）
```json
{
  "action_type": "navigate",
  "action": "next",
  "params": [],
  "reason": "当前视频匹配度低（0.3），跳过并继续",
  "wait_seconds": 1,
  "confidence": 0.85,
  "alternative_action": "getComments"
}
```

## 🎯 核心优化原则

### 1. 灵活性优先
- 不写死决策规则
- 支持动态调整
- 根据实际情况适应

### 2. 可解释性
- 每个决策都有 `reason`
- 每个判断都有 `match_reasons`
- 便于调试和优化

### 3. 结构化输出
- 统一 JSON 格式
- 字段命名清晰
- 易于解析和处理

### 4. 数据驱动
- 基于实际数据判断
- 不猜测未知信息
- 诚实反映不确定性（confidence）

### 5. 用户中心
- 语言通俗易懂
- 提供友好的交互
- 考虑用户偏好

## 🔧 使用方式

### 代码中的使用（已优化）

```python
# 所有 prompt 从文件加载
PROMPT_FILES = {
    "global_intent": "global_intent.prompt",
    "context_builder": "context_builder.prompt",
    "strategy": "strategy.prompt",
    "decision": "decision.prompt",
    "executor": "executor.prompt",
    "perception": "perception.prompt",
    "supervisor": "supervisor.prompt",
    "summarizer": "summarizer.prompt",
    "memory_learner": "memory_learner.prompt",
    "interaction_gate": "interaction_gate.prompt"
}

# 调用示例
result = GlobalIntentAI.run(
    user_message="帮我找5个关于AI的视频",
    session_memory={},
    user_profile={}
)
```

### 修改 Prompt

直接编辑对应的 `.prompt` 文件，无需修改代码。

## 📈 后续优化方向

### 短期
- [ ] 增加更多示例（examples）到 prompt 中
- [ ] 优化 JSON Schema 验证
- [ ] 添加 prompt 版本控制

### 中期
- [ ] 支持多语言 prompt
- [ ] A/B 测试不同 prompt 版本
- [ ] 自动优化 prompt（基于效果反馈）

### 长期
- [ ] Prompt 工程工具链
- [ ] 可视化 prompt 编辑器
- [ ] 社区共享 prompt 库

## 🐛 常见问题

### Q1: 为什么有些 AI 不需要历史上下文？
**A:** ExecutorAI、PerceptionAI、SupervisorAI 是"纯函数"，输入相同则输出相同，不应该受历史影响。这保证了可预测性和可重复性。

### Q2: DecisionAI 和 ExecutorAI 的区别？
**A:** 
- **DecisionAI**: 决定"做什么"（决策层）
- **ExecutorAI**: 规范"怎么做"（执行层）

### Q3: 如何调试 Prompt？
**A:** 
1. 查看 AI 的输出（特别是 `reason`、`match_reasons` 等字段）
2. 检查 `logs/` 目录下的日志文件
3. 调整 `temperature` 参数（0.3=保守，0.7=创造性）

### Q4: 可以混合使用文件 Prompt 和内联 Prompt 吗？
**A:** 可以，但不推荐。统一使用文件 Prompt 便于维护。

## 📚 相关文档

- [OPTIMIZATION_NOTES.md](../../OPTIMIZATION_NOTES.md) - 系统优化说明
- [INTERACTION_GATE_GUIDE.md](../../INTERACTION_GATE_GUIDE.md) - 人机交互指南
- [newTest.py](../../newTest.py) - 完整实现代码

---

**最后更新：** 2025-12-27
**维护者：** AI Agent System Team

