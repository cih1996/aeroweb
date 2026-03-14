import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';
import * as fs from 'fs';

export const tabCommand = new Command('tab').description('Tab 管理');

// 列出所有 Tab
tabCommand
  .command('list')
  .alias('ls')
  .description('列出所有 Tab')
  .action(async () => {
    try {
      const tabs = await client.listTabs();
      output.table(tabs, ['id', 'title', 'url', 'active']);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 创建新 Tab
tabCommand
  .command('new <url>')
  .description('打开新 Tab')
  .option('-n, --name <name>', 'Tab 名称')
  .action(async (url, o) => {
    try {
      const tab = await client.createTab(url, 'cli', o.name);
      output.success(tab, '页面已创建');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 关闭 Tab
tabCommand
  .command('close <tabId>')
  .description('关闭 Tab')
  .action(async (tabId) => {
    try {
      await client.closeTab(tabId);
      output.success(null, `Tab ${tabId} 已关闭`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 导航
tabCommand
  .command('goto <tabId> <url>')
  .description('导航到 URL')
  .action(async (tabId, url) => {
    try {
      await client.navigate(tabId, url);
      output.success(null, `已导航到 ${url}`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 截图
tabCommand
  .command('screenshot <tabId>')
  .description('截图')
  .option('-o, --output <file>', '保存到文件')
  .action(async (tabId, o) => {
    try {
      const r = await client.screenshot(tabId);
      if (o.output && r.image) {
        fs.writeFileSync(o.output, Buffer.from(r.image, 'base64'));
        output.success({ file: o.output }, '截图已保存');
      } else {
        output.success(r);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 快照
tabCommand
  .command('snapshot <tabId>')
  .description('获取页面快照')
  .option('-o, --output <file>', '保存到文件')
  .action(async (tabId, o) => {
    try {
      const r = await client.snapshot(tabId);
      if (o.output) {
        fs.writeFileSync(o.output, JSON.stringify(r, null, 2));
        output.success({ file: o.output }, '快照已保存');
      } else {
        output.success(r);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 执行脚本
tabCommand
  .command('exec <tabId>')
  .description('执行 JavaScript')
  .option('-e, --expression <code>', 'JS 代码')
  .action(async (tabId, o) => {
    try {
      if (!o.expression) {
        output.error('请使用 -e 提供 JS 代码');
        process.exit(1);
      }
      const r = await client.execute(tabId, o.expression);
      output.success(r);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 控制台日志
tabCommand
  .command('console <tabId>')
  .description('获取控制台日志')
  .option('-l, --level <level>', '过滤级别 (log|warn|error|info|debug)')
  .action(async (tabId, o) => {
    try {
      const logs = await client.console(tabId, o.level);
      if (logs.length === 0) {
        output.success([], '暂无日志');
      } else {
        output.table(logs, ['level', 'message', 'source', 'line', 'timestamp']);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 文件上传
tabCommand
  .command('upload <tabId> <files...>')
  .description('上传文件到页面')
  .action(async (tabId, files) => {
    try {
      const r = await client.upload(tabId, files);
      output.success(r, '文件上传已触发');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 点击元素
tabCommand
  .command('click <tabId> <selector>')
  .description('点击页面元素')
  .action(async (tabId, selector) => {
    try {
      const r = await client.click(tabId, selector);
      output.success(r, '元素已点击');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 输入文本
tabCommand
  .command('type <tabId> <selector> <text>')
  .description('向元素输入文本')
  .option('-c, --clear', '先清空内容')
  .action(async (tabId, selector, text, o) => {
    try {
      const r = await client.type(tabId, selector, text, o.clear);
      output.success(r, '文本已输入');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });
