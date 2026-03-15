import { Command } from 'commander';
import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import * as http from 'http';
import { output } from '../utils/output';

const API_PORT = parseInt(process.env.POLYWEB_PORT || '9528', 10);
const API_HOST = process.env.POLYWEB_HOST || '127.0.0.1';

// 检查服务是否运行
async function isRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/status',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// 获取项目路径
function getProjectPath(): string | null {
  // 优先使用环境变量
  if (process.env.POLYWEB_PROJECT_PATH && existsSync(process.env.POLYWEB_PROJECT_PATH)) {
    return process.env.POLYWEB_PROJECT_PATH;
  }

  // 常见安装路径
  const possiblePaths = [
    '/Users/cih1996/dev/archive/polyWebsAI',
    join(process.env.HOME || '', 'dev/archive/polyWebsAI'),
    join(process.env.HOME || '', 'polyWebsAI'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(join(p, 'package.json'))) {
      return p;
    }
  }

  return null;
}

export const serviceCommand = new Command('service').description('AeroWeb 服务管理');

// status 命令
serviceCommand
  .command('status')
  .description('检查 AeroWeb 服务状态')
  .action(async () => {
    try {
      const running = await isRunning();
      if (running) {
        // 获取详细状态
        const req = http.request({
          hostname: API_HOST,
          port: API_PORT,
          path: '/api/status',
          method: 'GET',
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const status = JSON.parse(data);
              output.success({
                running: true,
                port: API_PORT,
                ...status.data,
              }, 'AeroWeb 服务运行中');
            } catch {
              output.success({ running: true, port: API_PORT }, 'AeroWeb 服务运行中');
            }
          });
        });
        req.on('error', () => {
          output.success({ running: true, port: API_PORT }, 'AeroWeb 服务运行中');
        });
        req.end();
      } else {
        output.success({ running: false, port: API_PORT }, 'AeroWeb 服务未运行');
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// start 命令
serviceCommand
  .command('start')
  .description('启动 AeroWeb 桌面应用')
  .option('-w, --wait', '等待服务就绪')
  .action(async (opts) => {
    try {
      // 检查是否已运行
      if (await isRunning()) {
        output.success({ running: true, port: API_PORT }, 'AeroWeb 服务已在运行');
        return;
      }

      const projectPath = getProjectPath();
      if (!projectPath) {
        output.error('找不到 AeroWeb 项目路径，请设置 POLYWEB_PROJECT_PATH 环境变量');
        process.exit(1);
      }

      // 启动应用
      output.success({ starting: true, path: projectPath }, '正在启动 AeroWeb...');

      const child = spawn('pnpm', ['dev'], {
        cwd: projectPath,
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      if (opts.wait) {
        // 等待服务就绪（最多 30 秒）
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          if (await isRunning()) {
            output.success({ running: true, port: API_PORT }, 'AeroWeb 服务已就绪');
            return;
          }
        }
        output.error('启动超时，请检查日志');
        process.exit(1);
      } else {
        output.success({ started: true }, 'AeroWeb 启动命令已发送，请稍候...');
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// stop 命令
serviceCommand
  .command('stop')
  .description('停止 AeroWeb 桌面应用')
  .action(async () => {
    try {
      if (!(await isRunning())) {
        output.success({ running: false }, 'AeroWeb 服务未运行');
        return;
      }

      // 通过 pkill 停止 Electron 进程
      try {
        execSync('pkill -f "Electron.*polyWebsAI"', { stdio: 'ignore' });
      } catch {
        // pkill 返回非零表示没找到进程，忽略
      }

      // 等待确认停止
      await new Promise(r => setTimeout(r, 2000));

      if (await isRunning()) {
        output.error('停止失败，请手动关闭应用');
        process.exit(1);
      } else {
        output.success({ stopped: true }, 'AeroWeb 服务已停止');
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 导出检查函数供其他命令使用
export { isRunning, getProjectPath };
