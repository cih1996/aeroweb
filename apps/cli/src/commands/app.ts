import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';

export const appCommand = new Command('app').description('应用管理');

// 列出所有应用
appCommand
  .command('list')
  .alias('ls')
  .description('列出所有应用')
  .action(async () => {
    try {
      const apps = await client.listApps();
      output.table(apps, ['id', 'name', 'url', 'isFavorite']);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 查看应用详情
appCommand
  .command('get <appId>')
  .description('查看应用详情')
  .action(async (appId) => {
    try {
      const app = await client.getApp(appId);
      output.success(app);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 创建应用
appCommand
  .command('new <name> <url>')
  .description('创建新应用')
  .option('-i, --icon <icon>', '图标 URL 或 base64')
  .option('-c, --color <color>', '主题色 (如 #FF6B00)')
  .action(async (name, url, o) => {
    try {
      const app = await client.createApp(name, url, o.icon, o.color);
      output.success(app, `应用 '${app.name}' 已创建`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 删除应用
appCommand
  .command('delete <appId>')
  .alias('rm')
  .description('删除应用')
  .action(async (appId) => {
    try {
      await client.deleteApp(appId);
      output.success(null, `应用 '${appId}' 已删除`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });
