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
   * 注意：即使没有默认测试图片，也会初始化 CDP 调试器，因为用户可能会提供自定义路径
   */
  async setup(): Promise<void> {
    // 检查是否已经初始化
    if (this.cdpDebugger) {
      console.log('[FileUploadInterceptor] CDP 调试器已初始化，跳过重复初始化');
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
    } catch (error: any) {
      console.error('[FileUploadInterceptor] ❌ 启用 CDP 失败:', error);
      // 清理失败的调试器引用
      this.cdpDebugger = null;
      throw error; // 重新抛出错误，让调用者知道初始化失败
    }
  }

  /**
   * 手动触发文件上传扫描和注入
   * @param customImagePaths 自定义图片路径数组，如果提供则使用此数组，否则使用默认的 testImagePaths
   */
  async triggerScan(customImagePaths?: string[]): Promise<{ success: boolean; count: number; message: string }> {
    // 如果 CDP 调试器未初始化，尝试初始化
    if (!this.cdpDebugger) {
      console.log('[FileUploadInterceptor] CDP 调试器未初始化，尝试初始化...');
      try {
        await this.setup();
      } catch (error: any) {
        console.error('[FileUploadInterceptor] 初始化 CDP 调试器失败:', error);
        return {
          success: false,
          count: 0,
          message: `CDP 调试器初始化失败: ${error.message || '未知错误'}，请确保页面已加载完成`
        };
      }
      
      // 如果初始化后仍然没有调试器，返回错误
      if (!this.cdpDebugger) {
        return {
          success: false,
          count: 0,
          message: 'CDP 调试器初始化失败，请确保页面已加载完成'
        };
      }
    }
    
    // 确定使用的图片路径
    let imagePaths: string[] = [];
    if (customImagePaths && customImagePaths.length > 0) {
      console.log('[FileUploadInterceptor] 收到自定义图片路径:', customImagePaths);
      // 验证自定义路径是否存在
      const validPaths: string[] = [];
      const invalidPaths: string[] = [];
      for (const path of customImagePaths) {
        if (path && existsSync(path)) {
          validPaths.push(path);
          console.log(`[FileUploadInterceptor] ✅ 图片路径有效: ${path}`);
        } else {
          invalidPaths.push(path);
          console.warn(`[FileUploadInterceptor] ⚠️ 图片路径不存在: ${path}`);
        }
      }
      imagePaths = validPaths;
      
      if (invalidPaths.length > 0) {
        console.warn(`[FileUploadInterceptor] ⚠️ 有 ${invalidPaths.length} 个无效路径，已过滤`);
      }
    } else {
      imagePaths = this.testImagePaths;
      console.log('[FileUploadInterceptor] 使用默认测试图片路径:', imagePaths);
    }
    
    if (imagePaths.length === 0) {
      const errorMsg = customImagePaths && customImagePaths.length > 0
        ? `所有图片路径都不存在或无效。请检查路径是否正确。无效路径: ${customImagePaths.join(', ')}`
        : '图片路径不存在或无效，请检查图片路径是否正确';
      return {
        success: false,
        count: 0,
        message: errorMsg
      };
    }
    
    console.log(`[FileUploadInterceptor] ✅ 将使用 ${imagePaths.length} 个有效图片路径进行上传`);
    
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
            
            // 只拦截直接点击文件输入的情况
            if (target.tagName === 'INPUT' && target.type === 'file') {
              fileInput = target;
            } else {
              // 检查是否点击了包含文件输入的元素（更精确的匹配）
              // 只检查按钮或明确标记为上传的元素
              const parent = target.closest('button, [data-testid*="upload"], [class*="upload-trigger"], [class*="upload-button"]');
              if (parent) {
                // 只在父元素内查找文件输入，不查找整个文档
                fileInput = parent.querySelector('input[type="file"]');
              }
              
              // 如果点击的元素本身就是文件输入的容器
              if (!fileInput && (target.closest('label') || target.getAttribute('for'))) {
                const label = target.closest('label');
                if (label) {
                  const forAttr = label.getAttribute('for');
                  if (forAttr) {
                    fileInput = document.getElementById(forAttr);
                    if (fileInput && fileInput.type !== 'file') {
                      fileInput = null;
                    }
                  } else {
                    fileInput = label.querySelector('input[type="file"]');
                  }
                }
              }
            }
            
            // 只有在找到文件输入且未设置过的情况下才拦截
            if (fileInput && fileInput.type === 'file' && !fileInput.dataset.polyAppsFileSet) {
              console.log('[Poly Apps] 🎯 拦截到文件输入点击，准备设置文件');
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              
              fileInput.dataset.polyAppsPendingFile = 'true';
              console.log('[Poly Apps] ✅ 已标记文件输入为待处理');
            } else if (fileInput && fileInput.type === 'file') {
              console.log('[Poly Apps] ⚠️ 文件输入已设置过，跳过');
            }
            // 如果没有找到文件输入，不拦截，让事件正常传播
          };
          
          // 保存引用以便后续移除
          window.__polyAppsFileClickInterceptor = clickHandler;
          
          // 添加新的监听器（使用捕获阶段，确保能拦截到所有点击）
          document.addEventListener('click', clickHandler, true);
          
          // 也监听 mousedown 事件，因为有些组件可能在 mousedown 时处理文件选择
          // 但只在明确是文件上传相关元素时才拦截
          const mouseDownHandler = function(event) {
            const target = event.target;
            
            // 只拦截直接点击文件输入的情况
            if (target.tagName === 'INPUT' && target.type === 'file') {
              clickHandler(event);
            } else {
              // 检查是否点击了明确标记为上传的按钮
              const parent = target.closest('button[data-testid*="upload"], button[class*="upload"], [data-testid*="upload-button"]');
              if (parent) {
                const fileInput = parent.querySelector('input[type="file"]');
                if (fileInput && fileInput.type === 'file') {
                  clickHandler(event);
                }
              }
            }
            // 其他情况不拦截，让事件正常传播
          };
          
          document.addEventListener('mousedown', mouseDownHandler, true);
          window.__polyAppsFileMouseDownInterceptor = mouseDownHandler;
          
          console.log('[Poly Apps] ✅ 文件输入点击拦截器已设置（支持 click 和 mousedown）');
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

    // 定时检查待设置的文件输入（更频繁的检查，确保能及时响应）
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
              // 注意：dataset.polyAppsPendingFile 对应 data-poly-apps-pending-file 属性
              const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
              const pendingInputs = inputs.filter(input => {
                const hasPending = input.dataset.polyAppsPendingFile === 'true';
                if (hasPending) {
                  console.log('[Poly Apps] 🔍 发现待处理的文件输入:', {
                    testId: input.getAttribute('data-testid') || '',
                    id: input.id || '',
                    className: input.className || '',
                    hasPending: true
                  });
                }
                return hasPending;
              });
              
              if (pendingInputs.length === 0) return [];
              
              const result = pendingInputs.map(input => ({
                testId: input.getAttribute('data-testid') || '',
                id: input.id || '',
                className: input.className || ''
              }));
              
              pendingInputs.forEach(input => {
                input.dataset.polyAppsPendingFile = '';
              });
              
              console.log('[Poly Apps] ✅ 找到', pendingInputs.length, '个待处理的文件输入');
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
              console.log(`[FileUploadInterceptor] 🔍 查找文件输入:`, inputInfo);
              
              // 尝试多种查询方式
              let searchQuery = `input[type="file"]`;
              if (inputInfo.testId) {
                searchQuery = `input[type="file"][data-testid="${inputInfo.testId}"]`;
              } else if (inputInfo.id) {
                searchQuery = `input[type="file"]#${inputInfo.id}`;
              } else if (inputInfo.className) {
                // 使用第一个类名
                const firstClass = inputInfo.className.split(' ')[0];
                if (firstClass) {
                  searchQuery = `input[type="file"].${firstClass}`;
                }
              }
              
              console.log(`[FileUploadInterceptor] 🔍 使用查询: ${searchQuery}`);
              
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

                  console.log(`[FileUploadInterceptor] 📤 准备为节点 ${nodeId} 设置文件，文件数量: ${this.currentImagePaths.length}`);
                  console.log(`[FileUploadInterceptor] 📤 文件路径:`, this.currentImagePaths);

                  // 设置文件（支持多文件上传）
                  try {
                    await this.cdpDebugger!.sendCommand('DOM.setFileInputFiles', {
                      nodeId: nodeId,
                      files: this.currentImagePaths // 使用当前拦截的图片路径
                    });
                    console.log('[FileUploadInterceptor] ✅ 已通过 CDP 为节点', nodeId, '设置文件');

                    // 标记已设置
                    await this.cdpDebugger!.sendCommand('Runtime.evaluate', {
                      expression: `
                        (function() {
                          const input = document.querySelector('${searchQuery.replace(/"/g, '\\"')}');
                          if (input) {
                            input.dataset.polyAppsFileSet = 'true';
                            // 触发 change 事件，让页面知道文件已选择
                            const changeEvent = new Event('change', { bubbles: true });
                            input.dispatchEvent(changeEvent);
                            console.log('[Poly Apps] ✅ 已设置文件并触发 change 事件');
                          }
                        })();
                      `
                    });

                    console.log('[FileUploadInterceptor] ✅ 已通过 CDP 为节点', nodeId, '设置文件（点击时）');

                    // 设置文件成功后，立即停止拦截（一次性拦截）
                    this.stop();
                  } catch (fileError: any) {
                    console.error('[FileUploadInterceptor] ❌ 设置文件失败:', fileError);
                    // 继续处理其他待设置的文件输入
                  }
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

