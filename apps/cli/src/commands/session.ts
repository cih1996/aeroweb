import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';

export const sessionCommand = new Command('session').description('会话管理');

// 列出所有会话
sessionCommand
  .command('list')
  .alias('ls')
  .description('列出所有会话')
  .action(async () => {
    try {
      const sessions = await client.listSessions();
      if (sessions.length === 0) {
        output.success([], '暂无会话，使用 session new 创建');
        return;
      }
      const list = sessions.map((s, i) => ({
        '#': i + 1,
        id: s.id,
        name: s.name,
        url: new URL(s.url).hostname,
        note: s.note?.substring(0, 20) || '',
        running: s.isRunning ? '✓' : '',
      }));
      output.table(list, ['#', 'id', 'name', 'url', 'note', 'running']);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 查看会话详情
sessionCommand
  .command('get <sessionId>')
  .description('查看会话详情')
  .action(async (sessionId) => {
    try {
      const session = await client.getSession(sessionId);
      output.success(session);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 创建会话
sessionCommand
  .command('new <name> <url>')
  .description('创建新会话')
  .option('-m, --note <note>', '备注信息')
  .option('-o, --open', '创建后立即打开')
  .action(async (name, url, o) => {
    try {
      const session = await client.createSession(name, url, o.note);
      output.success(session, `会话 '${session.name}' 已创建`);

      if (o.open) {
        const result = await client.openSession(session.id);
        output.success(result, `已打开会话 '${session.name}'`);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 更新会话
sessionCommand
  .command('update <sessionId>')
  .description('更新会话信息')
  .option('-n, --name <name>', '新名称')
  .option('-u, --url <url>', '新 URL')
  .option('-m, --note <note>', '新备注')
  .action(async (sessionId, o) => {
    try {
      if (!o.name && !o.url && !o.note) {
        output.error('请至少指定一个要更新的字段 (-n, -u, -m)');
        process.exit(1);
      }
      const session = await client.updateSession(sessionId, {
        name: o.name,
        url: o.url,
        note: o.note,
      });
      output.success(session, `会话 '${session.name}' 已更新`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 删除会话
sessionCommand
  .command('delete <sessionId>')
  .alias('rm')
  .description('删除会话（包括缓存数据）')
  .action(async (sessionId) => {
    try {
      await client.deleteSession(sessionId);
      output.success(null, `会话 '${sessionId}' 已删除`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 打开会话
sessionCommand
  .command('open <sessionId>')
  .description('打开会话（创建标签页）')
  .action(async (sessionId) => {
    try {
      const result = await client.openSession(sessionId);
      output.success(result, `已打开会话 '${result.sessionName}'`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });
