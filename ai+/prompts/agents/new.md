基于这8套提示词作为标准，按照我的需求实现简单的调试例子代码。
通用 8 层 Agent 不变
	•	每个平台 只扩展“执行能力描述 + 决策规则”
	•	Executor Prompt 永远通用
	•	平台差异通过 「能力注册 + Runtime 决策」 注入

Executor 的 Prompt 永远是通用的，
Executor 不应该知道：
	•	这是抖音还是 B 站
	•	这个动作是点赞还是投币
	•	页面结构长什么样

需要一个平台能力注册表（这是核心设计点），App Capability Registry（关键）

比如：
{
  "app": "douyin",
  "capabilities": {
    "navigation": ["next_video", "search"],
    "read": ["getVideoInfo", "getComments"],
    "engagement": ["like", "sendComment"]
  }
}
{
  "app": "bilibili",
  "capabilities": {
    "navigation": ["next_video", "search"],
    "read": ["getVideoInfo", "getComments"],
    "engagement": ["like", "coin", "favorite", "sendComment"]
  }
}

这不是 Prompt，而是配置 / JSON
平台差异真正生效的地方：Strategy AI + Runtime
Strategy AI 做什么？
它只看两样东西：
	1.	task_context（我要干什么）
	2.	app_capabilities（这个平台能干什么）

然后输出：
{
  "preferred_engagement_action": "sendComment",
  "fallback_engagement_action": "like",
  "max_engagement_per_item": 1
}

👉 Strategy 不输出“抖音操作步骤”，
它输出“策略选择结果”


Runtime 决定什么？
Runtime 才是那个真正“平台 aware”的东西。
if strategy.preferred_engagement_action in app.capabilities.engagement:
    action = strategy.preferred_engagement_action
else:
    action = strategy.fallback_engagement_action

👉 所以：
	•	抖音：sendComment
	•	B 站：可能是 coin 或 like

Executor 完全不关心。




这是python伪代码，需要你帮我具体实现：
User Input
 ↓
GlobalIntentAI
 ↓
ContextBuilderAI
 ↓
StrategyAI
 ↓
TaskRuntime (loop)
    ├─ ExecutorAI
    ├─ PerceptionAI
    ├─ SupervisorAI
 ↓
SummarizerAI
 ↓
MemoryLearnerAI



===========================================
AI组件              历史上下文    范围
===========================================
GlobalIntentAI      需要(✓)      跨任务
ContextBuilderAI    部分(⚠️)     仅任务初始化
StrategyAI          部分(⚠️)     跨任务(只读)
TaskRuntime         不需要(✗)    当前任务
ExecutorAI          不需要(✗)    每次调用
PerceptionAI        不需要(✗)    每次调用
SupervisorAI        不需要(✗)    当前任务
SummarizerAI        部分(⚠️)     单次任务
MemoryLearnerAI     需要(✓)      跨任务
===========================================




① GlobalIntentAI（全局意图识别）

是否需要历史上下文？
✅ 需要（跨任务）
用哪些历史？
	•	用户近期对话摘要（不是原文）
	•	用户长期偏好画像
历史作用范围
	•	跨任务
	•	用于判断：
	•	用户真正想做什么
	•	是否是延续需求
什么时候不需要？
	•	❌ 不需要执行历史
	•	❌ 不需要上一个任务的流程细节
一句话记忆规则
它记“人想干什么”，不记“AI 怎么干的”


② ContextBuilderAI（上下文构建 / 任务画像）
是否需要历史上下文？
⚠️ 只在“新任务初始化”时需要
用哪些历史？
	•	GlobalIntentAI 的结构化输出
	•	用户近期任务偏好摘要
	•	长期知识库片段
历史作用范围
	•	仅限当前任务
	•	输出一次性任务画像
什么时候必须清空？
	•	🚫 任务开始后 禁止再调用
	•	🚫 不能参与循环
一句话记忆规则
它是“翻译器”，不是“记忆体”


③ StrategyAI（策略与参数生成）
是否需要历史上下文？
⚠️ 有限需要（跨任务，但只读）
用哪些历史？
	•	任务画像（来自 ContextBuilder）
	•	历史“成功策略快照”（Task Strategy Memory）
	•	用户风格偏好
历史作用范围
	•	跨任务可复用
	•	用于初始化参数
什么时候不需要？
	•	❌ 不需要对话历史
	•	❌ 不需要执行日志
	•	❌ 不需要当前循环状态

