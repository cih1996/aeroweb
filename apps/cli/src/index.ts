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
  .action(async (opts) => {
    await serviceCommand.commands.find(c => c.name() === 'start')?.parseAsync(opts.wait ? ['-w'] : []);
  });

// 别名：stop = service stop
program
  .command('stop')
  .description('停止 AeroWeb 服务 (等同于 service stop)')
  .action(async () => {
    await serviceCommand.commands.find(c => c.name() === 'stop')?.parseAsync([]);
  });

// 别名：status = service status
program
  .command('status')
  .description('检查 AeroWeb 服务状态 (等同于 service status)')
  .action(async () => {
    await serviceCommand.commands.find(c => c.name() === 'status')?.parseAsync([]);
  });

program.parse();
