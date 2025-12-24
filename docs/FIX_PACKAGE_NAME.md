# 修复包名更改后的依赖问题

## 问题
将包名从 `@poly-apps/*` 改为 `@qiyi/*` 后，需要重新安装依赖。

## 解决步骤

### 1. 清理旧的依赖和构建产物

```bash
# 在项目根目录执行
pnpm clean
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/dist
rm -rf packages/*/dist
```

### 2. 重新安装依赖

```bash
pnpm install
```

### 3. 重新构建所有包

```bash
pnpm build
```

### 4. 启动开发环境

```bash
pnpm dev
```

## 注意事项

- 确保所有 package.json 中的包名都已更新为 `@qiyi/*`
- 确保 pnpm-workspace.yaml 配置正确
- 如果还有问题，可以删除整个 node_modules 目录和 pnpm-lock.yaml，然后重新安装

