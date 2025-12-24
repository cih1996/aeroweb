/**
 * 操作方法说明文档生成器
 * 根据 appId 动态生成可用的操作方法说明文档
 */

/**
 * 生成通用操作方法说明文档
 */
export function generateCommonActionDocs(): string {
  return `
## 通用操作方法（适用于所有应用）

### 1. delay - 延迟操作
**描述**: 延迟指定时间，用于限制操作频率，避免操作过于频繁
**参数**: 
- delay (number, 必需): 延迟时间（毫秒），范围：0-60000
**返回**: 延迟完成的结果
**示例**: 
\`\`\`json
{
  "type": "execute",
  "action": "delay",
  "params": {
    "delay": 1000
  }
}
\`\`\`
**使用场景**: 在执行多个操作之间添加延迟，避免操作过快被限制

### 2. getBrowserInfo - 获取浏览器信息
**描述**: 获取当前浏览器标签页的基本信息，包括标题、URL、加载状态等
**参数**: 无
**返回**: 浏览器信息对象，包含：
- tabId: 标签页ID
- title: 页面标题
- url: 当前URL
- active: 是否激活
- appId: 应用ID
- loading: 是否正在加载
- canGoBack: 是否可以后退
- canGoForward: 是否可以前进
**示例**: 
\`\`\`json
{
  "type": "execute",
  "action": "getBrowserInfo",
  "params": {}
}
\`\`\`
**使用场景**: 检查当前页面状态，确认页面是否加载完成，获取页面信息

### 3. waitForPageLoad - 等待页面加载
**描述**: 等待页面加载完成
**参数**: 
- timeout (number, 可选): 超时时间（毫秒），默认10000
**返回**: 加载状态
**示例**: 
\`\`\`json
{
  "type": "execute",
  "action": "waitForPageLoad",
  "params": {
    "timeout": 5000
  }
}
\`\`\`
**使用场景**: 在页面跳转后等待页面完全加载完成

### 4. scrollPage - 滚动页面
**描述**: 滚动页面到指定位置
**参数**: 
- x (number, 可选): 水平滚动位置
- y (number, 可选): 垂直滚动位置
- behavior (string, 可选): 滚动行为，'auto' 或 'smooth'，默认 'smooth'
**返回**: 滚动结果和当前位置
**示例**: 
\`\`\`json
{
  "type": "execute",
  "action": "scrollPage",
  "params": {
    "y": 500,
    "behavior": "smooth"
  }
}
\`\`\`
**使用场景**: 滚动页面以加载更多内容或查看特定区域

### 5. getElementInfo - 获取元素信息
**描述**: 根据CSS选择器获取页面元素信息
**参数**: 
- selector (string, 必需): CSS选择器
**返回**: 元素信息，包含找到的元素数量、标签名、文本内容等
**示例**: 
\`\`\`json
{
  "type": "execute",
  "action": "getElementInfo",
  "params": {
    "selector": ".video-item"
  }
}
\`\`\`
**使用场景**: 检查页面中是否存在特定元素，获取元素信息
`;
}

/**
 * 生成抖音操作方法说明文档
 */
export function generateDouyinActionDocs(): string {
  return `
## 抖音专用操作方法

### 1. getVideoInfo - 获取视频信息
**描述**: 获取当前播放视频的详细信息
**参数**: 无

### 2. digg - 点赞视频
**描述**: 对当前视频进行点赞操作
**参数**: 无

### 3. next - 下一条视频
**描述**: 切换到下一条视频
**参数**: 无

### 4. toJingXuan - 前往精选区
**描述**: 跳转到视频精选区
**参数**: 无


### 5. getComments - 获取评论
**描述**: 获取当前视频的评论列表
**参数**: 
- pageCount (number, 可选): 翻页次数，0则不翻页，提供参数后会先翻页在一次性获取多条评论，默认为0


### 6. sendComment - 发送评论
**描述**: 发送评论到当前视频
**参数**: 
- commentText (string, 必需): 评论内容
- commentIndex (number, 可选): 回复索引，-1表示不回复，默认为-1
`;
}

/**
 * 根据 appId 生成操作方法说明文档
 */
export function generateActionDocs(appId: string): string {
  // 通用操作方法（所有应用都可用）
  const commonDocs = generateCommonActionDocs();
  
  // 应用特定的操作方法
  let appSpecificDocs = '';
  switch (appId) {
    case 'douyin':
    case 'tiktok':
      appSpecificDocs = generateDouyinActionDocs();
      break;
    default:
      appSpecificDocs = '';
  }
  
  // 合并通用和特定操作方法
  if (appSpecificDocs) {
    return `${commonDocs}\n\n${appSpecificDocs}`;
  }
  return commonDocs;
}

