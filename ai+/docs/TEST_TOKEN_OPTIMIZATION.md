# Token 优化测试指南

## 测试目标

验证决策模式配置能够有效降低 token 消耗，同时保持任务执行的正确性和安全性。

## 测试场景

### 场景 1：简单任务（点赞视频）

**任务描述：** 点赞前 20 个包含关键词"美食"的视频

**预期配置：**
```json
{
  "decision_mode": {
    "supervisor_frequency": "anomaly_only",
    "supervisor_check_interval": 5,
    "decision_cache_size": 5,
    "reasoning": "简单任务，流程固定（next→getVideoInfo→analyze→digg），可以批量规划"
  }
}
```

**预期行为：**
1. StrategyAI 生成上述配置
2. DecisionAI 每次规划 5 步：
   - next → getVideoInfo → analyze → digg → next
3. SupervisorAI 只在检测到异常时运行（如连续失败）
4. 正常情况下，20 个视频只需要调用 DecisionAI 约 4 次

**预期 Token 消耗：**
- SupervisorAI：约 1-2 次（只在异常时）
- DecisionAI：约 4 次（每次规划 5 步）
- 总 token 消耗：**预计比优化前降低 70-80%**

**验证点：**
- [ ] StrategyAI 输出包含 `decision_mode` 字段
- [ ] DecisionAI 输出批量决策（`decisions` 数组）
- [ ] SupervisorAI 调用次数显著减少
- [ ] 任务成功完成，点赞了 20 个匹配的视频
- [ ] 日志中显示"📦 批量规划 N 步"
- [ ] 日志中显示"⏭️ 跳过监督检查"

---

### 场景 2：中等任务（评论互动）

**任务描述：** 对前 10 个匹配的视频发送评论

**预期配置：**
```json
{
  "decision_mode": {
    "supervisor_frequency": "every_n_steps",
    "supervisor_check_interval": 3,
    "decision_cache_size": 2,
    "reasoning": "评论任务需要更多监督，但可以小批量规划（getComments→analyze→sendComment）"
  }
}
```

**预期行为：**
1. DecisionAI 每次规划 2 步
2. SupervisorAI 每 3 步检查一次
3. 如果遇到异常（如评论失败），清空缓存并重新规划

**预期 Token 消耗：**
- SupervisorAI：约 10-15 次（每 3 步检查）
- DecisionAI：约 15-20 次（每次规划 2 步）
- 总 token 消耗：**预计比优化前降低 30-40%**

**验证点：**
- [ ] SupervisorAI 每 3 步运行一次
- [ ] DecisionAI 批量规划 2 步
- [ ] 遇到错误时清空缓存
- [ ] 任务成功完成

---

### 场景 3：复杂任务（动态调整策略）

**任务描述：** 根据视频质量动态决定是否点赞或评论

**预期配置：**
```json
{
  "decision_mode": {
    "supervisor_frequency": "always",
    "supervisor_check_interval": 1,
    "decision_cache_size": 1,
    "reasoning": "复杂任务，需要根据感知结果动态决策，不适合批量规划"
  }
}
```

**预期行为：**
1. DecisionAI 每次只规划 1 步（单步决策）
2. SupervisorAI 每步都运行
3. 根据 PerceptionAI 的结果动态调整行为

**预期 Token 消耗：**
- SupervisorAI：每步都运行
- DecisionAI：每步都运行
- 总 token 消耗：**与优化前相近，但不会增加**

**验证点：**
- [ ] SupervisorAI 每步都运行
- [ ] DecisionAI 输出单步决策（非批量）
- [ ] 根据感知结果动态调整行为
- [ ] 任务成功完成

---

## 测试步骤

### 1. 准备环境

```bash
cd ai+
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. 运行测试（场景 1）

```bash
# 启动 API 服务器
python api_server.py

# 在另一个终端，运行 Electron 客户端
cd apps/desktop
npm run dev

