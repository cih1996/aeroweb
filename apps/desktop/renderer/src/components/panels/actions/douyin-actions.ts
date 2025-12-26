/**
 * 抖音操作工具函数
 * 封装所有抖音相关的操作方法，方便其他UI组件调用
 */

let commonJsCode: string = '';
let douyinJsCode: string = '';
let scriptsLoaded = false;

/**
 * 加载公共函数代码和抖音脚本
 */
async function loadScripts(): Promise<void> {
  if (scriptsLoaded) {
    return;
  }

  try {
    // 加载公共函数代码（使用相对路径，生产环境标准）
    const commonResponse = await fetch('./scripts/common.js');
    if (commonResponse.ok) {
      commonJsCode = await commonResponse.text();
      console.log('[douyin-actions] 公共函数代码已加载');
    }
    
    // 加载抖音脚本（使用相对路径，生产环境标准）
    const douyinResponse = await fetch('./scripts/douyin/douyin.js');
    if (douyinResponse.ok) {
      douyinJsCode = await douyinResponse.text();
      console.log('[douyin-actions] 抖音脚本已加载');
    }
    
    scriptsLoaded = true;
  } catch (err) {
    console.error('[douyin-actions] 加载脚本失败:', err);
    throw err;
  }
}

/**
 * 执行抖音方法
 * @param tabId 标签页ID
 * @param methodName 方法名称
 * @param args 方法参数
 * @returns 执行结果
 */
export async function executeDouyinMethod(
  tabId: string | null,
  methodName: string,
  ...args: any[]
): Promise<any> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  // 确保脚本已加载
  await loadScripts();

  // 构建执行代码
  const argsStr = args.length > 0 ? args.map(arg => JSON.stringify(arg)).join(', ') : '';
  const fullCode = `
    (async function() {
      try {
        // 注入公共函数代码
        ${commonJsCode}
        
        // 注入抖音脚本
        ${douyinJsCode}
        
        // 执行指定方法
        const result = await ${methodName}(${argsStr});
        return result;
      } catch (error) {
        console.error('[PolyApps] 执行代码时出错:', error);
        throw error;
      }
    })();
  `;

  try {
    const result = await window.electronAPI.tab.executeScript(tabId, fullCode);
    console.log('[douyin-actions] 执行结果:', result);
    return result;
  } catch (err: any) {
    console.error('[douyin-actions] 执行错误:', err);
    throw err;
  }
}

/**
 * 获取视频信息
 */
export async function getVideoInfo(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getVideoInfo');
}

/** 获取视频详细信息 */
export async function getCurrentAwemeInfo(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getCurrentAwemeInfo');
}


/**
 * 点赞视频
 */
export async function digg(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_digg');
}

/**
 * 下一条视频
 */
export async function next(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_next');
}

/**
 * 前往精选区
 */
export async function toJingXuan(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_toJingXuan');
}

/**
 * 获取评论
 */
export async function getComments(tabId: string | null, pageCount: number = 0): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getComments', pageCount);
}

/**
 * 发送评论
 * @param tabId 标签页ID
 * @param commentText 评论内容
 * @param commentIndex 回复索引（-1表示不回复）
 */
export async function sendComment(
  tabId: string | null,
  commentText: string,
  commentIndex: number = -1
): Promise<any> {
  return executeDouyinMethod(tabId, 'pasteIntoDraft', commentText, commentIndex);
}

/**
 * 个人资料
 */
export async function getMyInfo(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getMyInfo');
}

/**
 * 当前用户资料
 */
export async function getCurrentUserInfo(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getCurrentUserInfo');
}


/**
 * 当前用户资料
 */
export async function getCurrentUserInfo2(tabId: string | null): Promise<any> {
  return executeDouyinMethod(tabId, 'douyin_getCurrentUserInfo2');
}