# 📝 任务执行日志系统

## 概述

为了方便排查 AI Agent 系统的执行问题，我们实现了一个完整的文件日志系统。每个任务执行时都会生成详细的日志文件，记录所有关键决策和执行细节。

## 日志文件位置

所有日志文件保存在 `ai+/logs/` 目录下：

```
ai+/logs/
├── task_<task_id>.log        # 文本格式日志（易读）
└── task_<task_id>.json       # JSON 格式日志（结构化）
```

## 日志内容

### 1. 任务创建
```
[步骤 1] TASK_CREATED - 任务创建
时间: 2024-12-27 10:30:00
级别: INFO

数据:
{
  "task_id": "bedac9b8-a52d-4288-bf9e-47d825d93cbd",
  "message": "找2个关于AI的视频",
  "enable_interaction": true
}
```

### 2. APP 能力注册
**重要**：记录所有已注册的 APP 和它们的能力列表，用于排查"调用了不存在的能力"问题。

```
[步骤 2] APP_CAPABILITIES - 应用 'douyin' 的能力列表
时间: 2024-12-27 10:30:01
级别: INFO

数据:
{
  "app_name": "douyin",
  "capabilities": {
    "navigation": {
      "next": {
        "params": [],
        "description": "切换到下一个视频"
      }
    },
    "read": {
      "getVideoInfo": {
        "params": [],
        "description": "获取当前视频信息"
      },
      "getComments": {
        "params": [],
        "description": "获取评论列表"
      }
    },
    "engagement": {
      "like": {
        "params": [],
        "description": "点赞视频"
      },
      "sendComment": {
        "params": ["text"],
        "description": "发送评论"
      }
    }
  },
  "total_count": 5
}
```

### 3. AI 决策
**关键**：记录 DecisionAI 决定调用什么动作。

```
[步骤 8] AI_DECISION - DecisionAI 做出决策
时间: 2024-12-27 10:30:05
级别: INFO

数据:
{
  "agent": "DecisionAI",
  "decision": {
    "action_type": "read",
    "action": "getVideoInfo",
    "params": [],
    "reason": "需要先获取视频信息以判断是否符合条件"
  },
  "context": {
    "progress": {
      "objects_processed": 0,
      "objects_matched": 0,
      "engagements_made": 0
    }
  }
}
```

### 4. 动作执行结果
**关键**：记录动作是否成功执行。

```
[步骤 9] ACTION_RESULT - 动作执行成功: getVideoInfo
时间: 2024-12-27 10:30:06
级别: INFO

数据:
{
  "action": "getVideoInfo",
  "success": true,
  "message": "执行成功"
}
```

**如果动作不存在**：
```
[步骤 9] ACTION_RESULT - 动作执行失败: getVideos
时间: 2024-12-27 10:30:06
级别: ERROR

数据:
{
  "action": "getVideos",
  "error": "动作 'getVideos' 不在已注册的能力列表中。可用动作: next, getVideoInfo, getComments, like, sendComment"
}
```

### 5. 监督 AI 决策
**关键**：记录 SupervisorAI 的判断，用于排查"监督 AI 没有起作用"问题。

```
[步骤 10] SUPERVISOR - 监督决策: CONTINUE
时间: 2024-12-27 10:30:07
级别: INFO

数据:
{
  "control": "CONTINUE",
  "reason": "系统运行正常，继续执行",
  "runtime_state": {
    "state": "RUNNING",
    "progress": {
      "objects_processed": 1,
      "objects_matched": 0,
      "engagements_made": 0
    }
  }
}
```

**如果监督决定停止**：
```
[步骤 15] SUPERVISOR - 监督决策: STOP
时间: 2024-12-27 10:30:15
级别: WARNING

数据:
{
  "control": "STOP",
  "reason": "连续5次动作失败，存在风险",
  "runtime_state": {
    "state": "RUNNING",
    "progress": {
      "objects_processed": 0,
      "objects_matched": 0,
      "engagements_made": 0
    }
  }
}
```

### 6. 循环迭代
**关键**：记录每次主循环迭代的状态，用于排查"一直循环"问题。

