# AI Agent 新架构 V2：11 层智能体系统

## 问题分析

### 现有 8 层架构的缺陷

1. **GlobalIntentAI 定死了 app**
   - 直接从用户对话输出 app 名称
   - 如果 app 不存在或名称对不上，系统无法处理
   - 无法匹配到其他通用能力（如 MCP）

2. **只能执行任务，不能处理普通对话**
   - 用户想聊天、记录偏好时，系统无法响应
   - 缺少对话式交互能力

3. **没有反馈输出**
   - 任务执行完就停止，不生成报告
   - 对于复杂任务（如"了解电商大环境并总结报告"），无法给出结论

4. **复杂任务无法完成**
   - 设计了 8 层，但只能做简单的单一任务
   - 无法处理多步骤、多能力组合的任务

---

## 新架构：11 层智能体系统

```
用户输入
   ↓
[1] ConversationRouterAI ← 新增：对话路由
   ├─→ 普通对话 → [2] DialogAI ← 新增：对话AI
   │                  ↓
   │              [3] MemoryLearnerAI（记录用户信息）
   │                  ↓
   │              返回对话响应
   │
   └─→ 任务执行 → [4] TaskPlannerAI ← 新增：任务规划
                     ↓
                  [5] CapabilityMatcherAI ← 新增：能力匹配
                     ↓
                  [6] ContextBuilderAI
                     ↓
                  [7] StrategyAI
                     ↓
                  执行循环：
                     [8] SupervisorAI
                     [9] DecisionAI
                     [10] ExecutorAI
                     [11] PerceptionAI
                     ↓（循环直到完成）
                  [12] SummarizerAI ← 增强：生成反馈报告
                     ↓
                  返回执行结果 + 报告
```

---

## 各层职责详解

### 第 1 层：ConversationRouterAI（对话路由）

**职责：**
- 判断用户输入的意图类型
- 路由到对话模式或任务模式

**输入：**
- 用户消息
- 对话历史（最近 10 条）

**输出：**
```json
{
  "intent_type": "conversation | task",
  "confidence": 0.9,
  "reasoning": "用户在描述自己的偏好，属于对话"
}
```

**路由规则：**
- `conversation`：闲聊、问答、记录信息、设置偏好等
- `task`：明确的执行需求（点赞、评论、搜索、总结等）

---

### 第 2 层：DialogAI（对话 AI）★ 新增

**职责：**
- 处理普通对话、问答
- 理解用户意图并生成友好回复
- 识别需要记录的信息（偏好、习惯、个人信息）

**输入：**
- 用户消息
- 对话历史
- 用户画像（从 Memory 读取）

**输出：**
```json
{
  "response": "好的，我记住了你喜欢美食和旅游内容",
  "should_memorize": true,
  "memory_data": {
    "type": "user_preference",
    "content": {
      "interests": ["美食", "旅游"],
      "style": "喜欢轻松幽默的内容"
    }
  }
}
```

**特性：**
- 支持多轮对话
- 自动识别需要记忆的信息
- 调用 MemoryLearnerAI 存储

---

### 第 3 层：MemoryLearnerAI（记忆学习，保持）

**职责：**
- 存储用户偏好、习惯、个人信息
- 存储任务执行经验
- 提供记忆检索接口

**增强：**
- 支持对话场景的记忆存储
- 记忆类型扩展：
  - `user_profile`：用户基本信息
  - `user_preference`：用户偏好
  - `conversation_context`：对话上下文
  - `task_experience`：任务执行经验

---

### 第 4 层：TaskPlannerAI（任务规划）★ 新增

**职责：**
- 理解复杂任务，分解为多个子任务
- 识别任务需要的能力类型（不指定具体 app）
- 规划执行顺序

**输入：**
- 用户任务描述
- 对话历史

**输出：**
```json
{
  "main_goal": "了解抖音电商大环境并生成报告",
  "sub_tasks": [
    {
      "task_id": "task_1",
      "description": "浏览抖音电商相关视频",
      "required_capabilities": ["short_video_platform", "navigation", "read"],
      "expected_output": "收集 20-30 个电商相关视频信息"
    },
    {
      "task_id": "task_2",
      "description": "分析视频内容和评论",
      "required_capabilities": ["short_video_platform", "read", "analyze"],
      "expected_output": "提取电商趋势、用户反馈"
    },
    {
      "task_id": "task_3",
      "description": "生成总结报告",
      "required_capabilities": ["text_generation"],
      "expected_output": "电商大环境分析报告"
    }
  ],
  "execution_mode": "sequential",
  "reasoning": "需要先收集信息，再分析，最后总结"
}
```

