#!/usr/bin/env node
import { Command } from 'commander';
import { tabCommand } from './commands/tab';
import { sessionCommand } from './commands/session';
import { serviceCommand } from './commands/service';
import { output } from './utils/output';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execSync } from 'child_process';

// ============ 自安装逻辑 ============
const BINARY_NAME = 'aeroweb';

function getGlobalBinPath(): string {
  const platform = os.platform();
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    // 使用 aeroweb-cli 目录，避免和桌面应用 AeroWeb 目录冲突（Windows 不区分大小写）
    return path.join(localAppData, 'Programs', 'aeroweb-cli');
  } else {
    // macOS 和 Linux 统一用 ~/.local/bin，避免 sudo
    return path.join(os.homedir(), '.local', 'bin');
  }
}

function getBinaryName(): string {
  return os.platform() === 'win32' ? `${BINARY_NAME}.exe` : BINARY_NAME;
}

function install(): void {
  const currentExe = process.execPath;
  const binDir = getGlobalBinPath();
  const targetPath = path.join(binDir, getBinaryName());

  console.log('🚀 AeroWeb CLI 安装程序\n');
  console.log(`📍 当前位置: ${currentExe}`);
  console.log(`📁 目标路径: ${targetPath}\n`);

  try {
    // 确保目录存在
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // 备份旧版本
    if (fs.existsSync(targetPath)) {
      fs.renameSync(targetPath, `${targetPath}.bak`);
      console.log(`📦 已备份旧版本`);
    }

    // 复制文件
    fs.copyFileSync(currentExe, targetPath);
    if (os.platform() !== 'win32') {
      fs.chmodSync(targetPath, 0o755);
    }

    console.log(`✅ 安装成功！`);
    console.log(`\n现在可以在任意位置使用 '${BINARY_NAME}' 命令`);

    // 检查 PATH
    const pathEnv = process.env.PATH || '';
    const separator = os.platform() === 'win32' ? ';' : ':';
    if (!pathEnv.split(separator).some(p => p.toLowerCase() === binDir.toLowerCase())) {
      console.log(`\n⚠️  提示: ${binDir} 不在 PATH 中`);
      if (os.platform() === 'win32') {
        // Windows: 使用 reg add 直接修改注册表（避免 setx 的 1024 字符限制）
        try {
          // 获取当前用户 PATH
          const userPath = execSync('reg query "HKCU\\Environment" /v Path', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
          const match = userPath.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.+)/i);
          const currentPath = match ? match[1].trim() : '';

          if (!currentPath.toLowerCase().includes(binDir.toLowerCase())) {
            const newPath = currentPath ? `${currentPath};${binDir}` : binDir;
            // 使用 reg add 而不是 setx，避免 1024 字符限制
            execSync(`reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "${newPath}" /f`, { stdio: 'ignore' });
            // 广播环境变量变更消息
            execSync('setx AEROWEB_INSTALLED 1', { stdio: 'ignore' });
            console.log(`   ✅ 已自动添加到用户 PATH`);
            console.log(`   ⚠️  请重新打开命令行窗口使 PATH 生效`);
          }
        } catch {
          console.log(`   请手动将 ${binDir} 添加到系统环境变量 PATH`);
          console.log(`   或运行以下命令（管理员模式）:`);
          console.log(`   reg add "HKCU\\Environment" /v Path /t REG_EXPAND_SZ /d "%PATH%;${binDir}" /f`);
        }
      } else {
        const rcFile = (process.env.SHELL || '').includes('zsh') ? '~/.zshrc' : '~/.bashrc';
        // 自动添加到 shell 配置
        const rcPath = rcFile.replace('~', os.homedir());
        const exportLine = `export PATH="${binDir}:$PATH"`;
        try {
          const content = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, 'utf-8') : '';
          if (!content.includes(binDir)) {
            fs.appendFileSync(rcPath, `\n# AeroWeb CLI\n${exportLine}\n`);
            console.log(`   已自动添加到 ${rcFile}，重启终端或执行: source ${rcFile}`);
          }
        } catch {
          console.log(`   请添加: ${exportLine} 到 ${rcFile}`);
        }
      }
    }
  } catch (err: any) {
    console.error(`❌ 安装失败: ${err.message}`);
    process.exit(1);
  }
}

function shouldInstall(): boolean {
  const args = process.argv.slice(2);
  // 显式安装命令
  if (args[0] === 'install' || args[0] === '--install') return true;
  // 双击运行（无参数）且是打包后的二进制
  if (args.length === 0 && !process.execPath.includes('node')) {
    const binDir = getGlobalBinPath();
    return !process.execPath.startsWith(binDir);
  }
  return false;
}

// 检查是否需要自安装
if (shouldInstall()) {
  install();
  process.exit(0);
}
// ============ 自安装逻辑结束 ============

const program = new Command();

program
  .name('aeroweb')
  .description('AeroWeb CLI - AI 浏览器命令行工具')
  .version('1.0.0')
  .option('-f, --format <type>', '输出格式 (json|text)', 'json')
  .option('-q, --quiet', '静默模式')
  .hook('preAction', (cmd) => {
    const o = cmd.opts();
    output.setFormat(o.format);
    output.setQuiet(o.quiet);
  });

program.addCommand(tabCommand);
program.addCommand(sessionCommand);
program.addCommand(serviceCommand);

// 别名：tabs = tab list
program
  .command('tabs')
  .description('列出所有 Tab (等同于 tab list)')
  .action(async () => {
    await tabCommand.commands.find(c => c.name() === 'list')?.parseAsync([]);
  });

// 别名：sessions = session list
program
  .command('sessions')
  .description('列出所有会话 (等同于 session list)')
  .action(async () => {
    await sessionCommand.commands.find(c => c.name() === 'list')?.parseAsync([]);
  });

// 别名：start = service start
program
  .command('start')
  .description('启动 AeroWeb 服务 (等同于 service start)')
  .option('-w, --wait', '等待服务就绪')
  .option('-f, --force', '强制启动（清理占用端口）')
  .option('--dev', '使用开发模式启动')
  .action(async (opts) => {
    const args: string[] = [];
    if (opts.wait) args.push('-w');
    if (opts.force) args.push('-f');
    if (opts.dev) args.push('--dev');
    await serviceCommand.commands.find(c => c.name() === 'start')?.parseAsync(args);
  });

// 别名：stop = service stop
program
  .command('stop')
  .description('停止 AeroWeb 服务 (等同于 service stop)')
  .option('-f, --force', '强制停止所有相关进程')
  .action(async (opts) => {
    await serviceCommand.commands.find(c => c.name() === 'stop')?.parseAsync(opts.force ? ['-f'] : []);
  });

// 别名：restart = service restart
program
  .command('restart')
  .description('重启 AeroWeb 服务 (等同于 service restart)')
  .option('-f, --force', '强制重启')
  .option('--dev', '使用开发模式')
  .action(async (opts) => {
    const args: string[] = [];
    if (opts.force) args.push('-f');
    if (opts.dev) args.push('--dev');
    await serviceCommand.commands.find(c => c.name() === 'restart')?.parseAsync(args);
  });

// 别名：status = service status
program
  .command('status')
  .description('检查 AeroWeb 服务状态 (等同于 service status)')
  .action(async () => {
    await serviceCommand.commands.find(c => c.name() === 'status')?.parseAsync([]);
  });

program.parse();
