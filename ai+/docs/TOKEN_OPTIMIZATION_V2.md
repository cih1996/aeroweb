# Token 优化方案 V2：决策模式配置

## 问题描述

现有的任务 AI 每执行 1 步任务就需要运行一连串的 AI 检查：
1. **SupervisorAI**：风控检查（每步都运行）
2. **DecisionAI**：决策下一步动作（每步都运行）
3. **ExecutorAI**：生成执行计划
4. **PerceptionAI**：感知和判断（如果需要）

这导致了极高的 token 消耗。例如，一个简单的点赞任务消耗了 65w tokens，其中 DecisionAI 的输入 token 就达到了 580k（7次调用）。

## 核心原因

- **SupervisorAI 过度检查**：即使任务流程稳定，每步都运行 SupervisorAI
- **DecisionAI 重复规划**：每步都重新规划，即使流程是可预测的（如：next → getVideoInfo → analyze → digg → next）
- **大量上下文传递**：每次调用都传递完整的 runtime state、progress、perception 等信息

## 解决方案：决策模式配置

通过 **StrategyAI** 根据任务复杂度和风险等级，动态配置决策频率和批量大小，从而大幅降低 token 消耗。

### 1. StrategyAI 输出决策模式

在 `strategy.prompt` 中新增 `decision_mode` 字段：

```json
{
  "decision_mode": {
    "supervisor_frequency": "always | every_n_steps | anomaly_only",
    "supervisor_check_interval": 3,
    "decision_cache_size": 1,
    "reasoning": "决策频率选择理由"
  }
}
```

**字段说明：**

- **supervisor_frequency**：SupervisorAI 运行频率
  - `always`：每步都检查（默认，最安全但 token 消耗最高）
  - `every_n_steps`：每 N 步检查一次（适合稳定流程任务）
  - `anomaly_only`：只在检测到异常时检查（最省 token，适合简单任务）

- **supervisor_check_interval**：当 `supervisor_frequency` 为 `every_n_steps` 时，N 的值（默认 3）

- **decision_cache_size**：DecisionAI 一次生成多少步决策（默认 1，可设置为 3-5 来批量规划）

- **reasoning**：为什么选择这个决策频率

### 2. Runtime 支持决策缓存

在 `runtime.py` 中新增：

```python
# 决策缓存（用于批量决策）
self.decision_cache = []  # 缓存的决策列表
self.decision_cache_index = 0  # 当前执行到第几个决策
self.steps_since_supervisor = 0  # 距离上次 Supervisor 检查的步数

def should_run_supervisor(self) -> bool:
    """判断是否应该运行 SupervisorAI"""
    # 根据 decision_mode 配置决定

def get_cached_decision(self) -> Optional[Dict]:
    """从缓存中获取下一个决策"""

def set_decision_cache(self, decisions: List[Dict]):
    """设置决策缓存"""

def clear_decision_cache(self):
    """清空决策缓存（遇到错误或异常时）"""
```

### 3. DecisionAI 支持批量决策

在 `decision.prompt` 中新增批量决策格式：

**单步决策（batch_size=1）：**
```json
{
  "action_type": "navigate",
  "action": "next",
  "params": [],
  "reason": "决策理由"
}
```

**批量决策（batch_size>1）：**
```json
{
  "decisions": [
    {
      "action_type": "navigate",
      "action": "next",
      "params": [],
      "reason": "获取下一个视频"
    },
    {
      "action_type": "read",
      "action": "getVideoInfo",
      "params": [],
      "reason": "读取视频信息"
    },
    {
      "action_type": "analyze",
      "action": "analyze",
      "params": [],
      "reason": "分析是否匹配"
    }
  ],
  "plan_reasoning": "这是一个标准的视频处理流程，可以连续执行"
}
```

### 4. Orchestrator 集成

在 `orchestrator.py` 的 `_execute_step` 中：

1. **条件监督**：根据 `runtime.should_run_supervisor()` 决定是否运行 SupervisorAI
2. **决策缓存**：优先从 `runtime.get_cached_decision()` 获取决策
3. **批量规划**：如果缓存为空，调用 DecisionAI 生成新决策（可能是批量）
4. **异常清空**：遇到错误或异常时，清空决策缓存

## 效果预估

### 简单任务（例：点赞前100个包含关键词的视频）

**配置：**
```json
{
  "decision_mode": {
    "supervisor_frequency": "anomaly_only",
    "supervisor_check_interval": 5,
    "decision_cache_size": 5,
    "reasoning": "简单任务，流程固定，可以批量规划并减少监督"
  }
}
```

**优化效果：**
- SupervisorAI 调用次数：100 次 → **约 5 次**（只在异常时）
- DecisionAI 调用次数：100 次 → **20 次**（每次规划 5 步）
- **预计 token 节省：70-80%**

### 复杂任务（例：评论互动，需要根据内容动态调整）

**配置：**
```json
{
  "decision_mode": {
    "supervisor_frequency": "every_n_steps",
    "supervisor_check_interval": 3,
    "decision_cache_size": 1,
    "reasoning": "复杂任务，需要频繁监督和动态决策"
  }
}
```

**优化效果：**
- SupervisorAI 调用次数：100 次 → **33 次**（每 3 步检查一次）
- DecisionAI 调用次数：100 次 → **100 次**（保持单步决策）
- **预计 token 节省：30-40%**

## 安全性保障

1. **异常检测**：即使使用 `anomaly_only` 模式，Runtime 仍然会检测异常（连续失败、进度停滞等）
2. **缓存清空**：遇到错误或异常时，立即清空决策缓存，重新规划
3. **人机交互**：InteractionGateAI 不受影响，仍然会在需要时触发
4. **灵活配置**：StrategyAI 会根据任务复杂度和风险等级动态选择模式

## 实现清单

- [x] 修改 `strategy.prompt`：新增 `decision_mode` 字段
- [x] 修改 `runtime.py`：新增决策缓存和条件监督方法
- [x] 修改 `decision.prompt`：支持批量决策格式
- [x] 修改 `decision.py`：支持 `batch_size` 参数
- [x] 修改 `orchestrator.py`：集成条件监督和决策缓存

## 使用示例

StrategyAI 会自动根据任务复杂度选择合适的模式：

```python
# 简单任务（点赞、收藏）
strategy_params = {
  "decision_mode": {
    "supervisor_frequency": "anomaly_only",
    "decision_cache_size": 5
  }
}

# 中等任务（评论、分享）
strategy_params = {
  "decision_mode": {
    "supervisor_frequency": "every_n_steps",
    "supervisor_check_interval": 3,
    "decision_cache_size": 2
  }
}

# 复杂任务（动态调整策略）
strategy_params = {
  "decision_mode": {
    "supervisor_frequency": "always",
    "decision_cache_size": 1
  }
}
```

## 注意事项

1. **批量决策适用场景**：只在流程清晰、稳定的情况下使用（如标准的视频处理流程）
2. **不适用场景**：如果需要根据感知结果动态决定下一步，不要批量规划
3. **监督频率**：`anomaly_only` 模式适合简单任务，复杂任务建议使用 `every_n_steps` 或 `always`
4. **通用性**：所有配置都由 StrategyAI 根据任务特征动态生成，不需要硬编码

## 总结

通过决策模式配置，我们实现了：
- ✅ **大幅降低 token 消耗**（预计 30-80%）
- ✅ **保持系统通用性**（不硬编码任何 app 特定逻辑）
- ✅ **灵活适应不同任务**（简单任务省 token，复杂任务保安全）
- ✅ **安全性不降低**（异常检测、人机交互不受影响）

