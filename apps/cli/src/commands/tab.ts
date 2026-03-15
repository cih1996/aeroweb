import { Command } from 'commander';
import { client } from '../utils/client';
import { output } from '../utils/output';
import { resolveTabId, setLastTab, setLastCreatedTab, withLastTab } from '../utils/tab-resolver';
import * as fs from 'fs';

export const tabCommand = new Command('tab').description('Tab 管理');

// 列出所有 Tab（带索引）
tabCommand
  .command('list')
  .alias('ls')
  .description('列出所有 Tab')
  .option('--tree', '树形显示（显示父子关系）')
  .option('--flat', '平铺显示所有标签（包括子标签）')
  .action(async (o) => {
    try {
      const tabs = await client.listTabs();

      if (o.tree) {
        // 树形显示
        const rootTabs = tabs.filter(t => !t.parentTabId);
        const result: any[] = [];
        let index = 1;

        for (const root of rootTabs) {
          result.push({
            '#': index++,
            id: root.id,
            name: root.configName || root.appId,
            title: root.title?.substring(0, 25) || '',
            active: root.active ? '✓' : '',
            children: root.childTabIds?.length || 0,
          });

          // 添加子标签
          if (root.childTabIds) {
            for (const childId of root.childTabIds) {
              const child = tabs.find(t => t.id === childId);
              if (child) {
                result.push({
                  '#': `  └ ${index++}`,
                  id: child.id,
                  name: child.configName || '子标签',
                  title: child.title?.substring(0, 25) || '',
                  active: child.active ? '✓' : '',
                  children: '',
                });
              }
            }
          }
        }
        output.table(result, ['#', 'id', 'name', 'title', 'active', 'children']);
      } else {
        // 默认只显示根标签
        const rootTabs = o.flat ? tabs : tabs.filter(t => !t.parentTabId);
        const tabsWithIndex = rootTabs.map((t, i) => ({
          '#': i + 1,
          id: t.id,
          name: t.configName || t.appId,
          title: t.title?.substring(0, 30) || '',
          active: t.active ? '✓' : '',
          sub: t.childTabIds?.length ? `+${t.childTabIds.length}` : '',
        }));
        output.table(tabsWithIndex, ['#', 'id', 'name', 'title', 'active', 'sub']);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 创建新 Tab
tabCommand
  .command('new <url>')
  .description('打开新 Tab')
  .option('-n, --name <name>', '应用名称（不存在则自动创建）')
  .option('-a, --app <appId>', '关联到已有应用 ID')
  .option('-w, --wait <seconds>', '等待页面加载（秒）')
  .option('-s, --screenshot <file>', '截图保存到文件')
  .action(async (url, o) => {
    try {
      const tab = await client.createTab(url, o.name, o.app);
      setLastCreatedTab(tab.id);

      // 等待页面加载
      if (o.wait) {
        const seconds = parseInt(o.wait, 10) || 3;
        await new Promise(r => setTimeout(r, seconds * 1000));
      }

      // 截图
      if (o.screenshot) {
        const r = await client.screenshot(tab.id);
        if (r.image) {
          fs.writeFileSync(o.screenshot, Buffer.from(r.image, 'base64'));
        }
      }

      output.success(tab, `页面已创建，关联应用: ${tab.appName || tab.appId}`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 关闭 Tab
tabCommand
  .command('close <tabId>')
  .description('关闭 Tab（支持 @last, @current, 索引, 模糊匹配）')
  .action(async (tabIdInput) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
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
  .action(async (tabIdInput, url) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      await withLastTab(tabId, () => client.navigate(tabId, url));
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
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.screenshot(tabId));
      if (o.output && r.image) {
        fs.writeFileSync(o.output, Buffer.from(r.image, 'base64'));
        output.success({ file: o.output, tabId }, '截图已保存');
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
  .option('--full', '返回完整 DOM（默认简洁模式）')
  .option('-s, --selector <selector>', '只获取指定元素')
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.snapshot(tabId));

      // 如果指定了选择器，通过 JS 获取
      if (o.selector) {
        const jsResult = await client.execute(tabId, `
          (function() {
            const el = document.querySelector('${o.selector.replace(/'/g, "\\'")}');
            if (!el) return { found: false };
            return {
              found: true,
              tagName: el.tagName,
              text: el.innerText?.substring(0, 500),
              html: el.outerHTML?.substring(0, 2000),
              attributes: Array.from(el.attributes).map(a => ({name: a.name, value: a.value}))
            };
          })()
        `);
        output.success(jsResult.result);
        return;
      }

      if (o.output) {
        fs.writeFileSync(o.output, JSON.stringify(r, null, 2));
        output.success({ file: o.output, tabId }, '快照已保存');
      } else if (o.full) {
        output.success(r);
      } else {
        // 简洁模式：只返回关键信息
        const summary = {
          url: r.url,
          title: r.title,
          tabId,
          hint: '使用 --full 查看完整 DOM，或 -s "selector" 查看指定元素'
        };
        output.success(summary);
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
  .action(async (tabIdInput, o) => {
    try {
      if (!o.expression) {
        output.error('请使用 -e 提供 JS 代码');
        process.exit(1);
      }
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.execute(tabId, o.expression));
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
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const logs = await withLastTab(tabId, () => client.console(tabId, o.level));
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
  .action(async (tabIdInput, files) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.upload(tabId, files));
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
  .option('--js', '使用 JavaScript 点击（兼容性更好）')
  .option('--scroll', '先滚动到元素可见区域')
  .action(async (tabIdInput, selector, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);

      if (o.scroll || o.js) {
        // 使用 JS 实现，兼容性更好
        const script = `
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (!el) return { success: false, message: 'Element not found: ${selector}' };
            ${o.scroll ? 'el.scrollIntoView({ behavior: "instant", block: "center" });' : ''}
            el.click();
            return { success: true, message: 'Clicked via JS' };
          })()
        `;
        const r = await withLastTab(tabId, () => client.execute(tabId, script));
        if (r.result?.success) {
          output.success(r.result, '元素已点击');
        } else {
          output.error(r.result?.message || '点击失败');
          process.exit(1);
        }
      } else {
        const r = await withLastTab(tabId, () => client.click(tabId, selector));
        output.success(r, '元素已点击');
      }
    } catch (e: any) {
      // 提供更好的错误提示
      if (e.message.includes('not found')) {
        output.error(`元素未找到: ${selector}\n提示: 尝试 --js 或 --scroll 选项，或使用 exec 命令检查选择器`);
      } else {
        output.error(e.message);
      }
      process.exit(1);
    }
  });

// 输入文本
tabCommand
  .command('type <tabId> <selector> <text>')
  .description('向元素输入文本')
  .option('-c, --clear', '先清空内容')
  .option('--js', '使用 JavaScript 输入（兼容性更好）')
  .action(async (tabIdInput, selector, text, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);

      if (o.js) {
        const script = `
          (function() {
            const el = document.querySelector('${selector.replace(/'/g, "\\'")}');
            if (!el) return { success: false, message: 'Element not found' };
            el.focus();
            ${o.clear ? "el.value = '';" : ''}
            el.value ${o.clear ? '=' : '+='} '${text.replace(/'/g, "\\'")}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, message: 'Typed via JS' };
          })()
        `;
        const r = await withLastTab(tabId, () => client.execute(tabId, script));
        if (r.result?.success) {
          output.success(r.result, '文本已输入');
        } else {
          output.error(r.result?.message || '输入失败');
          process.exit(1);
        }
      } else {
        const r = await withLastTab(tabId, () => client.type(tabId, selector, text, o.clear));
        output.success(r, '文本已输入');
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 显示当前/最近 Tab 信息
tabCommand
  .command('current')
  .alias('last')
  .description('显示当前/最近操作的 Tab')
  .action(async () => {
    try {
      const tabs = await client.listTabs();
      const activeTab = tabs.find(t => t.active);

      // 读取最近操作的 Tab
      const { getLastTab } = await import('../utils/tab-resolver');
      const lastTabId = getLastTab();
      const lastTab = lastTabId ? tabs.find(t => t.id === lastTabId) : null;

      output.success({
        current: activeTab ? {
          id: activeTab.id,
          name: activeTab.appName || activeTab.appId,
          title: activeTab.title,
          url: activeTab.url,
        } : null,
        last: lastTab ? {
          id: lastTab.id,
          name: lastTab.appName || lastTab.appId,
          title: lastTab.title,
        } : lastTabId ? { id: lastTabId, note: '(Tab 可能已关闭)' } : null,
      });
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });
