pnpm dev (根目录)
  ↓
turbo run dev (根据 turbo.json 配置)
  ↓
找到所有有 dev 脚本的包（desktop, browser-service, shared 等）
  ↓
执行 @poly-apps/desktop 的 dev 脚本
  ↓
concurrently 并行执行 4 个任务：
  ├─ dev:main    → tsc -p tsconfig.main.json --watch
  ├─ dev:preload → tsc -p tsconfig.preload.json --watch
  ├─ dev:renderer → cd renderer && vite
  └─ dev:electron → node scripts/start-electron.js
     └─ 等待文件就绪 → 启动 Electron