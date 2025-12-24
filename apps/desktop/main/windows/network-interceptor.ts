import { WebContents } from 'electron';

/**
 * 网络拦截规则
 */
export interface NetworkInterceptorRule {
  id: string; // 规则ID
  pattern: string; // URL匹配模式（用于标识需要拦截的接口）
  enabled: boolean; // 是否启用
}

/**
 * 拦截到的网络数据
 */
export interface InterceptedNetworkData {
  type: 'response'; // 类型：响应
  ruleId: string; // 匹配的规则ID
  url: string; // 请求URL
  data: any; // 响应数据（已解析的 JSON）
  timestamp: number; // 时间戳
}

/**
 * 网络拦截器
 * 通过注入 JavaScript 代码来拦截网络响应
 */
export class NetworkInterceptor {
  private webContents: WebContents;
  private tabId: string;
  private mainWindowWebContents: WebContents; // 主窗口的webContents，用于发送IPC消息
  private rules: Map<string, NetworkInterceptorRule> = new Map();
  private injected: boolean = false; // 是否已注入拦截代码
  private checkInterval: NodeJS.Timeout | null = null; // 检查间隔

  constructor(webContents: WebContents, tabId: string, mainWindowWebContents: WebContents) {
    this.webContents = webContents;
    this.tabId = tabId;
    this.mainWindowWebContents = mainWindowWebContents;
    this.setup();
  }

  /**
   * 设置拦截器
   */
  private setup(): void {
    // 注入拦截代码
    this.injectInterceptor();
    
    // 监听页面加载，确保每次导航后都重新注入
    this.webContents.on('did-finish-load', () => {
      this.injectInterceptor();
    });
    
    // 监听 iframe 加载
    this.webContents.on('did-frame-finish-load', () => {
      this.injectInterceptor();
    });
    
    // 定期检查并读取拦截到的数据
    this.startPolling();
    
    console.log('[NetworkInterceptor] ✅ 网络拦截器已设置（JS注入方式），Tab ID:', this.tabId);
  }

  /**
   * 注入拦截代码
   */
  private injectInterceptor(): void {
    try {
      const injectionCode = `
        (function() {
          // 避免重复注入
          if (window.__polyAppsResponseInterceptorInjected) {
            return;
          }
          window.__polyAppsResponseInterceptorInjected = true;
          
          // Hook Response.prototype.json
          const rawJson = Response.prototype.json;
          Response.prototype.json = function() {
            return rawJson.apply(this, arguments).then(data => {
              try {
                const url = this.url || '';
                // 拦截三个接口：create、queryByMd5 和 pageQuery
                if (url.includes('/phoenix-mms/material/create') || 
                    url.includes('/phoenix-mms/material/queryByMd5') ||
                    url.includes('/phoenix-mms/material/pageQuery')) {
                  console.log('[NetworkInterceptor] 🎯 捕获到 material 响应:', url, data);
                  
                  // 存储拦截到的数据
                  if (!window.__polyAppsInterceptedData) {
                    window.__polyAppsInterceptedData = [];
                  }
                  
                  window.__polyAppsInterceptedData.push({
                    url: url,
                    data: data,
                    timestamp: Date.now()
                  });
                  
                  // 只保留最近30条记录（因为现在有三个接口）
                  if (window.__polyAppsInterceptedData.length > 30) {
                    window.__polyAppsInterceptedData.shift();
                  }
                  
                  console.log('[NetworkInterceptor] ✅ 数据已存储，当前记录数:', window.__polyAppsInterceptedData.length);
                }
              } catch (e) {
                console.error('[NetworkInterceptor] 处理响应数据时出错:', e);
              }
              return data;
            });
          };
          
          console.log('[NetworkInterceptor] ✅ Response.json hook 已注入（支持 create、queryByMd5 和 pageQuery）');
        })();
      `;
      
      this.webContents.executeJavaScript(injectionCode).catch((err) => {
        console.warn('[NetworkInterceptor] 注入拦截代码失败:', err);
      });
    } catch (error) {
      console.warn('[NetworkInterceptor] 注入拦截代码异常:', error);
    }
  }

  /**
   * 开始轮询检查拦截到的数据
   */
  private startPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(async () => {
      await this.checkInterceptedData();
    }, 500); // 每500ms检查一次
  }

  /**
   * 检查拦截到的数据
   */
  private async checkInterceptedData(): Promise<void> {
    try {
      const result = await this.webContents.executeJavaScript(`
        (function() {
          if (!window.__polyAppsInterceptedData || window.__polyAppsInterceptedData.length === 0) {
            return { hasData: false, data: [] };
          }
          
          // 获取所有未处理的数据
          const data = window.__polyAppsInterceptedData.slice();
          
          // 清空已读取的数据
          window.__polyAppsInterceptedData = [];
          
          return { hasData: true, data: data };
        })();
      `);
      
      if (result && result.hasData && result.data && result.data.length > 0) {
        // 处理每条拦截到的数据
        for (const item of result.data) {
          // 检查是否匹配任何规则
          for (const rule of this.rules.values()) {
            if (rule.enabled && this.matchPattern(item.url, rule.pattern)) {
              console.log('[NetworkInterceptor] 📥 发现匹配的响应数据:', {
                ruleId: rule.id,
                url: item.url,
                hasData: !!item.data,
                timestamp: new Date(item.timestamp).toLocaleString()
              });
              
              // 发送拦截数据到渲染进程
              this.sendInterceptedData({
                type: 'response',
                ruleId: rule.id,
                url: item.url,
                data: item.data,
                timestamp: item.timestamp,
              });
            }
          }
        }
      }
    } catch (error: any) {
      // 忽略错误（可能是页面未加载完成）
      if (!error.message?.includes('Cannot execute script')) {
        console.warn('[NetworkInterceptor] 检查拦截数据失败:', error.message);
      }
    }
  }

  /**
   * 匹配URL模式（支持通配符 * 和 ?）
   */
  private matchPattern(url: string, pattern: string): boolean {
    // 将通配符模式转换为正则表达式
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // 转义特殊字符
      .replace(/\*/g, '.*') // * 匹配任意字符
      .replace(/\?/g, '.'); // ? 匹配单个字符
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(url);
  }

  /**
   * 发送拦截数据到渲染进程
   */
  private sendInterceptedData(data: InterceptedNetworkData): void {
    // 发送到主窗口的webContents，然后由主窗口转发到渲染进程
    this.mainWindowWebContents.send('network:intercepted', {
      tabId: this.tabId,
      data,
    });
  }

  /**
   * 添加或更新拦截规则
   */
  addRule(rule: NetworkInterceptorRule): void {
    this.rules.set(rule.id, rule);
    console.log('[NetworkInterceptor] ✅ 添加拦截规则:', rule.id, rule.pattern);
  }

  /**
   * 移除拦截规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    console.log('[NetworkInterceptor] ✅ 移除拦截规则:', ruleId);
  }

  /**
   * 获取所有规则
   */
  getRules(): NetworkInterceptorRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.rules.clear();
    
    // 停止轮询
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    // 清理注入的代码（可选）
    try {
      this.webContents.executeJavaScript(`
        (function() {
          if (window.__polyAppsInterceptedData) {
            window.__polyAppsInterceptedData = [];
          }
        })();
      `).catch(() => {});
    } catch (error) {
      // 忽略错误
    }
    
    console.log('[NetworkInterceptor] 🧹 网络拦截器已清理，Tab ID:', this.tabId);
  }
}