一句话记忆规则
它记“哪些参数好用”，不记“过程”



④ TaskRuntime（状态机 / 循环控制）※不是 AI
是否需要历史上下文？
❌ 不需要 AI 历史上下文
它“记”的是什么？
	•	当前任务运行状态（L2）
	•	当前策略参数（L1）
	•	系统硬限制（L0）
作用范围
	•	仅当前任务
	•	任务结束即销毁

一句话规则
它有状态，但不是“记忆”


⑤ ExecutorAI（执行 AI）
是否需要历史上下文？
❌ 绝对不需要
每次调用是否独立？
✅ 完全独立（纯函数）
禁止使用的上下文
	•	🚫 用户对话
	•	🚫 用户偏好
	•	🚫 上一次执行结果（除 progress）

一句话记忆规则
它是“机械手”，不是“大脑”


⑥ PerceptionAI（感知判断）
是否需要历史上下文？
❌ 绝对不需要
每次调用是否独立？
✅ 完全独立（纯函数）
它只能看什么？
	•	当前视频信息
	•	当前评论采样
	•	当前匹配规则
禁止使用的上下文
	•	🚫 用户需求
	•	🚫 用户满意度
	•	🚫 历史视频 / 历史判断

一句话记忆规则
输入相同，输出必须相同



⑦ SupervisorAI（风控 / 监督）
是否需要历史上下文？
❌ 不需要对话历史
它需要什么“状态”？
	•	当前任务运行指标
	•	当前执行频率
	•	系统风控规则
作用范围
	•	仅当前任务
	•	不跨任务学习
一句话规则
它只管“现在危不危险”



⑧ SummarizerAI（总结）
是否需要历史上下文？
⚠️ 仅任务内摘要
用哪些历史？
	•	本次任务的“轻量笔记”
	•	任务画像（可选）
禁止使用
	•	🚫 原始执行日志
	•	🚫 用户对话历史
	•	🚫 其他任务数据
作用范围
	•	一次性
	•	输出完即可丢弃上下文

一句话规则
它总结“结果”，不复盘“过程”



⑨ MemoryLearnerAI（策略 / 记忆学习）
是否需要历史上下文？
✅ 需要（跨任务）
用哪些历史？
	•	本次任务总结
	•	历史成功 / 失败统计
	•	用户显式 / 隐式反馈
它输出什么？
	•	可复用策略参数
	•	用户风格更新
	•	Task Strategy Memory
禁止做的事
	•	🚫 修改当前任务
	•	🚫 即时生效

一句话规则
它负责“下次更好”，不是“这次改”


核心原则：
•	🔒 循环在 TaskRuntime
•	🧠 AI 只给“判断 / 建议 / 执行 JSON”
•	❌ AI 不控制 while / if / break


二、Agent Runtime 主入口（核心）
def run_task(user_message: str):
    # === 1. 全局意图识别 ===
    global_intents = GlobalIntentAI.run(
        user_message=user_message,
        session_memory=load_session_memory(),
        user_profile=load_user_profile()
    )

    # 可能返回多个应用意图
    for intent in global_intents["intents"]:
        run_app_task(intent)

三、应用级任务执行（以抖音为例）
def run_app_task(global_intent: dict):
    # === 2. 构建上下文 ===
    task_context = ContextBuilderAI.run(
        global_intent=global_intent,
        user_request_excerpt=extract_excerpt(global_intent),
        session_memory=load_session_memory(),
        user_profile=load_user_profile(),
        knowledge_snippets=retrieve_knowledge(global_intent)
    )

    # === 3. 策略参数生成 ===
    strategy_params = StrategyAI.run(
        task_context=task_context,
        app_capabilities=get_app_capabilities(global_intent["app"]),
        user_style_profile=load_user_style_profile()
    )

    # === 4. 初始化 Runtime 状态机 ===
    runtime = TaskRuntime(
        task_context=task_context,
        strategy_params=strategy_params,
        hard_limits=load_hard_limits()
    )

    # === 5. 主循环 ===
    while runtime.is_running():
        step(runtime)

    # === 6. 总结 ===
    summary = SummarizerAI.run(
        collected_notes=runtime.collected_notes,
        task_context=task_context
    )

    # === 7. 学习与记忆 ===
    MemoryLearnerAI.run(
        summary=summary,
        runtime_stats=runtime.stats,
        user_feedback=collect_user_feedback()
    )



