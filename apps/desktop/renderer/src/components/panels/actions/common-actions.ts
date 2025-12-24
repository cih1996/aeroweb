/**
 * 通用操作工具函数
 * 封装通用的浏览器操作方法，适用于所有应用
 */

/**
 * 延迟操作
 * @param tabId 标签页ID（可选，用于日志）
 * @param delay 延迟时间（毫秒）
 * @returns 延迟完成的结果
 */
export async function delay(
  tabId: string | null,
  delay: number
): Promise<{ success: boolean; delay: number; message: string }> {
  if (delay < 0) {
    throw new Error('延迟时间不能为负数');
  }
  
  if (delay > 60000) {
    throw new Error('延迟时间不能超过60秒（60000毫秒）');
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        delay,
        message: `已延迟 ${delay} 毫秒`,
      });
    }, delay);
  });
}

/**
 * 获取浏览器标签页信息
 * @param tabId 标签页ID
 * @returns 标签页信息
 */
export async function getBrowserInfo(tabId: string | null): Promise<{
  tabId: string;
  title: string;
  url: string;
  active: boolean;
  appId: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  try {
    const tabs = await window.electronAPI.tab.list();
    const tab = tabs.find(t => t.id === tabId);
    
    if (!tab) {
      throw new Error(`找不到标签页: ${tabId}`);
    }

    // 执行脚本获取页面状态
    const pageState = await window.electronAPI.tab.executeScript(tabId, `
      (function() {
        return {
          url: window.location.href,
          title: document.title,
          readyState: document.readyState,
          canGoBack: window.history.length > 1,
          canGoForward: false, // 需要额外检查
        };
      })();
    `).catch(() => ({
      url: tab.url || '',
      title: tab.title || '',
      readyState: 'unknown',
      canGoBack: false,
      canGoForward: false,
    }));

    return {
      tabId: tab.id,
      title: pageState.title || tab.title || '无标题',
      url: pageState.url || tab.url || '',
      active: tab.active || false,
      appId: tab.appId || '',
      loading: pageState.readyState !== 'complete',
      canGoBack: pageState.canGoBack || false,
      canGoForward: pageState.canGoForward || false,
    };
  } catch (err: any) {
    console.error('[common-actions] 获取浏览器信息失败:', err);
    throw err;
  }
}

/**
 * 等待页面加载完成
 * @param tabId 标签页ID
 * @param timeout 超时时间（毫秒），默认10秒
 * @returns 加载状态
 */
export async function waitForPageLoad(
  tabId: string | null,
  timeout: number = 10000
): Promise<{ success: boolean; message: string }> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkLoad = async () => {
      try {
        const state = await window.electronAPI.tab.executeScript(tabId, `
          (function() {
            return document.readyState === 'complete';
          })();
        `);
        
        if (state === true) {
          resolve({
            success: true,
            message: '页面加载完成',
          });
          return;
        }
        
        // 检查超时
        if (Date.now() - startTime > timeout) {
          reject(new Error(`等待页面加载超时（${timeout}ms）`));
          return;
        }
        
        // 继续检查
        setTimeout(checkLoad, 100);
      } catch (err: any) {
        reject(new Error(`检查页面状态失败: ${err.message}`));
      }
    };
    
    checkLoad();
  });
}

/**
 * 滚动页面
 * @param tabId 标签页ID
 * @param options 滚动选项
 * @returns 滚动结果
 */
export async function scrollPage(
  tabId: string | null,
  options: {
    x?: number;
    y?: number;
    behavior?: 'auto' | 'smooth';
  } = {}
): Promise<{ success: boolean; message: string; position: { x: number; y: number } }> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  const { x, y, behavior = 'smooth' } = options;

  try {
    const result = await window.electronAPI.tab.executeScript(tabId, `
      (function() {
        const scrollX = ${x !== undefined ? x : 'window.scrollX'};
        const scrollY = ${y !== undefined ? y : 'window.scrollY'};
        
        window.scrollTo({
          left: scrollX,
          top: scrollY,
          behavior: '${behavior}'
        });
        
        return {
          x: window.scrollX,
          y: window.scrollY
        };
      })();
    `);

    return {
      success: true,
      message: `已滚动到位置 (${result.x}, ${result.y})`,
      position: result,
    };
  } catch (err: any) {
    console.error('[common-actions] 滚动页面失败:', err);
    throw err;
  }
}

/**
 * 获取页面元素信息
 * @param tabId 标签页ID
 * @param selector CSS选择器
 * @returns 元素信息
 */
export async function getElementInfo(
  tabId: string | null,
  selector: string
): Promise<{
  found: boolean;
  count: number;
  elements: Array<{
    tagName: string;
    text: string;
    href?: string;
    src?: string;
    visible: boolean;
  }>;
}> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  if (!selector) {
    throw new Error('选择器不能为空');
  }

  try {
    const result = await window.electronAPI.tab.executeScript(tabId, `
      (function() {
        const elements = Array.from(document.querySelectorAll('${selector.replace(/'/g, "\\'")}'));
        return elements.map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            text: el.textContent?.trim().substring(0, 100) || '',
            href: el.href || undefined,
            src: el.src || undefined,
            visible: rect.width > 0 && rect.height > 0 && 
                     window.getComputedStyle(el).display !== 'none' &&
                     window.getComputedStyle(el).visibility !== 'hidden'
          };
        });
      })();
    `);

    return {
      found: result.length > 0,
      count: result.length,
      elements: result,
    };
  } catch (err: any) {
    console.error('[common-actions] 获取元素信息失败:', err);
    throw err;
  }
}

