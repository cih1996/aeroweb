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
    // 实例管理
    {
      name: 'instance_create',
      description: '创建新的浏览器实例（独立缓存/cookie）',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '实例ID' },
          name: { type: 'string', description: '实例名称' },
        },
        required: ['id'],
      },
    },
    {
      name: 'instance_list',
      description: '列出所有浏览器实例',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'instance_close',
      description: '关闭浏览器实例',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: '实例ID' } },
        required: ['id'],
      },
    },
    // 页面管理
    {
      name: 'page_new',
      description: '在实例中打开新页面',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          url: { type: 'string', description: '要打开的URL' },
        },
        required: ['instance', 'url'],
      },
    },
    {
      name: 'page_list',
      description: '列出实例中的所有页面',
      inputSchema: {
        type: 'object',
        properties: { instance: { type: 'string', description: '实例ID' } },
        required: ['instance'],
      },
    },
    {
      name: 'page_close',
      description: '关闭页面',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
        },
        required: ['instance', 'pageId'],
      },
    },
    {
      name: 'page_goto',
      description: '导航到指定URL',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          url: { type: 'string', description: '目标URL' },
        },
        required: ['instance', 'pageId', 'url'],
      },
    },
    {
      name: 'page_snapshot',
      description: '获取页面快照（a11y树，用于理解页面结构）',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
        },
        required: ['instance', 'pageId'],
      },
    },
    {
      name: 'page_screenshot',
      description: '页面截图',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          fullPage: { type: 'boolean', description: '是否全页面截图' },
        },
        required: ['instance', 'pageId'],
      },
    },
    // 元素操作
    {
      name: 'action_click',
      description: '点击页面元素',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          uid: { type: 'string', description: '元素UID（从snapshot获取）' },
        },
        required: ['instance', 'pageId', 'uid'],
      },
    },
    {
      name: 'action_fill',
      description: '填充输入框',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          uid: { type: 'string', description: '元素UID' },
          value: { type: 'string', description: '要填充的值' },
        },
        required: ['instance', 'pageId', 'uid', 'value'],
      },
    },
    {
      name: 'action_evaluate',
      description: '在页面中执行JavaScript',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          script: { type: 'string', description: 'JavaScript代码' },
        },
        required: ['instance', 'pageId', 'script'],
      },
    },
    {
      name: 'action_wait',
      description: '等待页面中出现指定文本',
      inputSchema: {
        type: 'object',
        properties: {
          instance: { type: 'string', description: '实例ID' },
          pageId: { type: 'string', description: '页面ID' },
          text: { type: 'array', items: { type: 'string' }, description: '要等待的文本列表' },
          timeout: { type: 'number', description: '超时时间(ms)' },
        },
        required: ['instance', 'pageId', 'text'],
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
      // 实例管理
      case 'instance_create':
        result = await client.createInstance({ id: a.id as string, name: (a.name || a.id) as string });
        break;
      case 'instance_list':
        result = await client.listInstances();
        break;
      case 'instance_close':
        result = await client.closeInstance(a.id as string);
        break;

      // 页面管理
      case 'page_new':
        result = await client.newPage(a.instance as string, a.url as string);
        break;
      case 'page_list':
        result = await client.listPages(a.instance as string);
        break;
      case 'page_close':
        result = await client.closePage(a.instance as string, a.pageId as string);
        break;
      case 'page_goto':
        result = await client.navigate(a.instance as string, a.pageId as string, { type: 'url', url: a.url as string });
        break;
      case 'page_snapshot':
        result = await client.takeSnapshot(a.instance as string, a.pageId as string);
        break;
      case 'page_screenshot':
        result = await client.takeScreenshot(a.instance as string, a.pageId as string, { fullPage: a.fullPage as boolean });
        break;

      // 元素操作
      case 'action_click':
        result = await client.click(a.instance as string, a.pageId as string, a.uid as string);
        break;
      case 'action_fill':
        result = await client.fill(a.instance as string, a.pageId as string, a.uid as string, a.value as string);
        break;
      case 'action_evaluate':
        result = await client.evaluate(a.instance as string, a.pageId as string, a.script as string);
        break;
      case 'action_wait':
        result = await client.waitFor(a.instance as string, a.pageId as string, a.text as string[], a.timeout as number);
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
