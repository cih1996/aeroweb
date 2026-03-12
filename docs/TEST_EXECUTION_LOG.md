# 测试执行日志功能

## 快速测试

### 1. 启动系统

```bash
# 终端 1: 启动 AI Agent 系统
cd ai+
python api_server.py

# 终端 2: 启动 Electron 应用
cd apps/desktop
pnpm dev
```

### 2. 创建任务

1. 打开应用，进入抖音 APP
2. 打开右侧 "AI 智能助手" 面板
3. 输入测试指令：
   ```
   帮我在抖音上找2个关于人工智能的视频
   ```

### 3. 观察执行日志

任务开始后，你应该能看到：

#### 初始阶段
```
🎯 GlobalIntentAI  start
   message: 开始识别全局意图

🎯 GlobalIntentAI  complete
   intents_count: 1
   intents: [{"app": "douyin", "goal": "找2个关于人工智能的视频"}]

📋 ContextBuilderAI  start
   app: douyin
   goal: 找2个关于人工智能的视频

📋 ContextBuilderAI  complete
   domain: 短视频浏览
   sub_domain: 内容发现
   risk_level: low

🗺️ StrategyAI  start
   message: 开始生成策略参数

🗺️ StrategyAI  complete
   search_keywords: ["人工智能", "AI"]
   max_objects: 6
   target_count: 2
```

#### 执行循环
```
🤔 DecisionAI  decision
   action_type: navigation
   action: next
   reason: 需要浏览下一个视频
   progress: {objects_processed: 0, objects_matched: 0}

⚡ ExecutorAI  execute
   action: next
   message: 开始执行

⚡ ExecutorAI  success
   action: next
   success: true
   message: 已切换到下一个视频

🤔 DecisionAI  decision
   action_type: read
   action: getVideoInfo
   reason: 需要获取视频信息进行分析

⚡ ExecutorAI  execute
   action: getVideoInfo

⚡ ExecutorAI  success
   action: getVideoInfo
   success: true
```

### 4. 验证样式

检查不同 Agent 的显示效果：

- **GlobalIntentAI** 🎯: 蓝色边框和背景
- **ContextBuilderAI** 📋: 绿色边框和背景
- **StrategyAI** 🗺️: 粉色边框和背景
- **DecisionAI** 🤔: 紫色边框和背景
- **ExecutorAI** ⚡: 黄色边框和背景

检查不同动作的颜色：
- **start**: 蓝色
- **complete**: 绿色
- **decision**: 紫色
- **execute**: 黄色
- **success**: 绿色
- **error**: 红色（如果有错误）

### 5. 测试滚动

如果日志很多（超过容器高度），测试：
- 是否可以滚动查看所有日志
- 滚动条样式是否正常
- 新日志是否自动添加到底部

## API 测试

### 查询任务状态

```bash
# 获取任务 ID（从创建任务的响应中）
TASK_ID="your-task-id"

# 查询状态
curl http://localhost:8000/api/task/$TASK_ID | json_pp
```

**预期响应**:
```json
{
  "task_id": "...",
  "status": "running",
  "progress": {
    "objects_processed": 2,
    "objects_matched": 1
  },
  "execution_log": [
    {
      "agent": "GlobalIntentAI",
      "action": "start",
      "details": {
        "message": "开始识别全局意图"
      },
      "timestamp": "2024-01-01T12:00:00"
    },
    ...
  ]
}
```

## 常见问题

### Q1: 看不到执行日志

**A**: 检查：
1. AI Agent 系统是否正常启动
2. 任务是否正在执行（status = "running"）
3. 浏览器控制台是否有错误

### Q2: 日志显示不完整

**A**: 检查：
1. 轮询是否正常工作（2秒一次）
2. `execution_log` 字段是否存在
3. 日志容器的高度设置

### Q3: 样式显示异常

**A**: 检查：
1. CSS 是否正确加载
2. Agent 名称是否在 `agentStyles` 映射中
3. 浏览器是否支持 CSS 变量

## 性能测试

### 测试大量日志

```python
# 在 orchestrator 中添加测试代码
for i in range(100):
    self._log("TestAgent", "test", {"index": i, "message": f"测试日志 {i}"})
```

检查：
- 前端是否能流畅渲染100条日志
- 滚动是否流畅
- 内存使用是否正常

### 测试轮询性能

打开浏览器开发者工具 -> Network，观察：
- 轮询请求是否每2秒一次
- 响应时间是否合理（<100ms）
- 数据大小是否合理

## 调试技巧

### 在浏览器控制台

```javascript
// 查看当前执行日志
console.log(executionLogs);

// 查看任务状态
console.log(currentTaskStatus);

// 手动触发状态检查
checkTaskStatus(currentTaskId);
```

### 在 Python 端

```python
# 在 orchestrator 中
print(f"[DEBUG] 记录日志: {agent_name} - {action}")

# 在 api_server 中
print(f"[DEBUG] 任务状态: {task_manager.get_task(task_id)}")
```

## 成功标准

✅ 能看到实时的执行日志  
✅ 不同 Agent 有不同的样式  
✅ 日志按时间顺序显示  
✅ 能看到详细的决策理由和执行参数  
✅ 滚动流畅，无卡顿  
✅ 任务完成后日志被清空  

## 下一步

测试通过后，可以：
1. 尝试不同的任务指令
2. 测试错误情况（如网络错误）
3. 测试长时间运行的任务
4. 添加更多的日志记录点
5. 优化样式和交互

