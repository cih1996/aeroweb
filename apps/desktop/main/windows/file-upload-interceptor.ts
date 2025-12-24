import { WebContents, Debugger } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * 文件上传拦截器
 * 负责拦截文件上传事件并自动注入测试图片
 */
export class FileUploadInterceptor {
  private cdpDebugger: Debugger | null = null;
  private fileInputNodeIds: Set<number> = new Set();
  private testImagePaths: string[] = []; // 存储所有测试图片路径，支持多文件上传
  private currentImagePaths: string[] = []; // 当前拦截使用的图片路径
  private isIntercepting: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private processedNodeIds: Set<number> = new Set();
  private messageHandler: ((event: any, method: string, params: any, sessionId?: string) => void) | null = null;

  constructor(
    private webContents: WebContents,
    private tabId: string
  ) {
    this.initializeTestImagePath();
  }

  /**
   * 初始化测试图片路径（支持多文件）
   */
  private initializeTestImagePath(): void {
    const testImagePaths = [
      join(__dirname, '../../../renderer/public/test-images/1.png'),
      join(__dirname, '../../../renderer/public/test-images/2.png'),
    ];

    // 查找所有存在的测试图片
    for (const path of testImagePaths) {
      if (existsSync(path)) {
        this.testImagePaths.push(path);
      }
    }

    if (this.testImagePaths.length > 0) {
      console.log('[FileUploadInterceptor] 找到', this.testImagePaths.length, '张测试图片:', this.testImagePaths);
    } else {
      console.warn('[FileUploadInterceptor] ⚠️ 未找到测试图片，文件上传拦截可能无法工作');
    }
  }

  /**
   * 设置文件选择拦截器（CDP 方式）
   */
  async setup(): Promise<void> {
    if (this.testImagePaths.length === 0) {
      console.warn('[FileUploadInterceptor] ⚠️ 测试图片路径不存在，无法设置拦截器');
      return;
    }

    try {
      // 附加 CDP 调试器
      this.cdpDebugger = this.webContents.debugger;
      this.cdpDebugger.attach('1.3');
      console.log('[FileUploadInterceptor] ✅ CDP 调试器已附加');

      // 启用必要的 CDP 域
      await this.cdpDebugger.sendCommand('DOM.enable');
      await this.cdpDebugger.sendCommand('Page.enable');
      await this.cdpDebugger.sendCommand('Runtime.enable');
      console.log('[FileUploadInterceptor] ✅ CDP 域已启用');

      // 监听 DOM 节点插入事件
      this.messageHandler = async (event: any, method: string, params: any) => {
        try {
          if (method === 'DOM.childNodeInserted') {
            const { node } = params;
            if (node && node.nodeName === 'INPUT') {
              // 检查是否正在拦截
              if (!this.isIntercepting) {
                return;
              }

              // 获取节点的属性，检查是否为文件输入
              const { attributes } = await this.cdpDebugger!.sendCommand('DOM.getAttributes', { nodeId: node.nodeId });
              const typeAttr = attributes.find((attr: string, index: number) => 
                index % 2 === 0 && attr === 'type'
              );
              const typeValue = attributes[attributes.indexOf(typeAttr) + 1];
              
              if (typeValue === 'file' && !this.processedNodeIds.has(node.nodeId)) {
                this.fileInputNodeIds.add(node.nodeId);
                console.log('[FileUploadInterceptor] 🎯 检测到新的文件输入元素，节点 ID:', node.nodeId);
              }
            }
          }
        } catch (error) {
          // 忽略错误
        }
      };

      this.cdpDebugger.on('message', this.messageHandler);

      // 监听页面导航事件，在导航后重新设置点击拦截器
      this.webContents.on('did-finish-load', () => {
        console.log('[FileUploadInterceptor] 页面加载完成，重新设置点击拦截器');
        // 延迟一点时间，确保 DOM 已准备好
        setTimeout(() => {
          this.setupClickInterceptor();
        }, 500);
      });

      // 清理：当 webContents 被销毁时
      this.webContents.once('destroyed', () => {
        this.cleanup();
      });

      // 初始设置点击拦截器
      setTimeout(() => {
        this.setupClickInterceptor();
      }, 500);

      console.log('[FileUploadInterceptor] ✅ 文件选择拦截器已设置（被动模式）');
    } catch (error) {
      console.error('[FileUploadInterceptor] ❌ 启用 CDP 失败:', error);
    }
  }