四、Runtime 单步执行（最重要的部分）
def step(runtime):
    """
    单步执行：
    - 程序决定下一步
    - AI 不参与 while / if
    """

    # === A. Supervisor 风控检查 ===
    control = SupervisorAI.run(
        runtime_state=runtime.state,
        execution_metrics=runtime.metrics,
        risk_policy=runtime.risk_policy
    )

    if control["control"] == "SLEEP":
        sleep(control["duration_seconds"])
        return

    if control["control"] == "STOP":
        runtime.stop(reason=control["reason"])
        return

    # === B. 程序决定下一步动作（不是 AI） ===
    command = runtime.decide_next_action()
    if not command:
        runtime.stop(reason="no_more_actions")
        return

    # === C. 执行动作 ===
    action_result = ActionExecutorAI.run(
        command=command,
        progress=runtime.progress
    )

    # === D. Runtime 吸收执行结果 ===
    runtime.update_from_action(action_result)

    # === E. 感知判断（是否继续） ===
    if action_result.requires_perception:
        perception = PerceptionAI.run(
            video_info=runtime.current_video_info,
            comment_sample=runtime.comment_sample,
            match_rules=runtime.strategy_params
        )
        runtime.update_from_perception(perception)

五、TaskRuntime（状态机核心）
class TaskRuntime:
    def __init__(self, task_context, strategy_params, hard_limits):
        self.task_context = task_context
        self.strategy_params = strategy_params
        self.hard_limits = hard_limits

        self.state = "INIT"
        self.progress = {}
        self.stats = {}
        self.collected_notes = []

        self.current_video_info = None
        self.comment_sample = None

    def is_running(self):
        return self.state not in ("STOPPED", "FINISHED")

    def decide_next_action(self):
        """
        这是整个系统最重要的函数
        —— 只有程序能决定下一步
        """

        if self.reached_target():
            self.state = "FINISHED"
            return None

        if self.need_next_video():
            return {"action": "next", "params": []}

        if self.need_more_comments():
            return {"action": "getComments", "params": [1]}

        if self.should_comment():
            return {
                "action": "sendComment",
                "params": [self.generate_comment(), -1]
            }

        return {"action": "next", "params": []}

    def update_from_action(self, action_result):
        # 更新 video / comments / 计数器
        pass

    def update_from_perception(self, perception):
        self.stats["last_match_score"] = perception["match_score"]
        if perception["should_proceed"]:
            self.collected_notes.append({
                "type": "matched_video",
                "score": perception["match_score"]
            })

    def stop(self, reason):
        self.state = "STOPPED"
        self.stats["stop_reason"] = reason

五、TaskRuntime（状态机核心）
class TaskRuntime:
    def __init__(self, task_context, strategy_params, hard_limits):
        self.task_context = task_context
        self.strategy_params = strategy_params
        self.hard_limits = hard_limits

        self.state = "INIT"
        self.progress = {}
        self.stats = {}
        self.collected_notes = []

        self.current_video_info = None
        self.comment_sample = None

    def is_running(self):
        return self.state not in ("STOPPED", "FINISHED")

    def decide_next_action(self):
        """
        这是整个系统最重要的函数
        —— 只有程序能决定下一步
        """

        if self.reached_target():
            self.state = "FINISHED"
            return None

        if self.need_next_video():
            return {"action": "next", "params": []}

        if self.need_more_comments():
            return {"action": "getComments", "params": [1]}

        if self.should_comment():
            return {
                "action": "sendComment",
                "params": [self.generate_comment(), -1]
            }

        return {"action": "next", "params": []}

    def update_from_action(self, action_result):
        # 更新 video / comments / 计数器
        pass

    def update_from_perception(self, perception):
        self.stats["last_match_score"] = perception["match_score"]
        if perception["should_proceed"]:
            self.collected_notes.append({
                "type": "matched_video",
                "score": perception["match_score"]
            })

    def stop(self, reason):
        self.state = "STOPPED"
        self.stats["stop_reason"] = reason

    
六、8 个 AI 的调用统一形式（示例）
class GlobalIntentAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("global_intent.prompt", inputs)


class ContextBuilderAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("context_builder.prompt", inputs)


class StrategyAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("strategy.prompt", inputs)


class PerceptionAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("perception.prompt", inputs)


class ActionExecutorAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("executor.prompt", inputs)


class SupervisorAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("supervisor.prompt", inputs)


class SummarizerAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("summarizer.prompt", inputs)


class MemoryLearnerAI:
    @staticmethod
    def run(**inputs) -> dict:
        return call_llm("memory_learner.prompt", inputs)