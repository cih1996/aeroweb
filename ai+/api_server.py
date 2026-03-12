#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Agent 系统 API 服务器

提供：
1. APP 能力注册 API
2. 任务执行 API
3. 任务状态查询 API
4. 通过回调 URL 执行远程 APP 能力
"""

import sys
import os
import uuid
import time
import asyncio
import requests
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from threading import Thread

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent_system.core.orchestrator import AgentOrchestrator
from agent_system.app_handlers.base import BaseAppHandler, ActionResult
from agent_system.app_handlers.registry import AppRegistry
from agent_system.agents.base import BaseAgent


# ============================================================================
# 日志系统配置
# ============================================================================

# 创建日志目录
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# 配置基础日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class TaskLogger:
    """任务执行日志记录器"""
    
    def __init__(self, task_id: str):
        self.task_id = task_id
        self.log_file = LOGS_DIR / f"task_{task_id}.log"
        self.json_file = LOGS_DIR / f"task_{task_id}.json"
        self.log_entries = []
        self.step_counter = 0
        
        # 初始化日志文件
        with open(self.log_file, 'w', encoding='utf-8') as f:
            f.write(f"{'='*80}\n")
            f.write(f"任务执行日志 - Task ID: {task_id}\n")
            f.write(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"{'='*80}\n\n")
    
    def log(self, category: str, title: str, data: Dict[str, Any] = None, level: str = "INFO"):
        """记录日志条目"""
        self.step_counter += 1
        
        entry = {
            "step": self.step_counter,
            "timestamp": datetime.now().isoformat(),
            "category": category,
            "title": title,
            "level": level,
            "data": data or {}
        }
        
        self.log_entries.append(entry)
        
        # 写入文本日志
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n{'='*80}\n")
            f.write(f"[步骤 {self.step_counter}] {category} - {title}\n")
            f.write(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"级别: {level}\n")
            if data:
                f.write(f"\n数据:\n")
                f.write(json.dumps(data, ensure_ascii=False, indent=2))
                f.write("\n")
            f.write(f"{'='*80}\n")
        
        # 实时保存 JSON
        self._save_json()
    
    def log_error(self, category: str, title: str, error: Exception, context: Dict[str, Any] = None):
        """记录错误"""
        data = {
            "error_type": type(error).__name__,
            "error_message": str(error),
            "context": context or {}
        }
        self.log(category, title, data, level="ERROR")
    
    def log_capabilities(self, app_name: str, capabilities: Dict[str, Any]):
        """记录注册的能力"""
        self.log(
            "APP_CAPABILITIES",
            f"应用 '{app_name}' 的能力列表",
            {
                "app_name": app_name,
                "capabilities": capabilities,
                "total_count": sum(len(v) for v in capabilities.values()) if isinstance(capabilities, dict) else 0
            }
        )
    
    def log_decision(self, agent: str, decision: Dict[str, Any], context: Dict[str, Any] = None):
        """记录 AI 决策"""
        self.log(
            "AI_DECISION",
            f"{agent} 做出决策",
            {
                "agent": agent,
                "decision": decision,
                "context": context or {}
            }
        )
    
    def log_action_execution(self, action: str, action_type: str, params: List[Any], 
                            result: Dict[str, Any], duration_ms: float):
        """记录动作执行"""
        self.log(
            "ACTION_EXECUTION",
            f"执行动作: {action}",
            {
                "action": action,
                "action_type": action_type,
                "params": params,
                "result": result,
                "success": result.get("success", False),
                "duration_ms": duration_ms
            },
            level="INFO" if result.get("success") else "WARNING"
        )
    
    def log_supervisor(self, control: str, reason: str, runtime_state: Dict[str, Any]):
        """记录监督决策"""
        self.log(
            "SUPERVISOR",
            f"监督决策: {control}",
            {
                "control": control,
                "reason": reason,
                "runtime_state": runtime_state
            },
            level="WARNING" if control in ["STOP", "ALERT"] else "INFO"
        )
    
    def log_loop_iteration(self, iteration: int, state: Dict[str, Any]):
        """记录循环迭代"""
        self.log(
            "LOOP_ITERATION",
            f"主循环第 {iteration} 次迭代",
            {
                "iteration": iteration,
                "state": state
            }
        )
    
    def finalize(self, status: str, result: Any = None, error: str = None):
        """完成日志记录"""
        with open(self.log_file, 'a', encoding='utf-8') as f:
            f.write(f"\n\n{'='*80}\n")
            f.write(f"任务执行完成\n")
            f.write(f"最终状态: {status}\n")
            f.write(f"结束时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"总步骤数: {self.step_counter}\n")
            if result:
                f.write(f"\n结果:\n{json.dumps(result, ensure_ascii=False, indent=2)}\n")
            if error:
                f.write(f"\n错误: {error}\n")
            f.write(f"{'='*80}\n")
        
        self._save_json()
        
        print(f"📝 任务日志已保存: {self.log_file}")
    
    def _save_json(self):
        """保存 JSON 格式日志"""
        with open(self.json_file, 'w', encoding='utf-8') as f:
            json.dump({
                "task_id": self.task_id,
                "total_steps": self.step_counter,
                "entries": self.log_entries
            }, f, ensure_ascii=False, indent=2)


# ============================================================================
# Pydantic 模型定义
# ============================================================================

class AppCapabilityModel(BaseModel):
    """APP 能力模型"""
    name: str = Field(..., description="能力名称")
    type: str = Field(..., description="能力类型：navigation/read/analyze/engage/control")
    description: str = Field(..., description="能力描述")
    params: List[str] = Field(default_factory=list, description="参数列表")


class RegisterAppRequest(BaseModel):
    """注册 APP 请求"""
    app_name: str = Field(..., description="APP 名称，如 'douyin'")
    callback_url: str = Field(..., description="回调 URL，用于执行能力")
    capabilities: List[AppCapabilityModel] = Field(..., description="能力列表")
    timeout: int = Field(default=30, description="回调超时时间（秒）")


class ExecuteActionRequest(BaseModel):
    """执行动作请求（Agent 系统调用远程 APP）"""
    action: str = Field(..., description="动作名称")
    params: List[Any] = Field(default_factory=list, description="参数列表")


class ExecuteActionResponse(BaseModel):
    """执行动作响应（远程 APP 返回）"""
    success: bool = Field(..., description="是否成功")
    data: Dict[str, Any] = Field(default_factory=dict, description="返回数据")
    message: str = Field(default="", description="消息")


class TaskRequest(BaseModel):
    """任务请求"""
    message: str = Field(..., description="用户消息")
    enable_interaction: bool = Field(default=False, description="是否启用人机交互")


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str  # pending/running/completed/failed/waiting_interaction
    progress: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    token_stats: Optional[Dict[str, Any]] = None
    execution_log: Optional[List[Dict[str, Any]]] = None  # 新增：执行日志
    interaction_required: Optional[bool] = None  # 新增：是否需要人机交互
    interaction_data: Optional[Dict[str, Any]] = None  # 新增：交互数据


# ============================================================================
# 远程 APP Handler（通过 HTTP 回调）
# ============================================================================

class RemoteAppHandler(BaseAppHandler):
    """
    远程 APP Handler
    
    通过 HTTP 回调的方式执行远程 APP 的能力
    """
    
    def __init__(self, app_name: str, callback_url: str, capabilities: List[AppCapabilityModel], timeout: int = 30):
        """
        初始化远程 APP Handler
        
        Args:
            app_name: APP 名称
            callback_url: 回调 URL
            capabilities: 能力列表
            timeout: 请求超时时间
        """
        self._app_name = app_name
        self.callback_url = callback_url.rstrip('/')
        self.timeout = timeout
        self._raw_capabilities = capabilities
        
        # 调用父类初始化（会调用 register_capabilities）
        super().__init__()
        
        print(f"✓ [RemoteAppHandler] 已初始化: {app_name}")
        print(f"  回调 URL: {callback_url}")
        print(f"  能力数量: {len(capabilities)}")
    
    def register_capabilities(self):
        """注册能力（实现抽象方法）"""
        from agent_system.app_handlers.base import AppCapability
        
        cap = AppCapability(self._app_name)
        
        # 根据类型分类注册能力
        for capability in self._raw_capabilities:
            cap_type = capability.type.lower()
            
            if cap_type == "navigation":
                cap.add_navigation(
                    capability.name,
                    capability.params,
                    capability.description
                )
            elif cap_type == "read":
                cap.add_read(
                    capability.name,
                    capability.params,
                    capability.description
                )
            elif cap_type in ["engage", "engagement"]:
                cap.add_engagement(
                    capability.name,
                    capability.params,
                    capability.description
                )
            else:
                # 默认归类到 read
                cap.add_read(
                    capability.name,
                    capability.params,
                    capability.description
                )
        
        return cap
    
    def execute(self, action: str, params: List[Any]) -> ActionResult:
        """
        执行动作（通过 HTTP 回调）- 实现抽象方法
        
        Args:
            action: 动作名称
            params: 参数列表
        
        Returns:
            执行结果（自动生成 metadata）
        """
        start_time = time.time()
        
        # 检查动作是否在注册的能力中
        action_type = self.get_action_type(action)
        if action_type is None:
            error_msg = f"动作 '{action}' 不在已注册的能力列表中"
            available_actions = []
            for cap_type, actions in self.get_capabilities().items():
                available_actions.extend(actions.keys())
            
            print(f"❌ [RemoteAppHandler] {error_msg}")
            print(f"   可用的动作: {', '.join(available_actions)}")
            
            return ActionResult(
                success=False,
                action=action,
                error=f"{error_msg}。可用动作: {', '.join(available_actions)}"
            )
        
        try:
            # 构建请求
            url = f"{self.callback_url}/execute"
            payload = {
                "action": action,
                "params": params
            }
            
            print(f"[RemoteAppHandler] 回调执行: {action} (类型: {action_type})")
            
            # 发送 HTTP 请求
            response = requests.post(
                url,
                json=payload,
                timeout=self.timeout
            )
            
            duration_ms = (time.time() - start_time) * 1000
            
            if response.status_code != 200:
                error_msg = f"回调失败，状态码: {response.status_code}"
                print(f"❌ [RemoteAppHandler] {error_msg} (耗时: {duration_ms:.1f}ms)")
                return ActionResult(
                    success=False,
                    action=action,
                    error=error_msg
                )
            
            # 解析响应
            result_data = response.json()
            raw_data = result_data.get("data", None)
            
            # 🔧 根本性修复：标准化数据格式
            # 如果 data 是列表，包装成 {"items": [...]}
            # 这样所有后续代码都可以安全地使用 .get()
            if isinstance(raw_data, list):
                standardized_data = {"items": raw_data}
            elif isinstance(raw_data, dict):
                standardized_data = raw_data
            elif raw_data is None:
                standardized_data = {}
            else:
                # 其他类型（字符串、数字等）包装成 {"value": ...}
                standardized_data = {"value": raw_data}
            
            # 根据动作类型自动生成 metadata
            metadata = self._generate_metadata(action_type, action, standardized_data, raw_data)
            
            success = result_data.get("success", False)
            status = "✓" if success else "✗"
            print(f"{status} [RemoteAppHandler] {action} 完成 (耗时: {duration_ms:.1f}ms)")
            
            return ActionResult(
                success=success,
                action=action,
                data=standardized_data,  # 使用标准化后的数据
                message=result_data.get("message", "OK"),
                metadata=metadata
            )
        
        except requests.Timeout:
            duration_ms = (time.time() - start_time) * 1000
            error_msg = f"回调超时（{self.timeout}秒）"
            print(f"⏱️ [RemoteAppHandler] {action} {error_msg} (耗时: {duration_ms:.1f}ms)")
            return ActionResult(
                success=False,
                action=action,
                error=error_msg
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            error_msg = f"回调出错: {str(e)}"
            print(f"❌ [RemoteAppHandler] {action} {error_msg} (耗时: {duration_ms:.1f}ms)")
            return ActionResult(
                success=False,
                action=action,
                error=error_msg
            )
    
    def _generate_metadata(self, action_type: str, action: str, 
                          standardized_data: Dict, raw_data: Any) -> Dict[str, Any]:
        """
        根据动作类型自动生成 metadata（通用化处理）
        
        Args:
            action_type: 动作类型（navigation/read/engagement）
            action: 动作名称
            standardized_data: 标准化后的数据（字典格式）
            raw_data: 原始数据（可能是列表、字典等）
        
        Returns:
            metadata 字典
        """
        metadata = {}
        
        if action_type == "navigation":
            # 导航类动作：提供新对象信息（使用标准化数据）
            if standardized_data:
                metadata["new_object"] = standardized_data
        
        elif action_type == "read":
            # 读取类动作：提供上下文数据（使用原始数据，保持列表格式）
            if raw_data is not None:
                # 对于 read 类型，优先使用原始的列表格式
                if isinstance(raw_data, list):
                    metadata["context_data"] = raw_data
                elif isinstance(raw_data, dict):
                    metadata["context_data"] = raw_data
                else:
                    metadata["context_data"] = standardized_data
        
        elif action_type == "engagement":
            # 互动类动作：增加互动计数
            metadata["progress_delta"] = {"engagements_made": 1}
        
        return metadata


# ============================================================================
# 任务管理器
# ============================================================================

class TaskManager:
    """任务管理器（管理任务状态）"""
    
    def __init__(self):
        self.tasks: Dict[str, Dict[str, Any]] = {}
        self.task_loggers: Dict[str, TaskLogger] = {}  # 任务日志记录器
    
    def create_task(self, message: str, enable_interaction: bool) -> str:
        """创建任务"""
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = {
            "task_id": task_id,
            "message": message,
            "enable_interaction": enable_interaction,
            "status": "pending",
            "progress": {},
            "result": None,
            "error": None,
            "token_stats": None,
            "execution_log": [],  # 新增：执行日志
            "interaction_required": False,  # 新增：是否需要交互
            "interaction_data": None,  # 新增：交互数据
            "user_choice": None,  # 新增：用户选择
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        
        # 创建任务日志记录器
        logger = TaskLogger(task_id)
        self.task_loggers[task_id] = logger
        logger.log("TASK_CREATED", "任务创建", {
            "task_id": task_id,
            "message": message,
            "enable_interaction": enable_interaction
        })
        
        return task_id
    
    def get_logger(self, task_id: str) -> Optional[TaskLogger]:
        """获取任务日志记录器"""
        return self.task_loggers.get(task_id)
    
    def update_status(self, task_id: str, status: str, **kwargs):
        """更新任务状态"""
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = status
            self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
            self.tasks[task_id].update(kwargs)
    
    def add_execution_log(self, task_id: str, log_entry: Dict[str, Any]):
        """添加执行日志"""
        if task_id in self.tasks:
            if "execution_log" not in self.tasks[task_id]:
                self.tasks[task_id]["execution_log"] = []
            self.tasks[task_id]["execution_log"].append({
                **log_entry,
                "timestamp": datetime.now().isoformat()
            })
            self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
    
    def set_interaction_required(self, task_id: str, interaction_data: Dict[str, Any]):
        """设置需要人机交互"""
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = "waiting_interaction"
            self.tasks[task_id]["interaction_required"] = True
            self.tasks[task_id]["interaction_data"] = interaction_data
            self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
    
    def set_user_choice(self, task_id: str, choice: Any):
        """设置用户选择"""
        if task_id in self.tasks:
            self.tasks[task_id]["user_choice"] = choice
            self.tasks[task_id]["interaction_required"] = False
            self.tasks[task_id]["status"] = "running"
            self.tasks[task_id]["updated_at"] = datetime.now().isoformat()
    
    def get_user_choice(self, task_id: str) -> Optional[Any]:
        """获取用户选择"""
        if task_id in self.tasks:
            return self.tasks[task_id].get("user_choice")
        return None
    
    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务"""
        return self.tasks.get(task_id)


