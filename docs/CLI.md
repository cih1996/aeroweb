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

### 实例管理 (instance)

浏览器实例 = 独立的缓存/Cookie 环境，类似"分身"。

#### 创建实例
```bash
polyweb instance create <id> [options]

参数:
  id              实例ID（唯一标识）

选项:
  -n, --name      实例名称

示例:
  polyweb instance create work -n "工作账号"
  polyweb instance create personal
```

#### 列出实例
```bash
polyweb instance list
polyweb instance ls

输出字段: id, name, status, pageCount
```

#### 关闭实例
```bash
polyweb instance close <id>

示例:
  polyweb instance close work
```

---

### 页面管理 (page)

#### 打开新页面
```bash
polyweb page new <instance> <url> [options]

参数:
  instance        实例ID
  url             要打开的URL

选项:
  -b, --background  后台打开（不激活）

示例:
  polyweb page new work https://example.com
  polyweb page new work https://google.com -b
```

#### 列出页面
```bash
polyweb page list <instance>
polyweb page ls <instance>

输出字段: id, title, url, active
```

#### 关闭页面
```bash
polyweb page close <instance> <pageId>

示例:
  polyweb page close work page_123
```

#### 导航
```bash
# 跳转到URL
polyweb page goto <instance> <pageId> <url>

# 后退
polyweb page back <instance> <pageId>

# 前进
polyweb page forward <instance> <pageId>

# 刷新
polyweb page reload <instance> <pageId>
```

#### 截图
```bash
polyweb page screenshot <instance> <pageId> [options]

选项:
  -o, --output <file>  保存到文件
  --full-page          全页面截图

示例:
  polyweb page screenshot work page_123 -o shot.png
  polyweb page screenshot work page_123 --full-page -o full.png
```

#### 获取快照
```bash
polyweb page snapshot <instance> <pageId> [options]

选项:
  -o, --output <file>  保存到文件

说明: 快照返回页面的 a11y 树结构，包含元素 UID，用于后续操作。

示例:
  polyweb page snapshot work page_123
  polyweb page snapshot work page_123 -o snapshot.json
```

---

### 元素操作 (action)

#### 点击元素
```bash
polyweb action click <instance> <pageId> <uid>

参数:
  uid             元素UID（从 snapshot 获取）

示例:
  polyweb action click work page_123 btn_submit
```

#### 填充输入框
```bash
polyweb action fill <instance> <pageId> <uid> <value>

示例:
  polyweb action fill work page_123 input_email "test@example.com"
```

#### 执行 JavaScript
```bash
polyweb action eval <instance> <pageId> -e <code>

选项:
  -e, --expression <code>  JavaScript 代码

示例:
  polyweb action eval work page_123 -e "document.title"
  polyweb action eval work page_123 -e "window.scrollTo(0, 1000)"
```

#### 等待文本出现
```bash
polyweb action wait <instance> <pageId> <text...> [options]

参数:
  text            要等待的文本（可多个，任一出现即返回）

选项:
  -t, --timeout <ms>  超时时间，默认 30000ms

示例:
  polyweb action wait work page_123 "登录成功"
  polyweb action wait work page_123 "成功" "失败" -t 10000
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
| instance_create | 创建浏览器实例 | id |
| instance_list | 列出所有实例 | - |
| instance_close | 关闭实例 | id |
| page_new | 打开新页面 | instance, url |
| page_list | 列出页面 | instance |
| page_close | 关闭页面 | instance, pageId |
| page_goto | 导航到URL | instance, pageId, url |
| page_snapshot | 获取页面快照 | instance, pageId |
| page_screenshot | 页面截图 | instance, pageId |
| action_click | 点击元素 | instance, pageId, uid |
| action_fill | 填充输入框 | instance, pageId, uid, value |
| action_evaluate | 执行JS | instance, pageId, script |
| action_wait | 等待文本 | instance, pageId, text |

---

## HTTP API

CLI 和 MCP 底层都调用 HTTP API，端口默认 9528。

### 实例管理

```
POST   /api/instance           创建实例 {id, name}
GET    /api/instances          列出实例
DELETE /api/instance/:id       关闭实例
```

### 页面管理

```
POST   /api/instance/:id/page              打开页面 {url, background?}
GET    /api/instance/:id/pages             列出页面
DELETE /api/instance/:id/page/:pageId      关闭页面
POST   /api/instance/:id/page/:pageId/navigate   导航 {type, url?}
GET    /api/instance/:id/page/:pageId/snapshot   获取快照
POST   /api/instance/:id/page/:pageId/screenshot 截图 {fullPage?}
```

### 元素操作

```
POST   /api/instance/:id/page/:pageId/click     点击 {uid}
POST   /api/instance/:id/page/:pageId/fill      填充 {uid, value}
POST   /api/instance/:id/page/:pageId/evaluate  执行JS {function}
POST   /api/instance/:id/page/:pageId/wait      等待 {text[], timeout?}
```

---

## 典型工作流

### 1. 多账号登录

```bash
# 创建两个独立实例
polyweb instance create account1 -n "账号1"
polyweb instance create account2 -n "账号2"

# 各自打开登录页
polyweb page new account1 https://example.com/login
polyweb page new account2 https://example.com/login

# 获取页面快照，找到输入框
polyweb page snapshot account1 page_xxx -o snap.json

# 填充登录信息
polyweb action fill account1 page_xxx input_user "user1"
polyweb action fill account1 page_xxx input_pass "pass1"
polyweb action click account1 page_xxx btn_login

# 等待登录完成
polyweb action wait account1 page_xxx "欢迎" "登录失败"
```

### 2. AI Agent 自动化

```javascript
// MCP 调用示例
await mcp.call('instance_create', { id: 'bot', name: 'AI Bot' });
await mcp.call('page_new', { instance: 'bot', url: 'https://target.com' });

const snapshot = await mcp.call('page_snapshot', { instance: 'bot', pageId: 'page_1' });
// 分析 snapshot 找到目标元素...

await mcp.call('action_click', { instance: 'bot', pageId: 'page_1', uid: 'target_btn' });
```
