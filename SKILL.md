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
aeroweb tab new <URL>            # 打开新标签页
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

### 获取页面数据
```bash
aeroweb tab exec @last -e "document.title"
aeroweb tab exec @last -e "document.querySelector('h1').innerText"
```

### 多账号登录
```bash
aeroweb session new "账号A" "https://site.com" -o
# 登录账号 A...
aeroweb session new "账号B" "https://site.com" -o
# 登录账号 B...
# 之后可随时切换
aeroweb session open 账号a
```