```
[步骤 11] LOOP_ITERATION - 第 5 次迭代
时间: 2024-12-27 10:30:08
级别: INFO

数据:
{
  "step": 5,
  "progress": {
    "objects_processed": 2,
    "objects_matched": 1,
    "engagements_made": 1
  },
  "state": "RUNNING",
  "current_object_state": "MATCHED",
  "consecutive_no_match": 0
}
```

### 7. 循环上限
如果达到最大循环次数（30 次），会强制停止并记录：

```
[步骤 60] LOOP_LIMIT - 达到循环上限
时间: 2024-12-27 10:31:00
级别: WARNING

数据:
{
  "max_steps": 30,
  "final_progress": {
    "objects_processed": 10,
    "objects_matched": 2,
    "engagements_made": 2
  },
  "final_state": {
    "state": "STOPPED",
    "progress": {...}
  }
}
```

## 如何使用日志排查问题

### 问题 1：AI 调用了不存在的能力

**排查步骤**：
1. 打开日志文件 `task_<task_id>.log`
2. 搜索 `APP_CAPABILITIES` 找到所有注册的能力
3. 搜索 `AI_DECISION` 找到 AI 决定调用的动作
4. 搜索 `ACTION_RESULT` 查看执行结果

**可能原因**：
- 能力注册时拼写错误
- 能力注册时的 `name` 与实际执行函数名不一致
- Electron 前端没有正确注册某个能力
- AI 的 prompt 中没有给出正确的能力列表

**解决方案**：
- 检查 `douyin-capabilities.ts` 中的能力定义
- 确保 `name` 字段与实际执行函数名一致
- 重新启动 Electron 确保能力重新注册

### 问题 2：一直循环，监督 AI 没有起作用

**排查步骤**：
1. 打开日志文件 `task_<task_id>.log`
2. 搜索 `LOOP_ITERATION` 查看每次迭代的状态
3. 搜索 `SUPERVISOR` 查看监督 AI 的判断
4. 搜索 `consecutive_no_match` 查看连续未匹配次数

**可能原因**：
- 动作执行失败但被标记为成功（导致 `consecutive_no_match` 没有增加）
- 监督 AI 的停止条件太宽松
- Runtime 的异常检测逻辑没有触发

**解决方案**：
- 检查动作执行结果是否准确反映实际状态
- 调整监督 AI 的 prompt，使其更容易触发停止
- 调整 `runtime.py` 中的异常检测阈值

### 问题 3：AI 给错了函数名

**排查步骤**：
1. 搜索 `AI_DECISION` 查看 AI 决定调用的动作
2. 对比 `APP_CAPABILITIES` 中注册的动作名
3. 检查 AI 的 `reason` 字段，理解 AI 为什么这样决策

**可能原因**：
- DecisionAI 的 prompt 中没有明确列出所有可用动作
- 能力描述（`description`）不够清晰，误导了 AI
- AI 模型产生了幻觉（hallucination）

**解决方案**：
- 更新 DecisionAI 的 prompt，明确列出所有动作及其用途
- 改进能力的 `description` 字段，使其更准确
- 在 prompt 中强调"只能使用已注册的动作"

## 日志示例：完整的执行流程

