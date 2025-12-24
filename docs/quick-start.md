# 快速开始

## 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

## 安装依赖

```bash
pnpm install
```

## 开发模式

启动开发服务器（会自动启动 Electron 和 Vite dev server）：

```bash
pnpm dev
```

或者分别启动各个服务：

```bash
# 在 apps/desktop 目录下
pnpm dev:main      # 编译主进程（watch 模式）
pnpm dev:preload   # 编译 preload（watch 模式）
pnpm dev:renderer  # 启动 Vite dev server
```

## 构建

```bash
pnpm build
```

## 运行

```bash
# 在 apps/desktop 目录下
pnpm start
```

## 最小 DEMO 测试

1. 启动开发服务器：`pnpm dev`
2. Electron 窗口会自动打开
3. 点击顶部的 "+ WhatsApp" 或 "+ Telegram" 按钮
4. 应该能看到对应的 Web 应用加载

