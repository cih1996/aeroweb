const { spawn } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const mainFile = path.join(__dirname, '../dist/main/index.js');
const preloadFile = path.join(__dirname, '../dist/preload/index.js');
const viteUrl = 'http://localhost:3800';

function checkFiles() {
  return existsSync(mainFile) && existsSync(preloadFile);
}

function checkVite() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(viteUrl, (res) => {
      // 只要收到响应就认为服务器已启动（包括 404，因为根路径可能没有内容）
      res.on('data', () => {}); // 消费响应数据
      res.on('end', () => {
        // 任何状态码都表示服务器在运行
        resolve(true);
      });
    });
    req.on('error', (err) => {
      // 连接错误表示服务器未启动
      resolve(false);
    });
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function waitForReady() {
  console.log('等待文件就绪...');
  
  // 等待文件
  while (!checkFiles()) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('✓ 文件已就绪');
  
  // 等待 Vite 服务器
  console.log('等待 Vite 开发服务器...');
  let viteReady = false;
  let attempts = 0;
  const maxAttempts = 20; // 最多等待 10 秒 (20 * 500ms)
  
  while (!viteReady && attempts < maxAttempts) {
    viteReady = await checkVite();
    if (!viteReady) {
      attempts++;
      if (attempts % 4 === 0) {
        console.log(`仍在等待 Vite 服务器... (${attempts * 0.5}秒)`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!viteReady) {
    console.warn('⚠️  Vite 服务器检查超时，但继续尝试启动 Electron（服务器可能已启动）...');
  } else {
    console.log('✓ Vite 服务器已就绪');
  }
  
  // 启动 Electron
  console.log('启动 Electron...');
  const electronPath = require('electron');
  const appPath = path.join(__dirname, '..');
  
  console.log('Electron 路径:', electronPath);
  console.log('应用路径:', appPath);
  
  const proc = spawn(electronPath, ['--remote-debugging-port=9222', appPath], {
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: 'inherit',
    shell: false
  });
  
  proc.on('close', (code) => {
    if (code !== null && code !== 0) {
      console.log(`Electron 进程退出，代码: ${code}`);
    }
    // Electron 正常关闭时，不退出整个进程（让 concurrently 管理）
    // 只有在开发模式下，Electron 关闭不应该导致整个 dev 流程停止
  });
  
  proc.on('error', (err) => {
    console.error('启动 Electron 失败:', err);
    // 启动失败时，让 concurrently 知道，但不强制退出
    // 这样其他进程（如 Vite）可以继续运行
  });
}

waitForReady().catch(console.error);

