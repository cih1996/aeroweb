# AI Agent 执行日志功能

## 概述

实现了 AI Agent 系统的执行日志功能，前端可以实时查看 AI 决策和执行的详细过程。

## 实现方案

### 选择方案：轮询 task 接口返回 ✅

**原因**:
1. 实现简单，不需要额外的服务器
2. 与现有轮询机制一致
3. 2秒轮询间隔对 AI 执行来说足够实时
4. 易于维护和调试

### 架构说明

```
┌─────────────────────────────────┐         ┌──────────────────────────┐
│   Electron 前端                  │         │  Python AI Agent 系统     │
│                                 │         │                          │
│  ┌──────────────────────────┐  │         │  ┌────────────────────┐  │
│  │  AIChatPanel.svelte      │  │         │  │  AgentOrchestrator  │  │
│  │  - 轮询任务状态           │  │         │  │  - 执行任务        │  │
│  │  - 显示执行日志           │  │         │  │  - 记录日志        │  │
│  └──────────────────────────┘  │         │  └────────────────────┘  │
│           │                     │         │          │               │
│           │ 2. 轮询              │         │          │               │
│           ├────────────────────>│         │          │               │
│           │ GET /api/task/{id}  │         │          │               │
│           │                     │         │          │               │
│           │ 3. 返回状态+日志     │         │  ┌────────────────────┐  │
│           │<────────────────────┤         │  │  TaskManager       │  │
│           │ {status, logs...}   │         │  │  - 存储任务状态    │  │
│           │                     │         │  │  - 添加执行日志    │  │
│  ┌──────────────────────────┐  │         │  └────────────────────┘  │
│  │  ExecutionLog.svelte     │  │         │          ▲               │
│  │  - 渲染日志               │  │         │          │               │
│  │  - 不同样式显示不同Agent  │  │         │          │ log_callback  │
│  └──────────────────────────┘  │         │          │               │
└─────────────────────────────────┘         └──────────────────────────┘
```

## 后端实现

### 1. TaskManager 增强

**文件**: `ai+/api_server.py`

新增功能:
- `execution_log` 字段：存储执行日志数组
- `add_execution_log()` 方法：添加执行日志条目

```python
def create_task(self, message: str, enable_interaction: bool) -> str:
    self.tasks[task_id] = {
        ...
        "execution_log": [],  # 新增
        ...
    }

def add_execution_log(self, task_id: str, log_entry: Dict[str, Any]):
    """添加执行日志"""
    if task_id in self.tasks:
        self.tasks[task_id]["execution_log"].append({
            **log_entry,
            "timestamp": datetime.now().isoformat()
        })
```

### 2. AgentOrchestrator 日志回调

**文件**: `ai+/agent_system/core/orchestrator.py`

新增功能:
- `log_callback` 参数：接收日志回调函数
- `_log()` 方法：记录日志到回调
- 在关键步骤添加日志记录

```python
def __init__(self, enable_interaction: bool = True, log_callback=None):
    self.log_callback = log_callback

def _log(self, agent_name: str, action: str, details: Dict[str, Any] = None):
    """记录日志"""
    if self.log_callback:
        self.log_callback({
            "agent": agent_name,
            "action": action,
            "details": details or {}
        })
```

### 3. 日志记录点

| Agent | 动作 | 记录内容 |
|-------|------|---------|
| GlobalIntentAI | start | 开始识别意图 |
| GlobalIntentAI | complete | 识别到的意图列表 |
| ContextBuilderAI | start | 开始构建上下文 |
| ContextBuilderAI | complete | 任务画像（领域、风险等级） |
| StrategyAI | start | 开始生成策略 |
| StrategyAI | complete | 策略参数（关键词、目标数量） |
| DecisionAI | decision | 决策内容（动作、参数、理由） |
| ExecutorAI | execute | 开始执行动作 |
| ExecutorAI | success | 执行成功 |
| ExecutorAI | error | 执行失败 |

## 前端实现

### 1. 类型定义

**文件**: `renderer/src/services/ai-agent/index.ts`

```typescript
export interface ExecutionLogEntry {
  agent: string;
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface TaskStatus {
  ...
  execution_log?: ExecutionLogEntry[];
}
```

### 2. ExecutionLog 组件

**文件**: `renderer/src/components/panels/ExecutionLog.svelte`

功能:
- 显示执行日志列表
- 根据 Agent 类型使用不同图标和颜色
- 根据动作类型使用不同颜色
- 时间格式化
- 详情展示

#### Agent 样式映射

