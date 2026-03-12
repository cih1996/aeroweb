# 修复说明：'list' object has no attribute 'get'

## 问题原因

在 `orchestrator.py` 中，当处理 GlobalIntentAI 返回的意图列表时，代码假设所有数据都是字典类型，但实际可能会遇到其他类型的数据。

## 修复内容

### 1. 安全的意图提取

**之前的代码**:
```python
self._log("GlobalIntentAI", "complete", {
    "intents_count": len(global_intents.get('intents', [])),
    "intents": [{"app": i.get('app'), "goal": i.get('goal')} for i in global_intents.get('intents', [])]
})
```

**修复后**:
```python
intents_list = global_intents.get('intents', [])

# 安全地提取意图信息
intents_summary = []
for intent in intents_list:
    if isinstance(intent, dict):
        intents_summary.append({
            "app": intent.get('app', 'unknown'),
            "goal": intent.get('goal', '')
        })

self._log("GlobalIntentAI", "complete", {
    "intents_count": len(intents_list),
    "intents": intents_summary
})
```

### 2. 类型检查保护

**之前的代码**:
```python
for intent in global_intents.get("intents", []):
    print(f"  - {intent.get('app')}: {intent.get('goal')}")
    self._run_single_task(intent)
```

**修复后**:
```python
for intent in intents_list:
    if isinstance(intent, dict):
        print(f"  - {intent.get('app', 'unknown')}: {intent.get('goal', '')}")
        self._run_single_task(intent)
    else:
        print(f"⚠️ 跳过无效的意图数据类型: {type(intent)}")
```

### 3. 日志回调错误处理

**之前的代码**:
```python
def _log(self, agent_name: str, action: str, details: Dict[str, Any] = None):
    if self.log_callback:
        self.log_callback({
            "agent": agent_name,
            "action": action,
            "details": details or {}
        })
```

**修复后**:
```python
def _log(self, agent_name: str, action: str, details: Dict[str, Any] = None):
    if self.log_callback:
        try:
            self.log_callback({
                "agent": agent_name,
                "action": action,
                "details": details or {}
            })
        except Exception as e:
            print(f"⚠️ [Orchestrator] 记录日志失败: {e}")
```

### 4. 安全的参数访问

在 `_run_single_task` 方法开头添加了类型检查：

```python
def _run_single_task(self, global_intent: Dict):
    # 安全地获取意图信息
    app_name = global_intent.get('app', 'unknown') if isinstance(global_intent, dict) else 'unknown'
    goal = global_intent.get('goal', '') if isinstance(global_intent, dict) else ''
    
    # ... 后续使用 app_name 和 goal 变量
```

## 测试方法

### 1. 重启 AI Agent 系统

```bash
# Ctrl+C 停止当前运行的系统
cd ai+
python api_server.py
```

### 2. 创建测试任务

在 Electron 应用中输入：
```
帮我在抖音上找2个关于AI的视频
```

### 3. 检查输出

终端应该显示：
```
[Step 1] 识别全局意图...
[GlobalIntentAI] 识别到 1 个意图
  - douyin: 找2个关于AI的视频

[Step 2] 构建任务上下文...
[ContextBuilderAI] 任务画像:
  - 领域: 短视频浏览
  ...
```

**不应该再出现**:
```
❌ [TaskManager] 任务执行失败: 'list' object has no attribute 'get'
```

## 如果问题仍然存在

### 检查 GlobalIntentAI 的输出

添加调试代码：

```python
# 在 orchestrator.py 的 run_task 方法中
global_intents = GlobalIntentAI.run(...)

print(f"[DEBUG] global_intents type: {type(global_intents)}")
print(f"[DEBUG] global_intents content: {global_intents}")

if 'intents' in global_intents:
    print(f"[DEBUG] intents type: {type(global_intents['intents'])}")
    if global_intents['intents']:
        print(f"[DEBUG] first intent type: {type(global_intents['intents'][0])}")
```

### 检查 AI 响应格式

查看 `ai+/conversations/global_session/globalintentai.session` 文件，确认 AI 返回的格式是否正确。

预期格式：
```json
{
  "intents": [
    {
      "app": "douyin",
      "goal": "找2个关于AI的视频",
      "keywords": ["AI", "人工智能"]
    }
  ]
}
```

## 预防措施

所有访问字典或列表的代码都应该：

1. **使用 isinstance() 检查类型**
   ```python
   if isinstance(data, dict):
       value = data.get('key', default)
   ```

2. **提供默认值**
   ```python
   value = data.get('key', 'default')
   ```

3. **添加 try-except**
   ```python
   try:
       value = process_data(data)
   except Exception as e:
       print(f"处理失败: {e}")
       value = default_value
   ```

## 相关文件

- `ai+/agent_system/core/orchestrator.py` - 主要修复文件
- `ai+/agent_system/agents/global_intent.py` - GlobalIntentAI 实现
- `ai+/prompts/agents/global_intent.prompt` - GlobalIntentAI 提示词

## 提交说明

修复了在处理 GlobalIntentAI 返回的意图列表时可能出现的类型错误。添加了：
- isinstance() 类型检查
- 安全的默认值
- try-except 错误处理
- 更详细的错误提示

这确保了即使 AI 返回了意外的数据格式，系统也能继续运行而不会崩溃。

