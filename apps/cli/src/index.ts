#!/usr/bin/env node
import { Command } from 'commander';
import { tabCommand } from './commands/tab';
import { appCommand } from './commands/app';
import { serviceCommand, isRunning } from './commands/service';
import { output } from './utils/output';

const program = new Command();

program
  .name('polyweb')
  .description('PolyWeb CLI - AI 浏览器命令行工具')
  .version('1.0.0')
  .option('-f, --format <type>', '输出格式 (json|text)', 'json')
  .option('-q, --quiet', '静默模式')
  .hook('preAction', (cmd) => {
    const o = cmd.opts();
    output.setFormat(o.format);
    output.setQuiet(o.quiet);
  });

program.addCommand(tabCommand);
program.addCommand(appCommand);
program.addCommand(serviceCommand);

// 别名：tabs = tab list
program
  .command('tabs')
  .description('列出所有 Tab (等同于 tab list)')
  .action(async () => {
    await tabCommand.commands.find(c => c.name() === 'list')?.parseAsync([]);
  });

// 别名：apps = app list
program
  .command('apps')
  .description('列出所有应用 (等同于 app list)')
  .action(async () => {
    await appCommand.commands.find(c => c.name() === 'list')?.parseAsync([]);
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