**特性：**
- 只定义能力类型，不指定具体 app
- 支持复杂任务分解
- 支持多步骤任务规划

---

### 第 5 层：CapabilityMatcherAI（能力匹配）★ 新增

**职责：**
- 根据任务需求，匹配可用的能力提供者
- 支持多种能力来源：APP、MCP、API、本地工具等
- 处理能力不存在的情况

**输入：**
- 子任务描述
- 所需能力类型
- 已注册的能力列表（从 API 获取）

**输出：**
```json
{
  "matched": true,
  "capability_provider": {
    "type": "app",
    "name": "douyin",
    "capabilities": ["navigation", "read", "engagement"],
    "match_score": 0.95,
    "reasoning": "抖音 APP 提供短视频平台的所有能力"
  },
  "alternatives": [
    {
      "type": "app",
      "name": "kuaishou",
      "match_score": 0.85
    }
  ],
  "missing_capabilities": []
}
```

**如果能力不存在：**
```json
{
  "matched": false,
  "missing_capabilities": ["blockchain_trading"],
  "suggestion": "该任务需要区块链交易能力，但当前没有可用的提供者。建议用户安装相关 APP 或注册 MCP 服务。",
  "alternatives": []
}
```

**特性：**
- 动态匹配可用能力
- 支持多种能力来源
- 提供备选方案
- 优雅处理能力缺失

---

### 第 6-11 层：执行层（保持原有逻辑）

- **ContextBuilderAI**：构建任务上下文
- **StrategyAI**：生成策略参数（含 decision_mode）
- **SupervisorAI**：风控监督（条件运行）
- **DecisionAI**：决策下一步（支持批量）
- **ExecutorAI**：执行动作
- **PerceptionAI**：感知判断

---

### 第 12 层：SummarizerAI（总结报告）★ 增强

**职责：**
- 不仅总结执行结果，还生成用户友好的报告
- 支持复杂任务的结论输出
- 提取关键信息和洞察

**输入：**
- 执行日志
- 收集的数据
- 任务目标

**输出（简单任务）：**
```json
{
  "summary": "已成功点赞 20 个美食视频",
  "statistics": {
    "objects_processed": 35,
    "objects_matched": 20,
    "engagements_made": 20
  },
  "report": null
}
```

**输出（复杂任务）：**
```json
{
  "summary": "已完成抖音电商大环境调研",
  "statistics": {
    "videos_analyzed": 28,
    "comments_collected": 156,
    "trends_identified": 5
  },
  "report": {
    "title": "抖音电商大环境分析报告",
    "sections": [
      {
        "heading": "主要趋势",
        "content": "1. 直播带货仍是主流...\n2. 短视频种草快速增长...\n3. 品牌自播成为趋势..."
      },
      {
        "heading": "用户反馈",
        "content": "用户对价格敏感度高，更关注性价比..."
      },
      {
        "heading": "建议",
        "content": "如果你想在抖音电商领域发展，建议..."
      }
    ],
    "key_insights": [
      "直播带货占比 65%",
      "用户平均观看时长 3.5 分钟",
      "高互动视频转化率提升 40%"
    ]
  }
}
```

**特性：**
- 自动识别是否需要生成报告
- 提取关键洞察
- 生成结构化报告

---

## 执行流程示例

### 示例 1：普通对话

**用户输入：** "我喜欢美食和旅游，平时喜欢看轻松幽默的内容"

**流程：**
```
ConversationRouterAI → intent_type: "conversation"
   ↓
DialogAI → 识别用户偏好
   ↓
MemoryLearnerAI → 存储偏好
   ↓
返回：好的，我记住了你的偏好。以后给你推荐内容时，会优先选择美食和旅游相关的轻松内容。
```

---

### 示例 2：简单任务

**用户输入：** "帮我点赞 20 个美食视频"

