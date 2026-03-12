import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';
export const instanceCommand = new Command('instance').description('浏览器实例管理');
instanceCommand.command('create <id>').description('创建实例').option('-n, --name <name>', '名称')
  .action(async (id, o) => { try { output.success(await client.createInstance({ id, name: o.name || id }), `实例 ${id} 创建成功`); } catch (e: any) { output.error(e.message); process.exit(1); } });
instanceCommand.command('list').alias('ls').description('列出实例')
  .action(async () => { try { output.table(await client.listInstances(), ['id', 'name', 'status', 'pageCount']); } catch (e: any) { output.error(e.message); process.exit(1); } });
instanceCommand.command('close <id>').description('关闭实例')
  .action(async (id) => { try { await client.closeInstance(id); output.success(null, `实例 ${id} 已关闭`); } catch (e: any) { output.error(e.message); process.exit(1); } });