# ============================================================================
# FastAPI 应用
# ============================================================================

app = FastAPI(
    title="AI Agent 系统 API",
    description="基于 8 层 Agent 架构的智能任务执行系统",
    version="1.0.0"
)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局变量
task_manager = TaskManager()
registered_apps: Dict[str, RemoteAppHandler] = {}


# ============================================================================
# API 端点
# ============================================================================

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": "AI Agent 系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "registered_apps": list(registered_apps.keys())
    }


@app.post("/api/register_app")
async def register_app(request: RegisterAppRequest):
    """
    注册 APP 能力
    
    调用方需要提供：
    1. APP 名称
    2. 回调 URL（Agent 系统会调用此 URL 来执行能力）
    3. 能力列表
    """
    try:
        # 创建远程 APP Handler
        handler = RemoteAppHandler(
            app_name=request.app_name,
            callback_url=request.callback_url,
            capabilities=request.capabilities,
            timeout=request.timeout
        )
        
        # 注册到 AppRegistry
        AppRegistry.register(request.app_name, handler)
        registered_apps[request.app_name] = handler
        
        return {
            "success": True,
            "message": f"APP '{request.app_name}' 注册成功",
            "app_name": request.app_name,
            "capabilities_count": len(request.capabilities)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")


@app.get("/api/apps")
async def list_apps():
    """列出已注册的 APP"""
    apps = []
    for app_name, handler in registered_apps.items():
        apps.append({
            "app_name": app_name,
            "callback_url": handler.callback_url,
            "capabilities_count": len(handler.get_capabilities()),
            "capabilities": [
                {
                    "name": cap.name,
                    "type": cap.type,
                    "description": cap.description
                }
                for cap in handler.get_capabilities()
            ]
        })
    
    return {
        "success": True,
        "apps": apps
    }


@app.get("/api/capabilities")
async def get_capabilities():
    """
    获取所有已注册的能力提供者（格式化用于 CapabilityMatcherAI）
    
    响应格式:
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
            }
        ]
    }
    """
    providers = []
    
    for app_name, handler in registered_apps.items():
        # 根据 app_name 推断 category
        category = _infer_category(app_name)
        
        # 按类型分组能力
        capabilities_by_type = {}
        for cap in handler.get_capabilities():
            cap_type = cap.type
            if cap_type not in capabilities_by_type:
                capabilities_by_type[cap_type] = []
            capabilities_by_type[cap_type].append(cap.name)
        
        provider = {
            "provider_type": "app",
            "provider_name": app_name,
            "category": category,
            "capabilities": capabilities_by_type,
            "description": f"{app_name} 应用"
        }
        
        providers.append(provider)
    
    return {
        "success": True,
        "capabilities": providers
    }


def _infer_category(app_name: str) -> str:
    """根据 app 名称推断类别"""
    short_video_apps = ["douyin", "tiktok", "kuaishou"]
    long_video_apps = ["bilibili", "youtube"]
    social_apps = ["weibo", "twitter", "facebook"]
    ecommerce_apps = ["taobao", "jd", "pinduoduo"]
    
    app_lower = app_name.lower()
    
    if app_lower in short_video_apps:
        return "short_video_platform"
    elif app_lower in long_video_apps:
        return "long_video_platform"
    elif app_lower in social_apps:
        return "social_media"
    elif app_lower in ecommerce_apps:
        return "e_commerce"
    else:
        return "unknown"


@app.post("/api/task")
async def create_task(request: TaskRequest, background_tasks: BackgroundTasks):
    """
    创建并执行任务
    
    任务会在后台执行，可以通过 task_id 查询状态
    """
    # 创建任务
    task_id = task_manager.create_task(
        message=request.message,
        enable_interaction=request.enable_interaction
    )
    
    # 在后台执行任务
    background_tasks.add_task(execute_task_background, task_id)
    
    return {
        "success": True,
        "task_id": task_id,
        "message": "任务已创建，正在后台执行",
        "status_url": f"/api/task/{task_id}"
    }


@app.get("/api/task/{task_id}")
async def get_task_status(task_id: str):
    """查询任务状态"""
    task = task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return {
        "success": True,
        **task
    }


@app.post("/api/task/{task_id}/cancel")
async def cancel_task(task_id: str):
    """取消任务（暂未实现）"""
    task = task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    # TODO: 实现任务取消逻辑
    
    return {
        "success": False,
        "message": "任务取消功能暂未实现"
    }


@app.post("/api/task/{task_id}/interact")
async def submit_interaction(task_id: str, choice: Dict[str, Any]):
    """
    提交用户交互选择
    
    请求格式:
    {
        "choice": "用户选择的值"
    }
    """
    task = task_manager.get_task(task_id)
    
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if not task.get("interaction_required"):
        raise HTTPException(status_code=400, detail="任务不需要交互")
    
    # 设置用户选择
    task_manager.set_user_choice(task_id, choice.get("choice"))
    
    return {
        "success": True,
        "message": "已接收用户选择"
    }


# ============================================================================
# 对话接口
# ============================================================================

class ConversationRequest(BaseModel):
    """对话请求"""
    message: str = Field(..., description="用户消息")
    conversation_history: List[Dict[str, str]] = Field(default=[], description="对话历史")


class ConversationResponse(BaseModel):
    """对话响应"""
    response: str = Field(..., description="AI 回复")
    memorized: bool = Field(default=False, description="是否记录了新信息")
    suggestions: List[str] = Field(default=[], description="建议")


@app.post("/api/conversation", response_model=ConversationResponse)
async def handle_conversation(request: ConversationRequest):
    """
    处理对话（非任务执行）
    
    请求格式:
    {
        "message": "用户消息",
        "conversation_history": [
            {"role": "user", "content": "..."},
            {"role": "assistant", "content": "..."}
        ]
    }
    
    响应格式:
    {
        "response": "AI 回复",
        "memorized": true/false,
        "suggestions": ["建议1", "建议2"]
    }
    """
    try:
        from agent_system.agents.conversation_router import ConversationRouterAI
        from agent_system.agents.dialog import DialogAI
        from agent_system.agents.memory_learner import MemoryLearnerAI
        
        print(f"\n{'='*80}")
        print(f"[对话请求] 用户消息: {request.message}")
        print(f"{'='*80}")
        
        # 1. 路由判断
        router_result = ConversationRouterAI.run(
            user_message=request.message,
            conversation_history=request.conversation_history
        )
        
        intent_type = router_result.get("intent_type")
        
        # 如果是任务模式，返回提示
        if intent_type == "task":
            return ConversationResponse(
                response="我发现你好像想让我执行任务。请通过任务接口（/api/task）来执行任务，这里只处理普通对话。",
                memorized=False,
                suggestions=["使用任务接口执行此请求"]
            )
        
        # 2. 对话处理
        dialog_result = DialogAI.run(
            user_message=request.message,
            conversation_history=request.conversation_history,
            router_info=router_result.get("extracted_info")
        )
        
        response_text = dialog_result.get("response", "")
        should_memorize = dialog_result.get("should_memorize", False)
        memory_data = dialog_result.get("memory_data")
        suggestions = dialog_result.get("suggestions", [])
        
        # 3. 存储记忆（如果需要）
        memorized = False
        if should_memorize and memory_data:
            memorized = MemoryLearnerAI.store_conversation_memory(memory_data)
        
        return ConversationResponse(
            response=response_text,
            memorized=memorized,
            suggestions=suggestions
        )
    
    except Exception as e:
        print(f"❌ [对话处理失败] {e}")
        import traceback
        traceback.print_exc()
        
        return ConversationResponse(
            response="抱歉，我遇到了一些问题，请稍后再试。",
            memorized=False,
            suggestions=[]
        )


# ============================================================================
# 后台任务执行
# ============================================================================

def execute_task_background(task_id: str):
    """后台执行任务"""
    logger = task_manager.get_logger(task_id)
    
    try:
        task = task_manager.get_task(task_id)
        if not task:
            return
        
        # 更新状态为运行中
        task_manager.update_status(task_id, "running")
        logger.log("TASK_START", "开始执行任务", {
            "message": task["message"],
            "enable_interaction": task["enable_interaction"]
        })
        
        # 记录所有已注册的 APP 和能力
        registered_apps_info = {}
        for app_name in AppRegistry.list_apps():
            capabilities = AppRegistry.get_capabilities(app_name)
            registered_apps_info[app_name] = capabilities
            logger.log_capabilities(app_name, capabilities)
        
        # 重置 token 统计
        BaseAgent.reset_token_stats()
        
        # 创建增强的日志回调函数
        def log_callback(log_entry):
            """记录执行日志到前端和文件"""
            task_manager.add_execution_log(task_id, log_entry)
            
            # 根据日志类型记录到文件
            agent = log_entry.get("agent", "Unknown")
            action = log_entry.get("action", "")
            details = log_entry.get("details", {})
            
            if agent == "DecisionAI" and action == "decision":
                # 记录决策
                logger.log_decision(
                    agent,
                    {
                        "action_type": details.get("action_type"),
                        "action": details.get("action"),
                        "params": details.get("params"),
                        "reason": details.get("reason")
                    },
                    {"progress": details.get("progress")}
                )
            
            elif agent == "SupervisorAI":
                # 记录监督
                logger.log_supervisor(
                    details.get("control", "UNKNOWN"),
                    details.get("reason", ""),
                    details.get("runtime_state", {})
                )
            
            elif agent == "ExecutorAI":
                # 记录执行
                if action == "success":
                    logger.log(
                        "ACTION_RESULT",
                        f"动作执行成功: {details.get('action')}",
                        details,
                        level="INFO"
                    )
                elif action == "error":
                    logger.log(
                        "ACTION_RESULT",
                        f"动作执行失败: {details.get('action')}",
                        details,
                        level="ERROR"
                    )
            
            else:
                # 其他日志
                logger.log(
                    "AGENT_LOG",
                    f"{agent} - {action}",
                    details
                )
        
        # 创建交互回调函数
        def interaction_callback(interaction_data):
            """当需要人机交互时调用"""
            logger.log("INTERACTION_REQUIRED", "需要人机交互", interaction_data)
            task_manager.set_interaction_required(task_id, interaction_data)
            
            # 等待用户选择
            import time
            max_wait_time = 300  # 最多等待5分钟
            wait_interval = 1  # 每秒检查一次
            elapsed = 0
            
            while elapsed < max_wait_time:
                choice = task_manager.get_user_choice(task_id)
                if choice is not None:
                    logger.log("USER_CHOICE", "用户做出选择", {"choice": choice})
                    # 清除用户选择，为下次交互准备
                    task_manager.tasks[task_id]["user_choice"] = None
                    return choice
                time.sleep(wait_interval)
                elapsed += wait_interval
            
            # 超时，返回 None
            logger.log("INTERACTION_TIMEOUT", "用户交互超时", {"waited_seconds": max_wait_time}, level="WARNING")
            return None
        
        # 创建 orchestrator（传入日志回调和交互回调）
        logger.log("ORCHESTRATOR_START", "创建 Orchestrator", {
            "enable_interaction": task["enable_interaction"]
        })
        
        orchestrator = AgentOrchestrator(
            enable_interaction=task["enable_interaction"],
            log_callback=log_callback,
            interaction_callback=interaction_callback
        )
        
        # 执行任务（注意：这里是同步调用）
        orchestrator.run_task(task["message"])
        
        # 获取 token 统计
        token_stats = BaseAgent.get_all_token_stats()
        logger.log("TOKEN_STATS", "Token 使用统计", token_stats)
        
        # 更新状态为完成
        task_manager.update_status(
            task_id,
            "completed",
            result={"message": "任务执行完成"},
            token_stats=token_stats
        )
        
        logger.finalize("completed", result={"message": "任务执行完成"})
    
    except Exception as e:
        # 更新状态为失败
        task_manager.update_status(
            task_id,
            "failed",
            error=str(e)
        )
        print(f"❌ [TaskManager] 任务执行失败: {e}")
        
        if logger:
            import traceback
            logger.log_error("TASK_FAILED", "任务执行失败", e, {
                "traceback": traceback.format_exc()
            })
            logger.finalize("failed", error=str(e))


# ============================================================================
# 启动服务器
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    print("""
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║           🚀 AI Agent 系统 API 服务器                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    """)
    
    print("📡 启动服务器...")
    print("📚 API 文档: http://localhost:8000/docs")
    print("🔍 交互式文档: http://localhost:8000/redoc")
    print()
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

