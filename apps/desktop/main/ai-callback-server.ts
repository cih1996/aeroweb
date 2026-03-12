/**
 * AI 回调服务器
 * 运行在 Electron Main 进程中，接收来自 AI Agent 系统的回调请求
 */

import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { BrowserWindow } from 'electron';

export class AICallbackServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private mainWindow: BrowserWindow | null = null;

  constructor(port: number = 5022) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    // 解析 JSON 请求体
    this.app.use(express.json());
    
    // CORS 支持
    this.app.use((req: any, res: any, next: any) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes() {
    // 健康检查
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        name: 'PolyWebsAI Callback Server',
        status: 'running',
        version: '1.0.0'
      });
    });

    // 执行能力回调
    this.app.post('/execute', async (req: Request, res: Response) => {
      try {
        const { action, params } = req.body;
        
        console.log('[AI Callback] 收到回调请求:', {
          action,
          params,
          timestamp: new Date().toISOString()
        });

        if (!this.mainWindow) {
          return res.status(500).json({
            success: false,
            data: {},
            message: '窗口未初始化'
          });
        }

        // 将请求转发到渲染进程
        const result = await this.mainWindow.webContents.executeJavaScript(`
          (async () => {
            try {
              // 触发自定义事件，让渲染进程处理
              const event = new CustomEvent('ai-execute-action', {
                detail: {
                  action: ${JSON.stringify(action)},
                  params: ${JSON.stringify(params)}
                }
              });
              window.dispatchEvent(event);
              
              // 等待渲染进程处理并返回结果
              return await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('执行超时'));
                }, 30000);
                
                const handler = (e) => {
                  clearTimeout(timeout);
                  window.removeEventListener('ai-execute-result', handler);
                  resolve(e.detail);
                };
                
                window.addEventListener('ai-execute-result', handler);
              });
            } catch (err) {
              return {
                success: false,
                data: {},
                message: err.message || String(err)
              };
            }
          })()
        `);

        console.log('[AI Callback] 执行结果:', result);
        res.json(result);
      } catch (err: any) {
        console.error('[AI Callback] 执行错误:', err);
        res.status(500).json({
          success: false,
          data: {},
          message: err.message || String(err)
        });
      }
    });
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * 启动服务器
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`✓ [AI Callback Server] 已启动在端口 ${this.port}`);
          console.log(`  回调地址: http://localhost:${this.port}/execute`);
          resolve(this.port);
        });

        this.server.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[AI Callback Server] 端口 ${this.port} 被占用，尝试下一个端口...`);
            this.port++;
            this.start().then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 停止服务器
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[AI Callback Server] 已停止');
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * 获取服务器地址
   */
  getCallbackUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * 获取端口号
   */
  getPort(): number {
    return this.port;
  }
}

// 导出单例
let serverInstance: AICallbackServer | null = null;

export function getAICallbackServer(port?: number): AICallbackServer {
  if (!serverInstance) {
    serverInstance = new AICallbackServer(port);
  }
  return serverInstance;
}

