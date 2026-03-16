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

### 获取页面数据
```bash
aeroweb tab exec @last -e "document.title"
aeroweb tab exec @last -e "document.querySelector('h1').innerText"
```

### 多账号登录（使用不同缓存）
```bash
aeroweb tab new "https://site.com" -n "账号A" -s account-a
# 登录账号 A...
aeroweb tab new "https://site.com" -n "账号B" -s account-b
# 登录账号 B...
```