| Agent | 图标 | 颜色 |
|-------|------|------|
| GlobalIntentAI | 🎯 | 蓝色 (#4facfe) |
| ContextBuilderAI | 📋 | 绿色 (#43e97b) |
| StrategyAI | 🗺️ | 粉色 (#fa709a) |
| DecisionAI | 🤔 | 紫色 (#f093fb) |
| ExecutorAI | ⚡ | 黄色 (#feca57) |
| PerceptionAI | 👁️ | 红色 (#ff6b6b) |
| SupervisorAI | 🛡️ | 青色 (#48dbfb) |
| SummarizerAI | 📝 | 玫红 (#ee5a6f) |

#### 动作样式映射

| 动作 | 颜色 |
|------|------|
| start | 蓝色 |
| complete | 绿色 |
| decision | 紫色 |
| execute | 黄色 |
| success | 绿色 |
| error | 红色 |

### 3. AIChatPanel 集成

**文件**: `renderer/src/components/panels/AIChatPanel.svelte`

修改:
- 导入 ExecutionLog 组件
- 新增 `executionLogs` 状态
- 在 `checkTaskStatus()` 中更新日志
- 在任务进度面板中显示执行日志

## 使用效果

### 任务执行时

```
┌─────────────────────────────────────┐
│ 任务执行中...                         │
├─────────────────────────────────────┤
│ 进度:                                │
│   objects_processed: 2               │
│   objects_matched: 1                 │
├─────────────────────────────────────┤
│ 执行细节                              │
│ ┌─────────────────────────────────┐ │
│ │ 🎯 GlobalIntentAI  start  14:30 │ │
│ │    message: 开始识别全局意图      │ │
│ ├─────────────────────────────────┤ │
│ │ 🎯 GlobalIntentAI  complete      │ │
│ │    intents_count: 1              │ │
│ ├─────────────────────────────────┤ │
│ │ 📋 ContextBuilderAI  complete    │ │
│ │    domain: 短视频浏览             │ │
│ ├─────────────────────────────────┤ │
│ │ 🤔 DecisionAI  decision          │ │
│ │    action: next, reason: ...     │ │
│ ├─────────────────────────────────┤ │
│ │ ⚡ ExecutorAI  success            │ │
│ │    action: next, success: true   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 优势特点

### 1. 实时性
- 2秒轮询间隔
- 实时更新执行日志
- 无明显延迟感

### 2. 可视化
- 不同 Agent 使用不同颜色和图标
- 一目了然地了解 AI 决策过程
- 滑动动画，体验流畅

### 3. 详细性
- 记录所有关键步骤
- 显示决策理由
- 显示执行参数和结果

### 4. 易维护
- 简单的轮询机制
- 标准的 REST API
- 易于扩展新的 Agent

## 扩展建议

### 短期

1. **过滤功能**: 按 Agent 类型或动作类型过滤日志
2. **搜索功能**: 搜索日志内容
3. **导出功能**: 导出日志为文本或 JSON

### 中期

1. **日志详情**: 点击日志查看完整的详情对象
2. **时间轴视图**: 以时间轴形式展示执行过程
3. **性能统计**: 显示每个 Agent 的执行时间

### 长期

1. **实时推送**: 使用 WebSocket 实现真正的实时推送
2. **历史回放**: 回放历史任务的执行过程
3. **可视化流程图**: 以流程图形式展示 Agent 调用关系

## 调试技巧

### 查看完整日志

```javascript
// 在浏览器控制台
console.log(executionLogs);
```

### 测试日志记录

```python
# 在 orchestrator 中添加测试日志
self._log("TestAgent", "test", {"message": "测试日志"})
```

### 验证日志格式

```bash
# 查询任务状态
curl http://localhost:8000/api/task/{task_id}

# 检查 execution_log 字段
{
  "execution_log": [
    {
      "agent": "GlobalIntentAI",
      "action": "start",
      "details": {...},
      "timestamp": "2024-01-01T12:00:00"
    }
  ]
}
```

## 性能考虑

1. **日志数量**: 建议限制日志条数（如最多100条）
2. **轮询间隔**: 2秒是平衡实时性和性能的最佳值
3. **数据大小**: 避免在 details 中存储大量数据

## 总结

通过轮询 task 接口返回执行日志，实现了：

✅ 实时查看 AI 决策过程  
✅ 不同 Agent 使用不同样式  
✅ 简单易维护的架构  
✅ 良好的用户体验  

这个方案在实时性、复杂度和性能之间取得了最佳平衡。

