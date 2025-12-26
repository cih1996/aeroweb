/**
 * Temu操作工具函数
 * 封装所有Temu相关的操作方法，方便其他UI组件调用
 */

let temuScript: string = '';
let commonJsCode: string = '';
let scriptsLoaded = false;

/**
 * 加载Temu脚本
 */
async function loadScripts(): Promise<void> {
  if (scriptsLoaded) {
    return;
  }

  try {
    //加载通用库
    const commonResponse = await fetch('./scripts/common.js');
    if (commonResponse.ok) {
      commonJsCode = await commonResponse.text();
      console.log('[temu-actions] 通用库已加载');
    }

    // 加载Temu脚本（使用相对路径，生产环境标准）
    const response = await fetch('./scripts/temu/temu.js');
    if (response.ok) {
      temuScript = await response.text();
      console.log('[temu-actions] Temu脚本已加载');
    }
    
    scriptsLoaded = true;
  } catch (err) {
    console.error('[temu-actions] 加载脚本失败:', err);
    throw err;
  }
}

/**
 * 执行搜索图片脚本
 * @param tabId 标签页ID
 * @param imageIds 图片ID数组
 * @returns 执行结果
 */
export async function searchImages(
  tabId: string | null,
  imageIds: number[]
): Promise<{ success: boolean; error?: string; data?: any }> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  try {
    // 确保脚本已加载
    await loadScripts();

    // 构建图片ID字符串（用空格分隔）
    const imageIdsString = imageIds.join(' ');

    // 构建执行代码：先加载脚本，然后调用函数
    const executeCode = `
      (async function() {
        try {
          // 执行脚本内容
          ${commonJsCode}
          ${temuScript}
          
          // 调用搜索函数
          const result = await temu_searchImages("${imageIdsString}");
          return result;
        } catch (error) {
          console.error('[temu-actions] 执行搜索脚本失败:', error);
          return { success: false, error: String(error.message || error), data: null };
        }
      })();
    `;

    console.log('[temu-actions] 🔍 执行搜索图片脚本...');
    const result = await window.electronAPI.tab.executeScript(tabId, executeCode);
    console.log('[temu-actions] 搜索脚本执行结果:', result);

    // 处理结果
    if (result === undefined || result === null) {
      console.log('[temu-actions] ⚠️ 脚本返回值为 undefined，但可能已成功执行');
      return { success: true, data: null };
    } else if (result && result.success) {
      return { success: true, data: result.data || null };
    } else if (result && result.error) {
      return { success: false, error: result.error, data: result.data || null };
    } else {
      // 其他情况也认为成功（可能是返回值序列化问题）
      console.log('[temu-actions] 脚本可能已执行（返回值无法序列化）');
      return { success: true, data: null };
    }
  } catch (error: any) {
    console.error('[temu-actions] 执行搜索脚本时出错:', error);
    return { success: false, error: error.message || '未知错误', data: null };
  }
}

/**
 * 执行填写商品脚本
 * @param tabId 标签页ID
 * @param goodsTitle 商品标题
 * @param imageUrls 图片URL数组
 * @returns 执行结果
 */
export async function fillProduct(
  tabId: string | null,
  goodsTitle: string,
  imageUrls: string[] = []
): Promise<{ success: boolean; error?: string }> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  try {
    // 确保脚本已加载
    await loadScripts();

    // 将图片URL数组转换为JSON字符串，以便在代码中安全使用
    const imageUrlsJson = JSON.stringify(imageUrls);

    // 构建执行代码：先加载脚本，然后调用函数
    const executeCode = `
      (async function() {
        try {
          // 执行脚本内容
          ${commonJsCode}
          ${temuScript}
          
          // 调用填写商品函数，传递商品标题和图片URL数组
          const imageUrls = ${imageUrlsJson};
          const result = await temu_fillProduct("${goodsTitle.replace(/"/g, '\\"')}", imageUrls);
          return result;
        } catch (error) {
          console.error('[temu-actions] 执行填写商品脚本失败:', error);
          return { success: false, error: String(error.message || error) };
        }
      })();
    `;

    console.log('[temu-actions] 📝 执行填写商品脚本...', { goodsTitle, imageCount: imageUrls.length });
    const result = await window.electronAPI.tab.executeScript(tabId, executeCode);
    console.log('[temu-actions] 填写商品脚本执行结果:', result);

    // 处理结果
    if (result === undefined || result === null) {
      console.log('[temu-actions] ⚠️ 脚本返回值为 undefined，但可能已成功执行');
      return { success: true };
    } else if (result && result.success) {
      return { success: true };
    } else if (result && result.error) {
      return { success: false, error: result.error };
    } else {
      // 其他情况也认为成功（可能是返回值序列化问题）
      console.log('[temu-actions] 脚本可能已执行（返回值无法序列化）');
      return { success: true };
    }
  } catch (error: any) {
    console.error('[temu-actions] 执行填写商品脚本时出错:', error);
    return { success: false, error: error.message || '未知错误' };
  }
}

/**
 * 点击上传图片按钮
 * @param tabId 标签页ID
 * @param uploadCount 上传图片数量
 * @returns 执行结果
 */
export async function clickUploadImage(
  tabId: string | null,
  uploadCount: number
): Promise<{ success: boolean; error?: string; data?: any }> {
  if (!tabId) {
    throw new Error('没有活动的标签页');
  }

  try {
    // 确保脚本已加载
    await loadScripts();

    // 构建执行代码：先加载脚本，然后调用函数
    const executeCode = `
      (async function() {
        try {
          // 执行脚本内容
          ${commonJsCode}
          ${temuScript}
          
          // 调用点击上传按钮函数
          const result = await temu_clickUploadImage(${uploadCount});
          return result.data;
        } catch (error) {
          console.error('[temu-actions] 执行点击上传按钮脚本失败:', error);
          return { success: false, error: String(error.message || error) };
        }
      })();
    `;
    const result = await window.electronAPI.tab.executeScript(tabId, executeCode);
    return result;
  
  } catch (error: any) {
    console.error('[temu-actions] 执行点击上传按钮脚本时出错:', error);
    return { success: false, error: error.message || '未知错误', data: null };
  }
}

