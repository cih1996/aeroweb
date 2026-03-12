#!/usr/bin/env node
import { Command } from 'commander';
import { instanceCommand } from './commands/instance';
import { pageCommand } from './commands/page';
import { actionCommand } from './commands/action';
import { output } from './utils/output';

const program = new Command();
program.name('polyweb').description('PolyWebsAI CLI - AI 浏览器命令行工具').version('1.0.0')
  .option('-f, --format <type>', '输出格式 (json|text)', 'json').option('-q, --quiet', '静默模式')
  .hook('preAction', (cmd) => { const o = cmd.opts(); output.setFormat(o.format); output.setQuiet(o.quiet); });
program.addCommand(instanceCommand);
program.addCommand(pageCommand);
program.addCommand(actionCommand);
program.parse();
