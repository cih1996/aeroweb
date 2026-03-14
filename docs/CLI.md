# PolyWebsAI CLI 操作手册

## 概述

PolyWebsAI 提供两种 AI 调用方式：
- **CLI**: 命令行工具，适合脚本和自动化
- **MCP Server**: Model Context Protocol，适合 AI Agent 直接调用

## 环境配置

```bash
# 设置 API 服务地址（默认 127.0.0.1:9528）
export POLYWEB_HOST=127.0.0.1
export POLYWEB_PORT=9528
```

## CLI 命令

### 全局选项

```bash
polyweb [options] <command>

选项:
  -f, --format <type>  输出格式 (json|text)，默认 json
  -q, --quiet          静默模式
  -V, --version        版本号
  -h, --help           帮助
```

---

### Tab 管理

#### 列出所有 Tab
```bash
polyweb tab list
polyweb tab ls

输出字段: id, title, url, active
```

#### 打开新 Tab
```bash
polyweb tab new <url> [options]

选项:
  -n, --name <name>  Tab 名称

示例:
  polyweb tab new https://example.com
  polyweb tab new https://google.com -n "搜索"
```

#### 关闭 Tab
```bash
polyweb tab close <tabId>

示例:
  polyweb tab close tab_config_123
```

#### 导航到 URL
```bash
polyweb tab goto <tabId> <url>

示例:
  polyweb tab goto tab_config_123 https://example.com
```

#### 截图
```bash
polyweb tab screenshot <tabId> [options]

选项:
  -o, --output <file>  保存到文件

示例:
  polyweb tab screenshot tab_config_123 -o shot.png
```

#### 获取页面快照
```bash
polyweb tab snapshot <tabId> [options]

选项:
  -o, --output <file>  保存到文件

说明: 快照返回页面的 DOM 结构，用于理解页面内容。

示例:
  polyweb tab snapshot tab_config_123
  polyweb tab snapshot tab_config_123 -o snapshot.json
```

#### 执行 JavaScript
```bash
polyweb tab exec <tabId> -e <code>

选项:
  -e, --expression <code>  JavaScript 代码

示例:
  polyweb tab exec tab_config_123 -e "document.title"
  polyweb tab exec tab_config_123 -e "window.scrollTo(0, 1000)"
```

#### 获取控制台日志
```bash
polyweb tab console <tabId> [options]

选项:
  -l, --level <level>  过滤级别 (log|warn|error|info|debug)

示例:
  polyweb tab console tab_config_123
  polyweb tab console tab_config_123 -l error
```

---

## MCP Server

### 配置

在 Claude Desktop 或其他 MCP 客户端中添加：

```json
{
  "mcpServers": {
    "polyweb": {
      "command": "npx",
      "args": ["@qiyi/mcp-server"],
      "env": {
        "POLYWEB_HOST": "127.0.0.1",
        "POLYWEB_PORT": "9528"
      }
    }
  }
}
```

### 可用工具

| 工具名 | 描述 | 必需参数 |
|--------|------|----------|
| tab_list | 列出所有 Tab | - |
| tab_new | 打开新 Tab | url |
| tab_close | 关闭 Tab | tabId |
| tab_goto | 导航到 URL | tabId, url |
| tab_snapshot | 获取页面快照 | tabId |
| tab_screenshot | 页面截图 | tabId |
| tab_execute | 执行 JavaScript | tabId, script |
| tab_console | 获取控制台日志 | tabId |

---

## HTTP API

CLI 和 MCP 底层都调用 HTTP API，端口默认 9528。

### 状态

```
GET    /api/status              获取服务状态
```

### Tab 管理

```
GET    /api/tabs                列出所有 Tab
POST   /api/tabs                创建 Tab {url, appId?, configName?}
DELETE /api/tabs/:tabId         关闭 Tab
POST   /api/tabs/:tabId/navigate   导航 {url}
GET    /api/tabs/:tabId/screenshot 截图
GET    /api/tabs/:tabId/snapshot   获取快照
POST   /api/tabs/:tabId/execute    执行脚本 {script}
GET    /api/tabs/:tabId/console    获取控制台日志 ?level=error
```

---

## 典型工作流

### 1. 基本操作

```bash
# 打开页面
polyweb tab new https://example.com -n "测试"

# 查看所有 Tab
polyweb tab ls

# 截图
polyweb tab screenshot tab_config_xxx -o page.png

# 获取页面结构
polyweb tab snapshot tab_config_xxx

# 执行脚本
polyweb tab exec tab_config_xxx -e "document.querySelector('button').click()"

# 查看错误日志
polyweb tab console tab_config_xxx -l error

# 关闭 Tab
polyweb tab close tab_config_xxx
```

### 2. AI Agent 自动化

```javascript
// MCP 调用示例
const tabs = await mcp.call('tab_list', {});
const tab = await mcp.call('tab_new', { url: 'https://target.com' });

const snapshot = await mcp.call('tab_snapshot', { tabId: tab.id });
// 分析 snapshot 找到目标元素...

await mcp.call('tab_execute', {
  tabId: tab.id,
  script: "document.querySelector('#submit').click()"
});

// 检查控制台错误
const errors = await mcp.call('tab_console', { tabId: tab.id, level: 'error' });
```
