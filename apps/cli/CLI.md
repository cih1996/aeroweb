# AeroWeb CLI 使用手册

AeroWeb CLI 是 AI 浏览器的命令行工具，支持会话管理、标签页操作、页面自动化等功能。

## 快速开始

```bash
# 启动浏览器服务
aeroweb start

# 创建会话并打开
aeroweb session new "B站-主号" "https://www.bilibili.com" -o

# 查看所有会话
aeroweb sessions

# 查看所有标签页
aeroweb tabs
```

## 命令概览

| 命令 | 说明 |
|------|------|
| `aeroweb start` | 启动浏览器服务 |
| `aeroweb stop` | 停止浏览器服务 |
| `aeroweb status` | 查看服务状态 |
| `aeroweb sessions` | 列出所有会话 |
| `aeroweb tabs` | 列出所有标签页 |

---

## 服务管理

### 启动服务
```bash
aeroweb start [options]
  -w, --wait    等待服务就绪
  -f, --force   强制启动（清理占用端口）
  --dev         开发模式启动
```

### 停止服务
```bash
aeroweb stop [options]
  -f, --force   强制停止所有相关进程
```

### 重启服务
```bash
aeroweb restart [options]
  -f, --force   强制重启
  --dev         开发模式
```

### 查看状态
```bash
aeroweb status
```

---

## 会话管理 (session)

会话是持久化的浏览器实例，每个会话有独立的缓存目录，可以实现多账号登录。

### 列出会话
```bash
aeroweb session list
aeroweb sessions  # 别名
```

### 创建会话
```bash
aeroweb session new <名称> <URL> [options]
  -m, --note <备注>   添加备注信息
  -o, --open          创建后立即打开

# 示例
aeroweb session new "B站-主号" "https://www.bilibili.com" -m "直播用账号" -o
aeroweb session new "B站-小号" "https://www.bilibili.com" -m "日常用账号"
```

### 查看会话详情
```bash
aeroweb session get <sessionId>
```

### 更新会话
```bash
aeroweb session update <sessionId> [options]
  -n, --name <名称>   新名称
  -u, --url <URL>     新 URL
  -m, --note <备注>   新备注

# 示例
aeroweb session update bilibili_1 -m "已改为直播专用"
```

### 打开会话
```bash
aeroweb session open <sessionId>
```

### 删除会话
```bash
aeroweb session delete <sessionId>
aeroweb session rm <sessionId>  # 别名
```

---

## 标签页管理 (tab)

### 列出标签页
```bash
aeroweb tab list [options]
aeroweb tabs  # 别名

# 选项
  --tree    树形显示（显示父子关系）
  --flat    平铺显示所有标签（包括子标签）

# 示例
aeroweb tab list           # 只显示根标签
aeroweb tab list --tree    # 树形显示父子关系
aeroweb tab list --flat    # 显示所有标签（包括子标签）
```

### 子标签页说明
当在浏览器中点击链接弹出新窗口时，会自动创建为子标签页：
- 子标签页共享父标签的缓存（登录状态）
- 顶部标签栏只显示根标签，子标签数量显示为 `+N`
- 地址栏下方会显示子标签栏（当有子标签时）
- 关闭根标签会同时关闭所有子标签

### 创建标签页
```bash
aeroweb tab new <URL> [options]
  -n, --name <名称>       会话名称（不存在则自动创建）
  -w, --wait <秒数>       等待页面加载
  -s, --screenshot <文件>  截图保存到文件

# 示例
aeroweb tab new "https://www.google.com" -n "Google搜索"
aeroweb tab new "https://example.com" -w 3 -s screenshot.png
```

### 关闭标签页
```bash
aeroweb tab close <tabId>

# 支持特殊标识符
aeroweb tab close @last      # 最近操作的标签页
aeroweb tab close @current   # 当前激活的标签页
aeroweb tab close 1          # 按索引关闭
aeroweb tab close bilibili   # 模糊匹配
```

### 导航
```bash
aeroweb tab goto <tabId> <URL>
```

### 截图
```bash
aeroweb tab screenshot <tabId> [options]
  -o, --output <文件>   保存到文件

# 示例
aeroweb tab screenshot @current -o page.png
```

### 获取页面快照
```bash
aeroweb tab snapshot <tabId> [options]
  -o, --output <文件>   保存到文件
  --full                返回完整 DOM
  -s, --selector <选择器>  只获取指定元素
```

### 执行 JavaScript
```bash
aeroweb tab exec <tabId> -e "<代码>"

# 示例
aeroweb tab exec @current -e "document.title"
aeroweb tab exec @current -e "document.querySelector('h1').innerText"
```

### 获取控制台日志
```bash
aeroweb tab console <tabId> [options]
  -l, --level <级别>   过滤级别 (log|warn|error|info|debug)
```

### 点击元素
```bash
aeroweb tab click <tabId> <选择器> [options]
  --js      使用 JavaScript 点击
  --scroll  先滚动到元素可见区域

# 示例
aeroweb tab click @current "button.submit" --js
```

### 输入文本
```bash
aeroweb tab type <tabId> <选择器> <文本> [options]
  -c, --clear   先清空内容
  --js          使用 JavaScript 输入

# 示例
aeroweb tab type @current "#search" "hello world" -c
```

### 上传文件
```bash
aeroweb tab upload <tabId> <文件路径...>

# 示例
aeroweb tab upload @current ./image.png ./doc.pdf
```

### 查看当前标签页
```bash
aeroweb tab current
aeroweb tab last  # 别名
```

---

## 输出格式

```bash
# JSON 格式（默认）
aeroweb sessions

# 文本格式
aeroweb -f text sessions

# 静默模式
aeroweb -q session new "test" "https://example.com"
```

---

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POLYWEB_HOST` | API 服务地址 | `127.0.0.1` |
| `POLYWEB_PORT` | API 服务端口 | `9528` |

---

## 常见用例

### 多账号登录场景
```bash
# 创建多个 B 站会话
aeroweb session new "B站-主号" "https://www.bilibili.com" -m "日常使用" -o
aeroweb session new "B站-小号" "https://www.bilibili.com" -m "直播专用"
aeroweb session new "B站-工作号" "https://www.bilibili.com" -m "工作账号"

# 打开指定会话
aeroweb session open b站_小号
```

### 自动化测试
```bash
# 打开页面并等待加载
aeroweb tab new "https://example.com" -n "测试" -w 5

# 填写表单
aeroweb tab type @last "#username" "testuser" -c
aeroweb tab type @last "#password" "testpass" -c
aeroweb tab click @last "button[type=submit]" --js

# 截图验证
aeroweb tab screenshot @last -o result.png
```

### 页面数据抓取
```bash
# 获取页面标题
aeroweb tab exec @current -e "document.title"

# 获取所有链接
aeroweb tab exec @current -e "Array.from(document.querySelectorAll('a')).map(a => a.href)"

# 获取指定元素内容
aeroweb tab snapshot @current -s ".article-content"
```
