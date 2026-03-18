# AeroWeb - AI 浏览器操作技能

## 简介
AeroWeb 是专为 AI 设计的浏览器，通过 CLI 命令控制浏览器执行网页操作。

## 前置条件
- AeroWeb 桌面应用已启动（或通过 `aeroweb start` 启动服务）

## 命令速查

```bash
# 服务管理
aeroweb start                    # 启动浏览器服务
aeroweb stop                     # 停止服务
aeroweb status                   # 查看状态

# 标签页操作
aeroweb tabs                     # 列出所有标签页
aeroweb tab new <URL>            # 打开新标签页（默认使用 ai-default 缓存）
aeroweb tab new <URL> -s <缓存ID> # 使用指定缓存打开
aeroweb tab goto <tabId> <URL>   # 导航到 URL
aeroweb tab close <tabId>        # 关闭标签页

# 页面交互
aeroweb tab click <tabId> "<选择器>"              # 点击元素
aeroweb tab type <tabId> "<选择器>" "文本" -c     # 输入文本（-c 先清空）
aeroweb tab upload <tabId> <文件路径>             # 上传文件
aeroweb tab exec <tabId> -e "<JS代码>"            # 执行 JavaScript

# 页面信息
aeroweb tab screenshot <tabId> -o <文件>          # 截图
aeroweb tab snapshot <tabId>                      # 获取 DOM 快照
aeroweb tab console <tabId>                       # 获取控制台日志

# 等待 API
aeroweb tab wait-element <tabId> "<选择器>"       # 等待元素出现
aeroweb tab wait-text <tabId> "<文本>"            # 等待文本出现（支持正则如 /pattern/i）

# 网络监控
aeroweb tab network-start <tabId>                 # 启动网络请求监控
aeroweb tab network <tabId>                       # 获取请求列表
aeroweb tab network-wait <tabId> "<URL模式>"      # 等待特定请求完成
aeroweb tab network-stop <tabId>                  # 停止监控

# Cookie 管理
aeroweb tab cookies <tabId>                       # 获取 Cookie 列表
aeroweb tab cookie-set <tabId> <名称> <值>        # 设置 Cookie
aeroweb tab cookie-delete <tabId> <名称>          # 删除 Cookie
aeroweb tab cookies-clear <tabId>                 # 清空所有 Cookie

# 会话管理（多账号）
aeroweb sessions                                  # 列出会话
aeroweb session new "名称" "URL" -o               # 创建并打开会话
aeroweb session open <sessionId>                  # 打开已有会话
```

## Tab 标识符
- `@last` - 最近操作的标签页
- `@current` - 当前激活的标签页
- `@first` - 第一个标签页
- 数字索引 - 如 `1`, `2`
- 模糊匹配 - 如 `bilibili` 匹配包含该词的标签

## 缓存说明
- 不指定 `-s` 参数时，默认使用 `ai-default` 缓存
- 同一缓存的标签页共享登录状态、Cookie 等
- 需要隔离时，使用 `-s <唯一ID>` 指定不同缓存

## 标签页复用
- 打开同一网站（相同 host + 相同缓存）时，会自动复用已有标签页
- 复用时会导航到新 URL 并激活该标签页，不会创建新标签
- 返回数据中 `reused: true` 表示复用了已有标签
- 如需强制新建标签，使用不同的 `-s` 缓存 ID

## 常用场景

### 打开网页并截图
```bash
aeroweb tab new "https://example.com" -n "测试"
aeroweb tab screenshot @last -o /tmp/page.png
```

### 填写表单并提交
```bash
aeroweb tab type @last "#username" "admin" -c
aeroweb tab type @last "#password" "123456" -c
aeroweb tab click @last "button[type=submit]"
```

### 等待页面加载完成
```bash
aeroweb tab new "https://example.com"
aeroweb tab wait-element @last ".content"         # 等待内容区域出现
aeroweb tab wait-text @last "加载完成"            # 等待特定文本
```

### 监控网络请求
```bash
aeroweb tab network-start @last                   # 开始监控
aeroweb tab exec @last -e "fetch('/api/data')"    # 触发请求
aeroweb tab network @last                         # 查看请求列表
aeroweb tab network-stop @last                    # 停止监控
```

### 管理 Cookie
```bash
aeroweb tab cookies @last                         # 查看所有 Cookie
aeroweb tab cookie-set @last "token" "abc123"     # 设置 Cookie
aeroweb tab cookie-delete @last "token"           # 删除 Cookie
aeroweb tab cookies-clear @last                   # 清空所有
```

### 多账号登录（使用不同缓存）
```bash
aeroweb tab new "https://site.com" -n "账号A" -s account-a
# 登录账号 A...
aeroweb tab new "https://site.com" -n "账号B" -s account-b
# 登录账号 B...
```
