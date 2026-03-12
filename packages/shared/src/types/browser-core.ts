/**
 * PolyWebsAI 浏览器核心能力接口定义
 * 参考 MCP chrome-devtools 协议设计
 */

// ============================================
// 基础类型
// ============================================

/** 页面/标签页 ID */
export type PageId = string;

/** 元素唯一标识符 */
export type ElementUid = string;

/** 网络请求 ID */
export type RequestId = number;

/** 控制台消息 ID */
export type MessageId = number;

// ============================================
// 页面管理
// ============================================

/** 页面信息 */
export interface PageInfo {
  id: PageId;
  url: string;
  title: string;
  active: boolean;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

/** 创建新页面的选项 */
export interface NewPageOptions {
  url: string;
  /** 是否在后台打开 */
  background?: boolean;
  /** 隔离上下文名称，用于创建独立的浏览器上下文 */
  isolatedContext?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** 导航选项 */
export interface NavigateOptions {
  /** 导航类型 */
  type: 'url' | 'back' | 'forward' | 'reload';
  /** 目标 URL（仅 type='url' 时需要） */
  url?: string;
  /** 是否忽略缓存（仅 reload 时有效） */
  ignoreCache?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
}

// ============================================
// 元素操作
// ============================================

/** 元素快照信息 */
export interface ElementSnapshot {
  uid: ElementUid;
  role: string;
  name: string;
  value?: string;
  description?: string;
  children?: ElementSnapshot[];
}

/** 页面快照 */
export interface PageSnapshot {
  pageId: PageId;
  url: string;
  title: string;
  timestamp: number;
  root: ElementSnapshot;
}

/** 点击选项 */
export interface ClickOptions {
  uid: ElementUid;
  /** 是否双击 */
  dblClick?: boolean;
  /** 是否返回快照 */
  includeSnapshot?: boolean;
}

/** 填充选项 */
export interface FillOptions {
  uid: ElementUid;
  value: string;
  /** 是否返回快照 */
  includeSnapshot?: boolean;
}

/** 表单填充项 */
export interface FormFillItem {
  uid: ElementUid;
  value: string;
}

/** 悬停选项 */
export interface HoverOptions {
  uid: ElementUid;
  /** 是否返回快照 */
  includeSnapshot?: boolean;
}

/** 按键选项 */
export interface PressKeyOptions {
  /** 按键或组合键，如 "Enter", "Control+A" */
  key: string;
  /** 是否返回快照 */
  includeSnapshot?: boolean;
}

/** 输入文本选项 */
export interface TypeTextOptions {
  text: string;
  /** 输入后按下的键，如 "Enter", "Tab" */
  submitKey?: string;
}

// ============================================
// 截图与快照
// ============================================

/** 截图格式 */
export type ScreenshotFormat = 'png' | 'jpeg' | 'webp';

/** 截图选项 */
export interface ScreenshotOptions {
  /** 截图格式 */
  format?: ScreenshotFormat;
  /** 质量（0-100，仅 jpeg/webp） */
  quality?: number;
  /** 是否全页面截图 */
  fullPage?: boolean;
  /** 指定元素截图 */
  uid?: ElementUid;
  /** 保存路径（不指定则返回 base64） */
  filePath?: string;
}

/** 截图结果 */
export interface ScreenshotResult {
  /** base64 编码的图片数据（未指定 filePath 时） */
  data?: string;
  /** 保存的文件路径（指定 filePath 时） */
  filePath?: string;
  /** 图片宽度 */
  width: number;
  /** 图片高度 */
  height: number;
}

// ============================================
// 脚本执行
// ============================================

/** 脚本执行选项 */
export interface EvaluateOptions {
  /** JavaScript 函数体 */
  function: string;
  /** 函数参数（元素 uid 列表） */
  args?: ElementUid[];
}

/** 脚本执行结果 */
export interface EvaluateResult {
  /** 执行结果（JSON 序列化） */
  result: unknown;
  /** 执行耗时（毫秒） */
  duration: number;
}

// ============================================
// 网络请求
// ============================================

/** 资源类型 */
export type ResourceType =
  | 'document'
  | 'stylesheet'
  | 'image'
  | 'media'
  | 'font'
  | 'script'
  | 'xhr'
  | 'fetch'
  | 'websocket'
  | 'other';

/** 网络请求信息 */
export interface NetworkRequest {
  reqid: RequestId;
  url: string;
  method: string;
  resourceType: ResourceType;
  status?: number;
  statusText?: string;
  /** 响应大小（字节） */
  responseSize?: number;
  /** 请求耗时（毫秒） */
  duration?: number;
}

/** 网络请求详情 */
export interface NetworkRequestDetail extends NetworkRequest {
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: string;
  responseBody?: string;
}

// ============================================
// 控制台
// ============================================

/** 控制台消息类型 */
export type ConsoleMessageType =
  | 'log'
  | 'debug'
  | 'info'
  | 'error'
  | 'warn'
  | 'dir'
  | 'table'
  | 'trace'
  | 'clear';

/** 控制台消息 */
export interface ConsoleMessage {
  msgid: MessageId;
  type: ConsoleMessageType;
  text: string;
  timestamp: number;
  /** 来源 URL */
  url?: string;
  /** 行号 */
  lineNumber?: number;
}

// ============================================
// 等待条件
// ============================================

/** 等待选项 */
export interface WaitForOptions {
  /** 等待出现的文本列表（任一出现即返回） */
  text: string[];
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** 等待结果 */
export interface WaitForResult {
  /** 匹配到的文本 */
  matchedText: string;
  /** 等待耗时（毫秒） */
  duration: number;
}

// ============================================
// 浏览器核心能力接口
// ============================================

/**
 * 浏览器核心能力接口
 * 定义了所有浏览器操作的标准方法
 */
export interface IBrowserCore {
  // ---------- 页面管理 ----------

