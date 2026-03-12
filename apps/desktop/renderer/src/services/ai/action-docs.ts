/**
 * 操作方法说明文档生成器
 * 生成通用的浏览器操作方法说明文档
 */

/**
 * 生成通用操作方法说明文档
 */
export function generateActionDocs(): string {
  return `
## 浏览器操作方法

### 1. delay - 延迟操作
**描述**: 延迟指定时间
**参数**:
- delay (number, 必需): 延迟时间（毫秒），范围：0-60000
**示例**:
\`\`\`json
{
  "type": "execute",
  "action": "delay",
  "params": { "delay": 1000 }
}
\`\`\`

### 2. getBrowserInfo - 获取浏览器信息
**描述**: 获取当前标签页的基本信息
**参数**: 无
**返回**: { tabId, title, url, active, loading, canGoBack, canGoForward }

### 3. waitForPageLoad - 等待页面加载
**描述**: 等待页面加载完成
**参数**:
- timeout (number, 可选): 超时时间（毫秒），默认10000

### 4. scrollPage - 滚动页面
**描述**: 滚动页面到指定位置
**参数**:
- x (number, 可选): 水平滚动位置
- y (number, 可选): 垂直滚动位置
- behavior (string, 可选): 'auto' 或 'smooth'

### 5. getElementInfo - 获取元素信息
**描述**: 根据CSS选择器获取页面元素信息
**参数**:
- selector (string, 必需): CSS选择器
`;
}