# 在 AI 对话窗口输入：
# "帮我点赞前 20 个关于美食的视频"
```

### 3. 观察日志

**关键日志标识：**

```
[StrategyAI] 策略参数生成完成
  • decision_mode: {...}

[DecisionAI] 📦 批量规划 5 步
            理由: 这是一个标准的视频处理流程

[DecisionAI] 📦 使用缓存决策 (2/5)

[SupervisorAI] ⏭️ 跳过监督检查（根据策略配置）
```

### 4. 检查 Token 消耗

查看日志文件：`ai+/logs/task_<task_id>.json`

统计：
```python
import json

with open('logs/task_xxx.json') as f:
    logs = json.load(f)

supervisor_count = sum(1 for log in logs if log['agent'] == 'SupervisorAI')
decision_count = sum(1 for log in logs if log['agent'] == 'DecisionAI')

print(f"SupervisorAI 调用次数: {supervisor_count}")
print(f"DecisionAI 调用次数: {decision_count}")
```

### 5. 对比优化前后

| 指标 | 优化前 | 优化后（场景1） | 节省 |
|------|--------|----------------|------|
| SupervisorAI 调用 | 100 次 | ~5 次 | 95% |
| DecisionAI 调用 | 100 次 | ~20 次 | 80% |
| 总 Token 消耗 | 650k | ~150k | 77% |

---

## 异常测试

### 测试 1：遇到连续失败

**操作：** 模拟 3 次连续失败（如网络错误）

**预期行为：**
1. Runtime 检测到 `consecutive_failures >= 3`
2. SupervisorAI 被触发（即使是 `anomaly_only` 模式）
3. 决策缓存被清空
4. InteractionGateAI 被触发，请求用户干预

**验证点：**
- [ ] 异常被正确检测
- [ ] SupervisorAI 被触发
- [ ] 缓存被清空
- [ ] 用户收到交互请求

### 测试 2：遇到错误

**操作：** 模拟执行错误（如 action 不存在）

**预期行为：**
1. 执行失败，抛出异常
2. 决策缓存被清空
3. 下一步重新调用 DecisionAI

**验证点：**
- [ ] 错误被捕获
- [ ] 缓存被清空
- [ ] 系统恢复正常

---

## 性能基准

### 目标

- **简单任务**：token 消耗降低 70-80%
- **中等任务**：token 消耗降低 30-40%
- **复杂任务**：token 消耗不增加

### 实际测试结果

| 任务类型 | 优化前 Token | 优化后 Token | 节省比例 | 状态 |
|---------|-------------|-------------|---------|------|
| 点赞 20 个视频 | 650k | ? | ? | ⏳ 待测试 |
| 评论 10 个视频 | ? | ? | ? | ⏳ 待测试 |
| 动态互动 | ? | ? | ? | ⏳ 待测试 |

---

## 注意事项

1. **批量决策的限制**：
   - 只在流程清晰、稳定的情况下使用
   - 如果遇到不确定性（如需要根据感知结果决定下一步），不要批量规划

2. **监督频率的选择**：
   - `anomaly_only`：适合简单、低风险任务
   - `every_n_steps`：适合中等复杂度任务
   - `always`：适合复杂、高风险任务

3. **异常处理**：
   - 即使使用 `anomaly_only` 模式，Runtime 仍然会检测异常
   - 遇到异常时，立即清空缓存并触发监督

4. **通用性**：
   - 所有配置都由 StrategyAI 根据任务特征动态生成
   - 不需要为不同的 app 或任务硬编码配置

---

## 总结

通过决策模式配置，我们实现了：
- ✅ **大幅降低 token 消耗**（预计 30-80%）
- ✅ **保持系统通用性**（不硬编码任何 app 特定逻辑）
- ✅ **灵活适应不同任务**（简单任务省 token，复杂任务保安全）
- ✅ **安全性不降低**（异常检测、人机交互不受影响）

现在可以开始测试了！🚀

