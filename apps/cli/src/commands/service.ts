import { Command } from 'commander';
import { spawn, execSync, ChildProcess } from 'child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as http from 'http';
import { output } from '../utils/output';

const API_PORT = parseInt(process.env.POLYWEB_PORT || '9528', 10);
const API_HOST = process.env.POLYWEB_HOST || '127.0.0.1';
const PID_FILE = join(process.env.HOME || '/tmp', '.polyweb.pid');

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
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.success === true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// 获取项目路径
function getProjectPath(): string | null {
  if (process.env.POLYWEB_PROJECT_PATH && existsSync(process.env.POLYWEB_PROJECT_PATH)) {
    return process.env.POLYWEB_PROJECT_PATH;
  }

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

// 获取打包应用路径
function getAppPath(): string | null {
  const possiblePaths = [
    '/Applications/AeroWeb.app',
    '/Applications/PolyWeb.app',
    join(process.env.HOME || '', 'Applications/AeroWeb.app'),
    join(process.env.HOME || '', 'Applications/PolyWeb.app'),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

// 等待服务就绪
async function waitForReady(maxSeconds: number = 30): Promise<boolean> {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await isRunning()) {
      return true;
    }
  }
  return false;
}

// 检查端口是否被占用
function isPortInUse(port: number): boolean {
  try {
    const result = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

// 杀掉占用端口的进程
function killPortProcess(port: number): boolean {
  try {
    execSync(`lsof -i :${port} -t | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const serviceCommand = new Command('service').description('AeroWeb 服务管理');

// status 命令
serviceCommand
  .command('status')
  .description('检查 AeroWeb 服务状态')
  .action(async () => {
    try {
      const running = await isRunning();
      const portInUse = isPortInUse(API_PORT);

      if (running) {
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
      } else if (portInUse) {
        output.success({
          running: false,
          port: API_PORT,
          portInUse: true,
          hint: '端口被占用但服务未响应，可能需要 polyweb stop 清理'
        }, 'AeroWeb 服务异常');
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
  .option('-f, --force', '强制启动（清理占用端口）')
  .option('--dev', '使用开发模式启动')
  .action(async (opts) => {
    try {
      // 检查是否已运行
      if (await isRunning()) {
        output.success({ running: true, port: API_PORT }, 'AeroWeb 服务已在运行');
        return;
      }

      // 检查端口占用
      if (isPortInUse(API_PORT)) {
        if (opts.force) {
          killPortProcess(API_PORT);
          await new Promise(r => setTimeout(r, 1000));
        } else {
          output.error(`端口 ${API_PORT} 被占用，使用 --force 强制启动或 polyweb stop 清理`);
          process.exit(1);
        }
      }

      // 检查 Vite 开发服务器端口（3800）
      if (opts.dev && isPortInUse(3800)) {
        if (opts.force) {
          killPortProcess(3800);
          await new Promise(r => setTimeout(r, 1000));
        } else {
          output.error('端口 3800 被占用（Vite 开发服务器），使用 --force 强制启动');
          process.exit(1);
        }
      }

      let child: ChildProcess;
      let startMethod: string;

      // 优先使用打包应用
      const appPath = getAppPath();
      if (appPath && !opts.dev) {
        startMethod = 'app';
        child = spawn('open', ['-a', appPath], {
          detached: true,
          stdio: 'ignore',
        });
      } else {
        // 使用开发模式
        const projectPath = getProjectPath();
        if (!projectPath) {
          output.error('找不到 AeroWeb，请安装应用或设置 POLYWEB_PROJECT_PATH');
          process.exit(1);
        }

        startMethod = 'dev';

        // 使用 nohup 确保进程不会因终端关闭而退出
        child = spawn('sh', ['-c', `cd "${projectPath}" && nohup pnpm dev > /tmp/polyweb.log 2>&1 &`], {
          detached: true,
          stdio: 'ignore',
        });
      }

      child.unref();

      // 保存 PID（仅开发模式有意义）
      if (child.pid) {
        try {
          writeFileSync(PID_FILE, String(child.pid));
        } catch {
          // 忽略写入失败
        }
      }

      // 等待服务就绪
      const ready = await waitForReady(opts.wait ? 30 : 5);

      if (ready) {
        output.success({
          running: true,
          port: API_PORT,
          method: startMethod,
        }, 'AeroWeb 服务已就绪');
      } else if (opts.wait) {
        // 检查日志获取错误信息
        let errorHint = '';
        try {
          const log = readFileSync('/tmp/polyweb.log', 'utf-8');
          if (log.includes('EADDRINUSE') || log.includes('already in use')) {
            errorHint = '端口冲突，尝试 polyweb start --force';
          } else if (log.includes('Error')) {
            const errorLine = log.split('\n').find(l => l.includes('Error'));
            errorHint = errorLine || '';
          }
        } catch {
          // 忽略
        }

        output.error(`启动超时${errorHint ? ': ' + errorHint : '，请检查 /tmp/polyweb.log'}`);
        process.exit(1);
      } else {
        output.success({
          starting: true,
          method: startMethod,
          hint: '使用 polyweb status 检查状态'
        }, 'AeroWeb 启动中...');
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
  .option('-f, --force', '强制停止所有相关进程')
  .action(async (opts) => {
    try {
      const wasRunning = await isRunning();

      // 停止 Electron 进程
      try {
        execSync('pkill -f "Electron.*polyWebsAI" 2>/dev/null || true', { stdio: 'ignore' });
        execSync('pkill -f "Electron.*AeroWeb" 2>/dev/null || true', { stdio: 'ignore' });
        execSync('pkill -f "Electron.*PolyWeb" 2>/dev/null || true', { stdio: 'ignore' });
      } catch {
        // 忽略
      }

      if (opts.force) {
        // 强制清理所有相关进程和端口
        killPortProcess(API_PORT);
        killPortProcess(3800);

        try {
          execSync('pkill -f "turbo.*dev" 2>/dev/null || true', { stdio: 'ignore' });
          execSync('pkill -f "vite.*3800" 2>/dev/null || true', { stdio: 'ignore' });
        } catch {
          // 忽略
        }
      }

      // 清理 PID 文件
      try {
        unlinkSync(PID_FILE);
      } catch {
        // 忽略
      }

      // 等待确认停止
      await new Promise(r => setTimeout(r, 2000));

      if (await isRunning()) {
        output.error('停止失败，尝试 polyweb stop --force');
        process.exit(1);
      } else {
        output.success({
          stopped: true,
          wasRunning,
        }, wasRunning ? 'AeroWeb 服务已停止' : 'AeroWeb 服务未运行');
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// restart 命令
serviceCommand
  .command('restart')
  .description('重启 AeroWeb 桌面应用')
  .option('-f, --force', '强制重启')
  .option('--dev', '使用开发模式')
  .action(async (opts) => {
    try {
      // 先停止
      try {
        execSync('pkill -f "Electron.*polyWebsAI" 2>/dev/null || true', { stdio: 'ignore' });
        execSync('pkill -f "Electron.*AeroWeb" 2>/dev/null || true', { stdio: 'ignore' });
      } catch {
        // 忽略
      }

      if (opts.force) {
        killPortProcess(API_PORT);
        killPortProcess(3800);
      }

      await new Promise(r => setTimeout(r, 2000));

      // 再启动
      const args = ['-w'];
      if (opts.force) args.push('-f');
      if (opts.dev) args.push('--dev');

      await serviceCommand.commands.find(c => c.name() === 'start')?.parseAsync(args);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 导出检查函数供其他命令使用
export { isRunning, getProjectPath, waitForReady };

/**
 * 确保服务正在运行，如果没有运行则自动启动
 * @param silent 是否静默模式（不输出启动信息）
 * @returns 是否成功
 */
export async function ensureRunning(silent: boolean = false): Promise<boolean> {
  // 已经在运行
  if (await isRunning()) {
    return true;
  }

  // 检查端口占用但服务未响应的情况
  if (isPortInUse(API_PORT)) {
    // 尝试清理僵尸进程
    killPortProcess(API_PORT);
    await new Promise(r => setTimeout(r, 1000));
  }

  // 自动启动
  if (!silent) {
    console.error('\x1b[33m[AeroWeb] 服务未运行，正在自动启动...\x1b[0m');
  }

  // 优先使用打包应用
  const appPath = getAppPath();
  if (appPath) {
    spawn('open', ['-a', appPath], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  } else {
    // 使用开发模式
    const projectPath = getProjectPath();
    if (!projectPath) {
      if (!silent) {
        console.error('\x1b[31m[AeroWeb] 找不到 AeroWeb，请先安装应用或设置 POLYWEB_PROJECT_PATH\x1b[0m');
      }
      return false;
    }

    spawn('sh', ['-c', `cd "${projectPath}" && nohup pnpm dev > /tmp/polyweb.log 2>&1 &`], {
      detached: true,
      stdio: 'ignore',
    }).unref();
  }

  // 等待服务就绪（最多 15 秒）
  const ready = await waitForReady(15);

  if (ready) {
    if (!silent) {
      console.error('\x1b[32m[AeroWeb] 服务已就绪\x1b[0m');
    }
    return true;
  } else {
    if (!silent) {
      console.error('\x1b[31m[AeroWeb] 启动超时，请检查 /tmp/polyweb.log 或手动运行 polyweb start --dev\x1b[0m');
    }
    return false;
  }
}
