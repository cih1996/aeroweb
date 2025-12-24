

/**
 * 加载并执行搜索图片脚本
 */
export async function executeSearchImagesScript(
  tabId: string,
  imageIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
   
    // 构建图片ID字符串（用空格分隔）
    const imageIdsString = imageIds.join(' ');

    // 读取搜索脚本文件（使用相对路径，生产环境标准）
    const scriptPath = './scripts/temu/search-images.js';
    const scriptResponse = await fetch(scriptPath);
    if (!scriptResponse.ok) {
      throw new Error(`无法加载搜索脚本: ${scriptResponse.statusText}`);
    }
    const scriptContent = await scriptResponse.text();

    // 构建执行代码：先加载脚本，然后调用函数
    const executeCode = `
      (async function() {
        try {
          // 执行脚本内容
          ${scriptContent}
          
          // 调用搜索函数
          const result = await runSearchImages("${imageIdsString}");
          return result;
        } catch (error) {
          console.error('[ScriptExecutor] 执行搜索脚本失败:', error);
          return { success: false, error: String(error.message || error) };
        }
      })();
    `;

    console.log('[ScriptExecutor] 🔍 执行搜索图片脚本...');
    const result = await window.electronAPI.tab.executeScript(tabId, executeCode);
    console.log('[ScriptExecutor] 搜索脚本执行结果:', result);

    // 处理结果
    if (result === undefined || result === null) {
      console.log('[ScriptExecutor] ⚠️ 脚本返回值为 undefined，但可能已成功执行');
      return { success: true };
    } else if (result && result.success) {
      return { success: true };
    } else if (result && result.error) {
      return { success: false, error: result.error };
    } else {
      // 其他情况也认为成功（可能是返回值序列化问题）
      console.log('[ScriptExecutor] 脚本可能已执行（返回值无法序列化）');
      return { success: true };
    }
  } catch (error: any) {
    console.error('[ScriptExecutor] 执行搜索脚本时出错:', error);
    return { success: false, error: error.message || '未知错误' };
  }
}

/**
 * 加载并执行填写商品脚本
 */
export async function executeFillProductScript(
  tabId: string,
  goodsTitle: string,
  imageUrls: string[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    // 读取填写商品脚本文件（使用相对路径，生产环境标准）
    const scriptPath = './scripts/temu/fill-product.js';
    const scriptResponse = await fetch(scriptPath);
    if (!scriptResponse.ok) {
      throw new Error(`无法加载填写商品脚本: ${scriptResponse.statusText}`);
    }
    const scriptContent = await scriptResponse.text();

    // 将图片URL数组转换为JSON字符串，以便在代码中安全使用
    const imageUrlsJson = JSON.stringify(imageUrls);

    // 构建执行代码：先加载脚本，然后调用函数
    const executeCode = `
        (async () => {
          try {
            // 执行脚本内容
            ${scriptContent}
            // 调用填写商品函数，传递商品标题和图片URL数组
            const imageUrls = ${imageUrlsJson};
            const result = await runFillProduct("${goodsTitle.replace(/"/g, '\\"')}", imageUrls);
            return result;
          } catch (error) {
            console.error('[ScriptExecutor] 执行填写商品脚本失败:', error);
            return { success: false, error: String(error.message || error) };
          }
        })();
    `;

    console.log('[ScriptExecutor] 📝 执行填写商品脚本...', { goodsTitle, imageCount: imageUrls.length });
    const result = await window.electronAPI.tab.executeScript(tabId, executeCode);
    console.log('[ScriptExecutor] 填写商品脚本执行结果:', result);

    // 处理结果
    if (result === undefined || result === null) {
      console.log('[ScriptExecutor] ⚠️ 脚本返回值为 undefined，但可能已成功执行');
      return { success: true };
    } else if (result && result.success) {
      return { success: true };
    } else if (result && result.error) {
      return { success: false, error: result.error };
    } else {
      // 其他情况也认为成功（可能是返回值序列化问题）
      console.log('[ScriptExecutor] 脚本可能已执行（返回值无法序列化）');
      return { success: true };
    }
  } catch (error: any) {
    console.error('[ScriptExecutor] 执行填写商品脚本时出错:', error);
    return { success: false, error: error.message || '未知错误' };
  }
}

