#!/usr/bin/env node
/**
 * PolyWebsAI MCP Server
 * 为 AI 提供浏览器控制能力
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BrowserClient } from './client';

const client = new BrowserClient();

// 创建 MCP Server
const server = new Server(
  { name: 'polyweb-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Tab 管理
    {
      name: 'tab_list',
      description: '列出所有打开的 Tab',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'tab_new',
      description: '打开新 Tab',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要打开的 URL' },
          name: { type: 'string', description: 'Tab 名称（可选）' },
        },
        required: ['url'],
      },
    },
    {
      name: 'tab_close',
      description: '关闭 Tab',
      inputSchema: {
        type: 'object',
        properties: { tabId: { type: 'string', description: 'Tab ID' } },
        required: ['tabId'],
      },
    },
    {
      name: 'tab_goto',
      description: '导航到指定 URL',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          url: { type: 'string', description: '目标 URL' },
        },
        required: ['tabId', 'url'],
      },
    },
    {
      name: 'tab_snapshot',
      description: '获取页面快照（DOM 结构，用于理解页面）',
      inputSchema: {
        type: 'object',
        properties: { tabId: { type: 'string', description: 'Tab ID' } },
        required: ['tabId'],
      },
    },
    {
      name: 'tab_screenshot',
      description: '页面截图',
      inputSchema: {
        type: 'object',
        properties: { tabId: { type: 'string', description: 'Tab ID' } },
        required: ['tabId'],
      },
    },
    {
      name: 'tab_execute',
      description: '在页面中执行 JavaScript',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          script: { type: 'string', description: 'JavaScript 代码' },
        },
        required: ['tabId', 'script'],
      },
    },
    {
      name: 'tab_console',
      description: '获取页面控制台日志',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          level: { type: 'string', description: '过滤级别 (log|warn|error|info|debug)' },
        },
        required: ['tabId'],
      },
    },
    {
      name: 'tab_upload',
      description: '上传文件到页面的文件输入框',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          files: { type: 'array', items: { type: 'string' }, description: '文件路径数组' },
        },
        required: ['tabId', 'files'],
      },
    },
    {
      name: 'tab_click',
      description: '点击页面元素',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          selector: { type: 'string', description: 'CSS 选择器' },
        },
        required: ['tabId', 'selector'],
      },
    },
    {
      name: 'tab_type',
      description: '向页面元素输入文本',
      inputSchema: {
        type: 'object',
        properties: {
          tabId: { type: 'string', description: 'Tab ID' },
          selector: { type: 'string', description: 'CSS 选择器' },
          text: { type: 'string', description: '要输入的文本' },
          clear: { type: 'boolean', description: '是否先清空内容' },
        },
        required: ['tabId', 'selector', 'text'],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;
    const a = args as Record<string, unknown>;

    switch (name) {
      case 'tab_list':
        result = await client.listTabs();
        break;
      case 'tab_new':
        result = await client.createTab(a.url as string, 'mcp', a.name as string);
        break;
      case 'tab_close':
        result = await client.closeTab(a.tabId as string);
        break;
      case 'tab_goto':
        result = await client.navigate(a.tabId as string, a.url as string);
        break;
      case 'tab_snapshot':
        result = await client.snapshot(a.tabId as string);
        break;
      case 'tab_screenshot':
        result = await client.screenshot(a.tabId as string);
        break;
      case 'tab_execute':
        result = await client.execute(a.tabId as string, a.script as string);
        break;
      case 'tab_console':
        result = await client.console(a.tabId as string, a.level as string);
        break;
      case 'tab_upload':
        result = await client.upload(a.tabId as string, a.files as string[]);
        break;
      case 'tab_click':
        result = await client.click(a.tabId as string, a.selector as string);
        break;
      case 'tab_type':
        result = await client.type(a.tabId as string, a.selector as string, a.text as string, a.clear as boolean);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PolyWebsAI MCP Server started');
}

main().catch(console.error);
