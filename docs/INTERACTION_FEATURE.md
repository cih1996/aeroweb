# 人机交互功能文档

## 概述

实现了完整的人机交互功能，当 AI 系统遇到需要用户确认的情况时，会通过 task 接口返回交互请求，前端展示选项供用户选择。

## 功能流程

```
┌─────────────────────────────────┐         ┌──────────────────────────┐
│   Electron 前端                  │         │  Python AI Agent 系统     │
│                                 │         │                          │
│  1. 轮询任务状态                  │         │  4. 检测到异常           │
│  ├──────────────────────────────>│         │  └─> InteractionGateAI   │
│  │                              │         │                          │
│  2. 返回 interaction_required    │         │  5. 设置交互状态          │
│  │<─────────────────────────────┤         │  └─> waiting_interaction  │
│  │                              │         │                          │
│  3. 展示交互选项                  │         │  6. 等待用户选择          │
│  └─> InteractionPanel           │         │  (阻塞执行)              │
│                                 │         │                          │
│  用户点击选项                     │         │                          │
│  │                              │         │                          │
│  7. 提交选择                     │         │  8. 接收选择             │
│  ├─────────────────────────────>│         │  └─> 应用调整            │
│  │ POST /api/task/{id}/interact │         │                          │
│  │                              │         │  9. 继续执行任务          │
│  10. 继续轮询                    │         │  └─> status = running     │
│  │<─────────────────────────────┤         │                          │
└─────────────────────────────────┘         └──────────────────────────┘
```

## 后端实现

### 1. TaskManager 增强

**新增字段**:
```python
{
  "interaction_required": False,
  "interaction_data": None,
  "user_choice": None
}
```

**新增方法**:
- `set_interaction_required(task_id, interaction_data)` - 设置需要交互
- `set_user_choice(task_id, choice)` - 设置用户选择
- `get_user_choice(task_id)` - 获取用户选择

### 2. Orchestrator 修改

**新增参数**:
```python
def __init__(self, enable_interaction=True, log_callback=None, interaction_callback=None):
    self.interaction_callback = interaction_callback
```

**交互流程**:
```python
def _handle_interaction(self, runtime, anomaly):
    # 1. 调用 InteractionGateAI 分析
    interaction_result = InteractionGateAI.run(...)
    
    # 2. 通过回调获取用户选择
    if self.interaction_callback:
        user_choice = self._get_user_choice_via_callback(...)
    
    # 3. 应用用户调整
    runtime.apply_user_adjustment(user_choice)
```

### 3. 新增 API 接口

```http
POST /api/task/{task_id}/interact
Content-Type: application/json

{
  "choice": "用户选择的choice_id"
}
```

**响应**:
```json
{
  "success": true,
  "message": "已接收用户选择"
}
```

## 前端实现

### 1. 类型定义

```typescript
export interface InteractionOption {
  choice_id: string;
  label: string;
  description: string;
}

export interface InteractionData {
  situation: string;
  details: string;
  severity: 'low' | 'medium' | 'high';
  options: InteractionOption[];
}

export interface TaskStatus {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'waiting_interaction';
  interaction_required?: boolean;
  interaction_data?: InteractionData;
  ...
}
```

### 2. InteractionPanel 组件

**功能**:
- 显示交互情况说明
- 显示详细信息
- 列出所有选项
- 处理用户点击

**样式**:
- 根据严重程度使用不同颜色
  - low: 绿色 (ℹ️)
  - medium: 黄色 (⚠️)
  - high: 红色 (🚨)
- 悬停动画
- 点击反馈

### 3. AIChatPanel 集成

**状态管理**:
```typescript
let interactionData: InteractionData | null = null;
let waitingForInteraction = false;
```

**轮询检测**:
```typescript
if (status.interaction_required && status.interaction_data) {
  handleInteractionRequired(status.interaction_data);
}
```

**用户选择处理**:
```typescript
async function handleUserChoice(choiceId: string) {
  await client.submitInteraction(currentTaskId, choiceId);
  // 清除交互状态，继续轮询
}
```

## 使用场景

### 1. 匹配率过低

当 AI 发现匹配率低于预期时：

```
情况: 匹配率过低
详情: 已浏览 5 个视频，但只匹配到 1 个（20%），远低于预期...
严重程度: medium

选项:
[1] 继续执行 - 继续按当前策略执行
[2] 调整策略 - 放宽匹配条件
[3] 停止任务 - 停止当前任务
```

