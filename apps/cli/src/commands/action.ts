import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';
export const actionCommand = new Command('action').description('元素操作');
actionCommand.command('click <instance> <pageId> <uid>').description('点击')
  .action(async (i, p, uid) => { try { output.success(await client.click(i, p, uid), `已点击 ${uid}`); } catch (e: any) { output.error(e.message); process.exit(1); } });
actionCommand.command('fill <instance> <pageId> <uid> <value>').description('填充')
  .action(async (i, p, uid, v) => { try { output.success(await client.fill(i, p, uid, v), `已填充 ${uid}`); } catch (e: any) { output.error(e.message); process.exit(1); } });
actionCommand.command('eval <instance> <pageId>').description('执行JS').option('-e, --expression <code>', 'JS代码')
  .action(async (i, p, o) => { try { if (!o.expression) { output.error('请使用 -e 提供 JS 代码'); process.exit(1); } output.success(await client.evaluate(i, p, o.expression)); } catch (e: any) { output.error(e.message); process.exit(1); } });
actionCommand.command('wait <instance> <pageId> <text...>').description('等待文本').option('-t, --timeout <ms>', '超时', '30000')
  .action(async (i, p, t, o) => { try { output.success(await client.waitFor(i, p, t, parseInt(o.timeout)), '文本已出现'); } catch (e: any) { output.error(e.message); process.exit(1); } });