**流程：**
```
ConversationRouterAI → intent_type: "task"
   ↓
TaskPlannerAI → 单一任务，无需分解
   ↓
CapabilityMatcherAI → 匹配到 douyin APP
   ↓
ContextBuilderAI → 构建上下文
   ↓
StrategyAI → 生成策略（decision_mode: anomaly_only, cache_size: 5）
   ↓
执行循环（SupervisorAI, DecisionAI, ExecutorAI, PerceptionAI）
   ↓
SummarizerAI → 简单总结
   ↓
返回：已成功点赞 20 个美食视频（共处理 35 个视频，匹配率 57%）
```

---

### 示例 3：复杂任务

**用户输入：** "去抖音了解一下关于电商的大环境，并总结报告给我"

**流程：**
```
ConversationRouterAI → intent_type: "task"
   ↓
TaskPlannerAI → 分解为 3 个子任务：
   1. 浏览电商视频
   2. 分析内容和评论
   3. 生成报告
   ↓
CapabilityMatcherAI → 为每个子任务匹配能力
   - 子任务 1: douyin APP
   - 子任务 2: douyin APP
   - 子任务 3: text_generation（本地）
   ↓
执行子任务 1：
   ContextBuilderAI → 电商相关视频
   StrategyAI → 信息收集策略
   执行循环 → 收集 28 个视频 + 156 条评论
   ↓
执行子任务 2：
   PerceptionAI → 分析趋势、提取关键信息
   ↓
执行子任务 3：
   SummarizerAI → 生成详细报告
   ↓
返回：已完成调研，共分析 28 个视频和 156 条评论。主要发现：
[生成的报告内容，包含趋势、用户反馈、建议等]
```

---

## 实现优先级

### Phase 1：核心路由和对话（高优先级）

- [x] ConversationRouterAI
- [ ] DialogAI
- [ ] 增强 MemoryLearnerAI（支持对话场景）

### Phase 2：能力匹配（高优先级）

- [ ] TaskPlannerAI（简化版：单任务）
- [ ] CapabilityMatcherAI
- [ ] 修改 API Server（提供能力列表接口）

### Phase 3：报告生成（中优先级）

- [ ] 增强 SummarizerAI（生成报告）
- [ ] 前端显示报告

### Phase 4：复杂任务（低优先级）

- [ ] TaskPlannerAI（完整版：多任务分解）
- [ ] 子任务调度器

---

## API 变更

### 新增接口

#### 1. 获取所有已注册能力

```http
GET /api/capabilities
```

**响应：**
```json
{
  "capabilities": [
    {
      "provider_type": "app",
      "provider_name": "douyin",
      "category": "short_video_platform",
      "capabilities": {
        "navigation": ["next", "toJingXuan", "search"],
        "read": ["getVideoInfo", "getComments"],
        "engagement": ["digg", "sendComment", "collect"]
      },
      "description": "抖音短视频平台"
    },
    {
      "provider_type": "mcp",
      "provider_name": "weather_api",
      "category": "information_service",
      "capabilities": {
        "read": ["getWeather", "getForecast"]
      },
      "description": "天气查询服务"
    }
  ]
}
```

#### 2. 创建对话（非任务）

```http
POST /api/conversation
```

**请求：**
```json
{
  "message": "我喜欢美食和旅游",
  "conversation_history": [...]
}
```

**响应：**
```json
{
  "response": "好的，我记住了你的偏好",
  "memorized": true
}
```

---

## 总结

### 新架构的优势

✅ **支持普通对话**：不再只能执行任务  
✅ **动态能力匹配**：不再定死 app，支持 MCP 等多种能力  
✅ **优雅处理缺失**：能力不存在时给出建议  
✅ **支持复杂任务**：多步骤任务分解和执行  
✅ **生成报告反馈**：不再执行完就停止  
✅ **保持通用性**：所有逻辑都是通用的，不硬编码  

### 与原架构的兼容性

- 原有的 8 层执行逻辑保持不变
- 只是在前面增加了路由和规划层
- 在后面增强了反馈层
- 现有的 Electron 客户端无需大改

---

## 下一步

我建议按照 Phase 1 开始实现：

1. **ConversationRouterAI**（对话路由）
2. **DialogAI**（对话 AI）
3. **增强 MemoryLearnerAI**

这样用户就可以：
- 与 AI 正常对话
- 记录偏好和习惯
- 为后续任务执行提供更好的上下文

你觉得这个方案如何？需要调整吗？