### 2. 时间消耗过长

```
情况: 时间消耗过长
详情: 任务已执行 3 分钟，仍未达到目标...
严重程度: high

选项:
[1] 继续执行 - 给更多时间
[2] 停止任务 - 立即停止
```

### 3. 内容质量异常

```
情况: 内容质量异常
详情: 最近浏览的视频质量不符合预期...
严重程度: low

选项:
[1] 继续执行 - 忽略此异常
[2] 调整策略 - 提高质量要求
```

## 配置

### 启用交互

创建任务时设置 `enable_interaction=True`:

```typescript
const client = getAIAgentClient();
const taskId = await client.createTask({
  message: "帮我找视频",
  enable_interaction: true  // 启用交互
});
```

### 超时设置

后端默认等待 5 分钟：

```python
max_wait_time = 300  # 秒
```

如果超时，任务会自动停止。

## 测试

### 1. 触发交互

创建一个会触发交互的任务：

```
帮我在抖音上找10个关于人工智能的视频
```

由于目标数量较多，可能会触发"匹配率过低"的交互。

### 2. 查看交互面板

当任务状态变为 `waiting_interaction` 时，前端会显示：

```
⏸️ 等待您的确认...

┌────────────────────────────────────┐
│ ⚠️ 匹配率过低                       │
│                                    │
│ 已浏览 5 个视频，但只匹配到 1 个...  │
│                                    │
│ 请选择操作：                         │
│ ┌────────────────────────────────┐ │
│ │ [1] 继续执行                    │ │
│ │     继续按当前策略执行           │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ [2] 调整策略                    │ │
│ │     放宽匹配条件                 │ │
│ └────────────────────────────────┘ │
│ ┌────────────────────────────────┐ │
│ │ [3] 停止任务                    │ │
│ │     停止当前任务                 │ │
│ └────────────────────────────────┘ │
└────────────────────────────────────┘
```

### 3. 验证选择

点击选项后：
- 前端发送 POST 请求到 `/api/task/{id}/interact`
- 后端接收选择，继续执行任务
- 状态变回 `running`
- 前端继续轮询

## 优化建议

### 1. 添加倒计时

显示剩余等待时间：

```typescript
let remainingTime = 300; // 秒
const countdown = setInterval(() => {
  remainingTime--;
  if (remainingTime <= 0) {
    clearInterval(countdown);
  }
}, 1000);
```

### 2. 添加快捷键

支持键盘快捷键选择：

```typescript
window.addEventListener('keydown', (e) => {
  if (e.key === '1') handleUserChoice('continue');
  if (e.key === '2') handleUserChoice('adjust');
  if (e.key === '3') handleUserChoice('stop');
});
```

### 3. 添加历史记录

记录用户的选择偏好，用于 AI 学习：

```typescript
const userPreferences = {
  low_match_rate: 'adjust_strategy',
  long_time: 'continue',
  // ...
};
```

## 注意事项

1. **超时处理**: 如果用户 5 分钟内没有选择，任务会自动停止
2. **并发控制**: 同一时间只能有一个交互请求
3. **状态同步**: 确保前后端状态一致
4. **错误处理**: 处理网络错误和超时

## API 文档

### 提交交互选择

```http
POST /api/task/{task_id}/interact
Content-Type: application/json

{
  "choice": "continue"  // 或其他 choice_id
}
```

**成功响应** (200):
```json
{
  "success": true,
  "message": "已接收用户选择"
}
```

**错误响应** (400):
```json
{
  "detail": "任务不需要交互"
}
```

**错误响应** (404):
```json
{
  "detail": "任务不存在"
}
```

## 完成状态

✅ 后端交互回调机制  
✅ TaskManager 交互状态管理  
✅ Orchestrator 交互流程  
✅ API 接口 `/api/task/{id}/interact`  
✅ 前端类型定义  
✅ InteractionPanel 组件  
✅ AIChatPanel 集成  
✅ 状态轮询和更新  
✅ 用户选择提交  

## 下一步

1. 添加更多交互场景
2. 实现交互历史记录
3. 支持自定义输入（除了选项外）
4. 添加交互统计和分析
5. 优化交互UI/UX

