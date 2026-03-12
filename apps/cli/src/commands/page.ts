import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';
import * as fs from 'fs';
export const pageCommand = new Command('page').description('页面管理');
pageCommand.command('new <instance> <url>').description('打开新页面').option('-b, --background', '后台')
  .action(async (i, url, o) => { try { output.success(await client.newPage(i, url, { background: o.background }), '页面已创建'); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('list <instance>').alias('ls').description('列出页面')
  .action(async (i) => { try { output.table(await client.listPages(i), ['id', 'title', 'url', 'active']); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('close <instance> <pageId>').description('关闭页面')
  .action(async (i, p) => { try { await client.closePage(i, p); output.success(null, `页面 ${p} 已关闭`); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('goto <instance> <pageId> <url>').description('导航')
  .action(async (i, p, url) => { try { await client.navigate(i, p, { type: 'url', url }); output.success(null, `已导航到 ${url}`); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('back <instance> <pageId>').description('后退')
  .action(async (i, p) => { try { await client.navigate(i, p, { type: 'back' }); output.success(null, '已后退'); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('forward <instance> <pageId>').description('前进')
  .action(async (i, p) => { try { await client.navigate(i, p, { type: 'forward' }); output.success(null, '已前进'); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('reload <instance> <pageId>').description('刷新')
  .action(async (i, p) => { try { await client.navigate(i, p, { type: 'reload' }); output.success(null, '已刷新'); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('screenshot <instance> <pageId>').description('截图').option('-o, --output <file>', '输出').option('--full-page', '全页面')
  .action(async (i, p, o) => { try { const r: any = await client.takeScreenshot(i, p, { fullPage: o.fullPage }); if (o.output && r.data) { fs.writeFileSync(o.output, Buffer.from(r.data, 'base64')); output.success({ file: o.output }, `截图已保存`); } else output.success(r); } catch (e: any) { output.error(e.message); process.exit(1); } });
pageCommand.command('snapshot <instance> <pageId>').description('获取快照').option('-o, --output <file>', '输出')
  .action(async (i, p, o) => { try { const r = await client.takeSnapshot(i, p); if (o.output) { fs.writeFileSync(o.output, JSON.stringify(r, null, 2)); output.success({ file: o.output }, '快照已保存'); } else output.success(r); } catch (e: any) { output.error(e.message); process.exit(1); } });