```
================================================================================
[步骤 1] TASK_CREATED - 任务创建
时间: 2024-12-27 10:30:00
级别: INFO
数据: {"task_id": "...", "message": "找2个关于AI的视频"}
================================================================================

================================================================================
[步骤 2] APP_CAPABILITIES - 应用 'douyin' 的能力列表
时间: 2024-12-27 10:30:01
级别: INFO
数据: {"app_name": "douyin", "capabilities": {...}, "total_count": 5}
================================================================================

================================================================================
[步骤 3] ORCHESTRATOR_START - 创建 Orchestrator
时间: 2024-12-27 10:30:02
级别: INFO
数据: {"enable_interaction": true}
================================================================================

================================================================================
[步骤 4] AGENT_LOG - GlobalIntentAI - start
时间: 2024-12-27 10:30:03
级别: INFO
数据: {"message": "开始识别全局意图"}
================================================================================

================================================================================
[步骤 5] LOOP_START - 开始主循环
时间: 2024-12-27 10:30:05
级别: INFO
数据: {"max_steps": 30, "target_count": 5, "target_matched": 2}
================================================================================

================================================================================
[步骤 6] LOOP_ITERATION - 第 1 次迭代
时间: 2024-12-27 10:30:06
级别: INFO
数据: {"step": 1, "progress": {...}, "state": "RUNNING"}
================================================================================

================================================================================
[步骤 7] SUPERVISOR - 监督决策: CONTINUE
时间: 2024-12-27 10:30:07
级别: INFO
数据: {"control": "CONTINUE", "reason": "系统运行正常"}
================================================================================

================================================================================
[步骤 8] AI_DECISION - DecisionAI 做出决策
时间: 2024-12-27 10:30:08
级别: INFO
数据: {"action": "getVideoInfo", "reason": "获取视频信息"}
================================================================================

================================================================================
[步骤 9] ACTION_RESULT - 动作执行成功: getVideoInfo
时间: 2024-12-27 10:30:09
级别: INFO
数据: {"action": "getVideoInfo", "success": true}
================================================================================

... (更多循环迭代) ...

================================================================================
[步骤 50] LOOP_END - 达到目标
时间: 2024-12-27 10:32:00
级别: INFO
数据: {"total_steps": 15, "progress": {"objects_matched": 2}}
================================================================================

================================================================================
任务执行完成
最终状态: completed
结束时间: 2024-12-27 10:32:05
总步骤数: 50
================================================================================
```

## JSON 格式日志

如果需要程序化分析日志，可以使用 JSON 格式：

```json
{
  "task_id": "bedac9b8-a52d-4288-bf9e-47d825d93cbd",
  "total_steps": 50,
  "entries": [
    {
      "step": 1,
      "timestamp": "2024-12-27T10:30:00",
      "category": "TASK_CREATED",
      "title": "任务创建",
      "level": "INFO",
      "data": {
        "task_id": "...",
        "message": "找2个关于AI的视频"
      }
    },
    {
      "step": 2,
      "category": "APP_CAPABILITIES",
      "title": "应用 'douyin' 的能力列表",
      "level": "INFO",
      "data": {
        "app_name": "douyin",
        "capabilities": {...}
      }
    },
    ...
  ]
}
```

## 快速查找问题

### 使用 grep 快速搜索

```bash
# 查找所有错误
grep "级别: ERROR" logs/task_*.log

# 查找动作执行失败
grep "动作执行失败" logs/task_*.log

# 查找循环上限
grep "LOOP_LIMIT" logs/task_*.log

# 查找监督停止
grep "监督决策: STOP" logs/task_*.log

# 查找所有能力注册
grep "APP_CAPABILITIES" logs/task_*.log
```

### 使用 Python 分析 JSON 日志

```python
import json

# 读取 JSON 日志
with open('ai+/logs/task_xxx.json', 'r') as f:
    log = json.load(f)

# 统计各类事件
from collections import Counter
categories = Counter(e['category'] for e in log['entries'])
print(categories)

# 找出所有决策
decisions = [e for e in log['entries'] if e['category'] == 'AI_DECISION']
for d in decisions:
    print(f"步骤 {d['step']}: {d['data']['decision']['action']}")

# 找出所有失败的动作
failures = [e for e in log['entries'] 
            if e['category'] == 'ACTION_RESULT' 
            and not e['data'].get('success')]
print(f"失败动作数: {len(failures)}")
```

## 注意事项

1. **日志文件会持续增长**：定期清理 `ai+/logs/` 目录
2. **敏感信息**：日志中可能包含任务消息和执行结果，注意保护隐私
3. **性能影响**：日志写入是实时的，对性能影响很小

## 总结

有了这个完整的日志系统，你可以：
- ✅ 查看 AI 的每一个决策
- ✅ 确认哪些能力被注册了
- ✅ 追踪动作执行的成功/失败
- ✅ 分析监督 AI 的判断逻辑
- ✅ 排查无限循环问题
- ✅ 找到 AI 给错函数名的根本原因

**开始排查问题吧！** 🔍

