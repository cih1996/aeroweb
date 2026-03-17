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
  .option('-s, --session <id>', '使用指定缓存/会话（默认: ai-default）')
  .option('-w, --wait <seconds>', '等待页面加载（秒）')
  .option('--screenshot <file>', '截图保存到文件')
  .action(async (url, o) => {
    try {
      const tab = await client.createTab(url, o.name, o.app, o.session);
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

// 等待元素
tabCommand
  .command('wait-element <tabId> <selector>')
  .alias('wait-el')
  .description('等待元素出现')
  .option('-t, --timeout <ms>', '超时时间（毫秒）', '30000')
  .option('-v, --visible', '要求元素可见')
  .action(async (tabIdInput, selector, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const timeout = parseInt(o.timeout, 10);
      const r = await withLastTab(tabId, () => client.waitElement(tabId, selector, timeout, o.visible));
      output.success(r, `元素已出现 (${r.elapsed}ms)`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 等待文本
tabCommand
  .command('wait-text <tabId> <text>')
  .alias('wait-txt')
  .description('等待文本出现（支持正则如 /pattern/i）')
  .option('-t, --timeout <ms>', '超时时间（毫秒）', '30000')
  .option('-s, --selector <selector>', '限定搜索范围')
  .action(async (tabIdInput, text, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const timeout = parseInt(o.timeout, 10);
      const r = await withLastTab(tabId, () => client.waitText(tabId, text, timeout, o.selector));
      output.success(r, `文本已出现 (${r.elapsed}ms)`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 网络监控 - 启动
tabCommand
  .command('network-start <tabId>')
  .alias('net-on')
  .description('启动网络请求监控')
  .action(async (tabIdInput) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.networkStart(tabId));
      output.success(r, '网络监控已启动');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 网络监控 - 停止
tabCommand
  .command('network-stop <tabId>')
  .alias('net-off')
  .description('停止网络请求监控')
  .action(async (tabIdInput) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.networkStop(tabId));
      output.success(r, '网络监控已停止');
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 网络监控 - 获取请求
tabCommand
  .command('network <tabId>')
  .alias('net')
  .description('获取网络请求记录')
  .option('-u, --url <pattern>', '按 URL 过滤')
  .option('-m, --method <method>', '按方法过滤 (GET/POST/...)')
  .option('-s, --status <code>', '按状态码过滤')
  .option('--clear', '清空请求记录')
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);

      if (o.clear) {
        const r = await withLastTab(tabId, () => client.networkClear(tabId));
        output.success(r, '请求记录已清空');
        return;
      }

      const filter: any = {};
      if (o.url) filter.url = o.url;
      if (o.method) filter.method = o.method;
      if (o.status) filter.status = parseInt(o.status, 10);

      const requests = await withLastTab(tabId, () => client.networkGet(tabId, Object.keys(filter).length ? filter : undefined));

      if (requests.length === 0) {
        output.success([], '暂无请求记录（提示：先执行 network-start 启动监控）');
      } else {
        const summary = requests.map(r => ({
          method: r.method,
          status: r.status || '-',
          duration: r.duration ? `${r.duration}ms` : '-',
          size: r.size ? `${Math.round(r.size / 1024)}KB` : '-',
          url: r.url.length > 60 ? r.url.substring(0, 60) + '...' : r.url,
        }));
        output.table(summary, ['method', 'status', 'duration', 'size', 'url']);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// 网络监控 - 等待请求
tabCommand
  .command('network-wait <tabId> <urlPattern>')
  .alias('net-wait')
  .description('等待特定网络请求完成')
  .option('-t, --timeout <ms>', '超时时间（毫秒）', '30000')
  .action(async (tabIdInput, urlPattern, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const timeout = parseInt(o.timeout, 10);
      const r = await withLastTab(tabId, () => client.networkWait(tabId, urlPattern, timeout));
      if (r.request) {
        output.success({
          url: r.request.url,
          method: r.request.method,
          status: r.request.status,
          duration: r.request.duration,
          elapsed: r.elapsed,
        }, `请求已完成 (${r.elapsed}ms)`);
      } else {
        output.success(r);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// Cookie - 获取
tabCommand
  .command('cookies <tabId>')
  .alias('cookie')
  .description('获取 Cookie')
  .option('-n, --name <name>', '指定 Cookie 名称')
  .option('-u, --url <url>', '指定 URL')
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const cookies = await withLastTab(tabId, () => client.getCookies(tabId, o.url, o.name));

      if (cookies.length === 0) {
        output.success([], '暂无 Cookie');
      } else {
        const summary = cookies.map(c => ({
          name: c.name,
          value: c.value.length > 30 ? c.value.substring(0, 30) + '...' : c.value,
          domain: c.domain,
          path: c.path,
          secure: c.secure ? '✓' : '',
          httpOnly: c.httpOnly ? '✓' : '',
        }));
        output.table(summary, ['name', 'value', 'domain', 'path', 'secure', 'httpOnly']);
      }
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// Cookie - 设置
tabCommand
  .command('cookie-set <tabId> <name> <value>')
  .description('设置 Cookie')
  .option('-u, --url <url>', '指定 URL')
  .option('-d, --domain <domain>', '域名')
  .option('-p, --path <path>', '路径', '/')
  .option('--secure', '仅 HTTPS')
  .option('--http-only', '仅 HTTP（JS 不可访问）')
  .option('-e, --expires <days>', '过期天数')
  .action(async (tabIdInput, name, value, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const cookie: any = { name, value };
      if (o.url) cookie.url = o.url;
      if (o.domain) cookie.domain = o.domain;
      if (o.path) cookie.path = o.path;
      if (o.secure) cookie.secure = true;
      if (o.httpOnly) cookie.httpOnly = true;
      if (o.expires) {
        const days = parseInt(o.expires, 10);
        cookie.expirationDate = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
      }

      const r = await withLastTab(tabId, () => client.setCookie(tabId, cookie));
      output.success(r, `Cookie '${name}' 已设置`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// Cookie - 删除
tabCommand
  .command('cookie-delete <tabId> <name>')
  .alias('cookie-del')
  .description('删除指定 Cookie')
  .option('-u, --url <url>', '指定 URL')
  .action(async (tabIdInput, name, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.removeCookie(tabId, name, o.url));
      output.success(r, `Cookie '${name}' 已删除`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });

// Cookie - 清空
tabCommand
  .command('cookies-clear <tabId>')
  .description('清空所有 Cookie')
  .option('-u, --url <url>', '只清除指定 URL 的 Cookie')
  .action(async (tabIdInput, o) => {
    try {
      const tabId = await resolveTabId(tabIdInput);
      const r = await withLastTab(tabId, () => client.clearCookies(tabId, o.url));
      output.success(r, `已清空 ${r.count} 个 Cookie`);
    } catch (e: any) {
      output.error(e.message);
      process.exit(1);
    }
  });