  /**
   * 手动触发文件上传扫描和注入
   * @param customImagePaths 自定义图片路径数组，如果提供则使用此数组，否则使用默认的 testImagePaths
   */
  async triggerScan(customImagePaths?: string[]): Promise<{ success: boolean; count: number; message: string }> {
    const imagePaths = customImagePaths && customImagePaths.length > 0 
      ? customImagePaths 
      : this.testImagePaths;
    
    if (!this.cdpDebugger || imagePaths.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'CDP 调试器未初始化或图片路径不存在'
      };
    }
    
    // 设置当前拦截使用的图片路径
    this.currentImagePaths = [...imagePaths];

    try {
      console.log('[FileUploadInterceptor] 🔍 手动触发扫描文件输入元素...');
      
      // 重置拦截状态
      this.isIntercepting = true;
      this.processedNodeIds.clear();
      this.fileInputNodeIds.clear();

      // 清除所有文件输入的标记，允许再次拦截
      await this.cdpDebugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            inputs.forEach(input => {
              delete input.dataset.polyAppsFileSet;
              delete input.dataset.polyAppsPendingFile;
            });
            console.log('[Poly Apps] 已清除', inputs.length, '个文件输入的拦截标记');
          })();
        `,
        userGesture: false
      }).catch((error) => {
        console.warn('[FileUploadInterceptor] ⚠️ 清除文件输入标记失败:', error);
      });

      // 使用 Runtime.evaluate 查找所有文件输入元素
      const evalResult = await this.cdpDebugger.sendCommand('Runtime.evaluate', {
        expression: `
          (function() {
            const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
            return inputs.map((input) => ({
              id: input.id || '',
              className: input.className || '',
              testId: input.getAttribute('data-testid') || ''
            }));
          })()
        `,
        returnByValue: true
      });
      
      if (evalResult.result && evalResult.result.value) {
        const inputs = evalResult.result.value;
        console.log(`[FileUploadInterceptor] 🎯 找到 ${inputs.length} 个文件输入元素`);
        
        if (inputs.length > 0) {
          // 获取文档根节点
          const { root } = await this.cdpDebugger.sendCommand('DOM.getDocument', { depth: -1 });
          
          // 为每个找到的元素获取节点 ID
          for (const inputInfo of inputs) {
            try {
              const searchQuery = `input[type="file"]${inputInfo.testId ? `[data-testid="${inputInfo.testId}"]` : ''}`;
              const searchResult = await this.cdpDebugger.sendCommand('DOM.performSearch', {
                query: searchQuery,
                includeUserAgentShadowDOM: false
              });
              
              if (searchResult.searchId) {
                const { nodeIds } = await this.cdpDebugger.sendCommand('DOM.getSearchResults', {
                  searchId: searchResult.searchId,
                  fromIndex: 0,
                  toIndex: 1
                });
                
                if (nodeIds && nodeIds.length > 0) {
                  this.fileInputNodeIds.add(nodeIds[0]);
                }
                
                await this.cdpDebugger.sendCommand('DOM.discardSearchResults', { searchId: searchResult.searchId });
              }
            } catch (error) {
              // 忽略错误
            }
          }
        }
      }

      // 设置点击拦截器
      this.setupClickInterceptor();

      const message = this.fileInputNodeIds.size > 0
        ? `扫描完成，发现 ${this.fileInputNodeIds.size} 个文件输入元素，已准备拦截`
        : '未发现文件输入元素';
      
      console.log(`[FileUploadInterceptor] ✅ ${message}`);
      
      return {
        success: true,
        count: this.fileInputNodeIds.size,
        message
      };
    } catch (error: any) {
      console.error('[FileUploadInterceptor] ⚠️ 扫描文件输入元素失败:', error);
      return {
        success: false,
        count: 0,
        message: error.message || '扫描失败'
      };
    }
  }

  /**
   * 设置点击拦截器
   */
  private setupClickInterceptor(): void {
    if (!this.cdpDebugger) return;

    // 注入 JavaScript 拦截点击事件
    // 移除 window.__polyAppsFileClickInterceptor 检查，每次都重新设置，确保在页面导航后也能工作
    this.cdpDebugger.sendCommand('Runtime.evaluate', {
      expression: `
        (function() {
          // 移除旧的监听器（如果存在）
          if (window.__polyAppsFileClickInterceptor) {
            document.removeEventListener('click', window.__polyAppsFileClickInterceptor, true);
          }
          
          // 创建新的点击拦截器函数
          const clickHandler = function(event) {
            const target = event.target;
            let fileInput = null;
            
            if (target.tagName === 'INPUT' && target.type === 'file') {
              fileInput = target;
            } else {
              const parent = target.closest('[data-testid*="upload"], [class*="upload"], [class*="UPD"]');
              if (parent) {
                fileInput = parent.querySelector('input[type="file"]');
              }
            }
            
            if (fileInput && !fileInput.dataset.polyAppsFileSet) {
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              
              fileInput.dataset.polyAppsPendingFile = 'true';
            }
          };
          
          // 保存引用以便后续移除
          window.__polyAppsFileClickInterceptor = clickHandler;
          
          // 添加新的监听器
          document.addEventListener('click', clickHandler, true);
          
          console.log('[Poly Apps] 文件输入点击拦截器已设置');
        })();
      `,
      userGesture: false
    }).catch((error) => {
      console.warn('[FileUploadInterceptor] ⚠️ 设置点击拦截失败:', error);
    });

    // 清除旧的定时器（如果存在）
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // 定时检查待设置的文件输入
    this.checkInterval = setInterval(async () => {
      try {
        // 检查是否正在拦截
        if (!this.isIntercepting) {
          return;
        }

        // 检查是否有待设置的文件输入
        const checkResult = await this.cdpDebugger!.sendCommand('Runtime.evaluate', {
          expression: `
            (function() {
              const inputs = Array.from(document.querySelectorAll('input[type="file"][data-poly-apps-pending-file]'));
              if (inputs.length === 0) return [];
              
              const result = inputs.map(input => ({
                testId: input.getAttribute('data-testid') || '',
                id: input.id || '',
                className: input.className || ''
              }));
              
              inputs.forEach(input => {
                input.dataset.polyAppsPendingFile = '';
              });
              
              return result;
            })()
          `,
          returnByValue: true
        });

        if (checkResult.result && checkResult.result.value && checkResult.result.value.length > 0) {
          const pendingInputs = checkResult.result.value;
          console.log(`[FileUploadInterceptor] 🎯 检测到 ${pendingInputs.length} 个待设置的文件输入`);

          // 为每个待设置的文件输入设置文件
          for (const inputInfo of pendingInputs) {
            try {
              const searchQuery = `input[type="file"]${inputInfo.testId ? `[data-testid="${inputInfo.testId}"]` : ''}`;
              const searchResult = await this.cdpDebugger!.sendCommand('DOM.performSearch', {
                query: searchQuery,
                includeUserAgentShadowDOM: false
              });

              if (searchResult.searchId) {
                const { nodeIds } = await this.cdpDebugger!.sendCommand('DOM.getSearchResults', {
                  searchId: searchResult.searchId,
                  fromIndex: 0,
                  toIndex: 1
                });

                if (nodeIds && nodeIds.length > 0) {
                  const nodeId = nodeIds[0];

                  // 检查是否已处理过
                  if (this.processedNodeIds.has(nodeId)) {
                    await this.cdpDebugger!.sendCommand('DOM.discardSearchResults', { searchId: searchResult.searchId });
                    continue;
                  }

                  // 标记为已处理
                  this.processedNodeIds.add(nodeId);

                  // 设置文件（支持多文件上传）
                  await this.cdpDebugger!.sendCommand('DOM.setFileInputFiles', {
                    nodeId: nodeId,
                    files: this.currentImagePaths // 使用当前拦截的图片路径
                  });

                  // 标记已设置
                  await this.cdpDebugger!.sendCommand('Runtime.evaluate', {
                    expression: `
                      (function() {
                        const input = document.querySelector('${searchQuery.replace(/"/g, '\\"')}');
                        if (input) {
                          input.dataset.polyAppsFileSet = 'true';
                        }
                      })();
                    `
                  });

                  console.log('[FileUploadInterceptor] ✅ 已通过 CDP 为节点', nodeId, '设置文件（点击时）');

                  // 设置文件成功后，立即停止拦截（一次性拦截）
                  this.stop();
                }

                await this.cdpDebugger!.sendCommand('DOM.discardSearchResults', { searchId: searchResult.searchId });
              }
            } catch (error) {
              console.warn('[FileUploadInterceptor] ⚠️ 设置文件失败:', error);
            }
          }
        }
      } catch (error) {
        // 忽略错误
      }
    }, 50);
  }

  /**
   * 停止拦截
   */
  stop(): void {
    this.isIntercepting = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    console.log('[FileUploadInterceptor] 🛑 文件上传拦截已停止（一次性拦截），如需再次使用请重新点击开始按钮');
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stop();
    
    if (this.cdpDebugger && this.messageHandler) {
      this.cdpDebugger.off('message', this.messageHandler);
      try {
        this.cdpDebugger.detach();
      } catch (error) {
        // 忽略错误
      }
    }
    
    this.fileInputNodeIds.clear();
    this.processedNodeIds.clear();
    this.cdpDebugger = null;
    this.messageHandler = null;
    
    console.log('[FileUploadInterceptor] ✅ 已清理所有资源');
  }
}