  /** 获取所有页面列表 */
  listPages(): Promise<PageInfo[]>;

  /** 创建新页面 */
  newPage(options: NewPageOptions): Promise<PageInfo>;

  /** 选择/激活页面 */
  selectPage(pageId: PageId): Promise<void>;

  /** 关闭页面 */
  closePage(pageId: PageId): Promise<void>;

  /** 页面导航 */
  navigate(pageId: PageId, options: NavigateOptions): Promise<void>;

  /** 调整页面大小 */
  resizePage(pageId: PageId, width: number, height: number): Promise<void>;

  // ---------- 元素操作 ----------

  /** 获取页面快照（基于 a11y 树） */
  takeSnapshot(pageId: PageId): Promise<PageSnapshot>;

  /** 点击元素 */
  click(pageId: PageId, options: ClickOptions): Promise<PageSnapshot | void>;

  /** 填充输入框 */
  fill(pageId: PageId, options: FillOptions): Promise<PageSnapshot | void>;

  /** 批量填充表单 */
  fillForm(pageId: PageId, elements: FormFillItem[]): Promise<PageSnapshot | void>;

  /** 悬停元素 */
  hover(pageId: PageId, options: HoverOptions): Promise<PageSnapshot | void>;

  /** 按键 */
  pressKey(pageId: PageId, options: PressKeyOptions): Promise<PageSnapshot | void>;

  /** 输入文本 */
  typeText(pageId: PageId, options: TypeTextOptions): Promise<void>;

  /** 拖拽元素 */
  drag(pageId: PageId, fromUid: ElementUid, toUid: ElementUid): Promise<PageSnapshot | void>;

  // ---------- 截图与快照 ----------

  /** 截图 */
  takeScreenshot(pageId: PageId, options?: ScreenshotOptions): Promise<ScreenshotResult>;

  // ---------- 脚本执行 ----------

  /** 执行 JavaScript */
  evaluate(pageId: PageId, options: EvaluateOptions): Promise<EvaluateResult>;

  // ---------- 网络请求 ----------

  /** 获取网络请求列表 */
  listNetworkRequests(pageId: PageId): Promise<NetworkRequest[]>;

  /** 获取网络请求详情 */
  getNetworkRequest(pageId: PageId, reqid: RequestId): Promise<NetworkRequestDetail>;

  // ---------- 控制台 ----------

  /** 获取控制台消息列表 */
  listConsoleMessages(pageId: PageId): Promise<ConsoleMessage[]>;

  /** 获取控制台消息详情 */
  getConsoleMessage(pageId: PageId, msgid: MessageId): Promise<ConsoleMessage>;

  // ---------- 等待 ----------

  /** 等待文本出现 */
  waitFor(pageId: PageId, options: WaitForOptions): Promise<WaitForResult>;

  /** 等待页面加载完成 */
  waitForPageLoad(pageId: PageId, timeout?: number): Promise<void>;

  // ---------- 文件操作 ----------

  /** 上传文件 */
  uploadFile(pageId: PageId, uid: ElementUid, filePath: string): Promise<void>;

  // ---------- 对话框处理 ----------

  /** 处理浏览器对话框 */
  handleDialog(pageId: PageId, action: 'accept' | 'dismiss', promptText?: string): Promise<void>;
}

// ============================================
// 多实例管理接口
// ============================================

/** 浏览器实例配置 */
export interface BrowserInstanceConfig {
  /** 实例 ID */
  id: string;
  /** 实例名称 */
  name: string;
  /** 用户数据目录（用于隔离缓存） */
  userDataDir: string;
  /** 用户代理 */
  userAgent?: string;
  /** 视口大小 */
  viewport?: {
    width: number;
    height: number;
  };
  /** 代理设置 */
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  /** 是否无头模式 */
  headless?: boolean;
}

/** 浏览器实例状态 */
export interface BrowserInstanceStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  pageCount: number;
  createdAt: number;
  error?: string;
}

/**
 * 浏览器实例管理接口
 * 支持创建和管理多个独立的浏览器实例
 */
export interface IBrowserInstanceManager {
  /** 创建新的浏览器实例 */
  createInstance(config: BrowserInstanceConfig): Promise<IBrowserCore>;

  /** 获取浏览器实例 */
  getInstance(instanceId: string): IBrowserCore | undefined;

  /** 列出所有实例 */
  listInstances(): Promise<BrowserInstanceStatus[]>;

  /** 关闭实例 */
  closeInstance(instanceId: string): Promise<void>;

  /** 关闭所有实例 */
  closeAllInstances(): Promise<void>;
}
