<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { executeSearchImagesScript, executeFillProductScript } from './temu/scripts/script-executor';

  export let tabId: string | null = null;
  export let appId: string = '';

  // 主图相关
  let mainImageDirectory: string | null = null;
  let mainImageFiles: string[] = [];
  let mainImageCount = 0;
  let mainImagePreviews: Map<string, string> = new Map(); // 存储图片路径到 base64 data URL 的映射

  // 轮播图相关
  let carouselImageDirectory: string | null = null;
  let carouselImageFiles: string[] = [];
  let carouselImageCount = 0;
  let carouselImagePreviews: Map<string, string> = new Map(); // 存储图片路径到 base64 data URL 的映射

  // 配置
  let positionIndex = 0;
  let uploadCount = 1;
  let uploadFrequency = 1000;

  // 状态
  let isRunning = false; // 上传图片是否运行中
  let isFillingProduct = false; // 填写商品是否运行中
  let scanResult: { success: boolean; count: number; message: string } | null = null;
  let scanning = false;
  let statusMessage = ''; // 状态消息
  let uploadedImageIds: number[] = []; // 已上传的图片ID列表
  let currentUploadCount = 0; // 当前已上传次数
  let currentUploadImageCount = 0; // 当前这次上传的图片数量（主图1张 + 轮播图数量）
  let queryResponseReceived = false; // queryByMd5 接口是否已收到响应
  let createResponseReceived = false; // create 接口是否已收到响应
  let searchResults: Array<{ id: number; materialName: string; imgUrl: string }> = []; // 搜索结果
  let fillProductTriggered = false; // 是否已触发填写商品流程

  // 目标页面URL
  const TARGET_URL = 'https://agentseller.temu.com/material/material-center';
  const UPLOAD_BUTTON_SELECTOR = 'button[data-testid="beast-core-button"]:has(span:contains("上传素材"))';
  const NETWORK_RULE_ID_CREATE = 'temu-material-create';
  const NETWORK_RULE_ID_QUERY = 'temu-material-query';
  const NETWORK_RULE_ID_PAGE_QUERY = 'temu-material-page-query';


  // 保存配置到 Electron
  async function saveConfig() {
    if (!tabId) return;
    
    const config = {
      mainImageDirectory,
      carouselImageDirectory,
      positionIndex,
      uploadCount,
      uploadFrequency,
    };
    
    try {
      await window.electronAPI.temu.saveConfig(tabId, config);
    } catch (err) {
      console.error('[TemuUploadPanel] 保存配置失败:', err);
    }
  }

  // 从 Electron 加载配置
  async function loadConfig() {
    if (!tabId) return;
    
    try {
      const result = await window.electronAPI.temu.loadConfig(tabId);
      if (result.success && result.config) {
        const config = result.config;
        
        // 恢复配置
        if (config.mainImageDirectory) {
          mainImageDirectory = config.mainImageDirectory;
          await loadMainImages();
        }
        
        if (config.carouselImageDirectory) {
          carouselImageDirectory = config.carouselImageDirectory;
          await loadCarouselImages();
        }
        
        if (config.positionIndex !== undefined) {
          positionIndex = config.positionIndex;
        }
        
        if (config.uploadCount !== undefined) {
          uploadCount = config.uploadCount;
        }
        
        if (config.uploadFrequency !== undefined) {
          uploadFrequency = config.uploadFrequency;
        }
      }
    } catch (err) {
      console.error('[TemuUploadPanel] 加载配置失败:', err);
    }
  }

  // 网络拦截回调函数
  let networkInterceptCallback: ((data: any) => void) | null = null;

  onMount(async () => {
    // 从 Electron 存储加载配置
    await loadConfig();

    // 设置网络拦截规则和回调
    if (tabId) {
      setupNetworkInterceptor();
    }
  });

  onDestroy(() => {
    // 清理网络拦截
    if (tabId && networkInterceptCallback) {
      window.electronAPI.network.offIntercepted(networkInterceptCallback);
      window.electronAPI.network.removeRule(tabId, NETWORK_RULE_ID_CREATE);
      window.electronAPI.network.removeRule(tabId, NETWORK_RULE_ID_QUERY);
      window.electronAPI.network.removeRule(tabId, NETWORK_RULE_ID_PAGE_QUERY);
    }
  });

  // 设置网络拦截器 /
  async function setupNetworkInterceptor() {
    if (!tabId) return;

    try {
      // 添加拦截规则 - create 接口
      await window.electronAPI.network.addRule(tabId, {
        id: NETWORK_RULE_ID_CREATE,
        pattern: '*agentseller.temu.com/phoenix-mms/material/create*',
        enabled: true
      });

      // 添加拦截规则 - queryByMd5 接口
      await window.electronAPI.network.addRule(tabId, {
        id: NETWORK_RULE_ID_QUERY,
        pattern: '*agentseller.temu.com/phoenix-mms/material/queryByMd5*',
        enabled: true
      });

      // 添加拦截规则 - pageQuery 接口（用于搜索图片）
      await window.electronAPI.network.addRule(tabId, {
        id: NETWORK_RULE_ID_PAGE_QUERY,
        pattern: '*agentseller.temu.com/phoenix-mms/material/pageQuery*',
        enabled: true
      });

      // 设置拦截回调
      networkInterceptCallback = ({ tabId: interceptedTabId, data }) => {
        if (interceptedTabId === tabId && data.type === 'response') {
          if (data.ruleId === NETWORK_RULE_ID_CREATE) {
            handleUploadResponse(data);
          } else if (data.ruleId === NETWORK_RULE_ID_QUERY) {
            handleQueryResponse(data);
          } else if (data.ruleId === NETWORK_RULE_ID_PAGE_QUERY) {
            handlePageQueryResponse(data);
          }
        }
      };

      window.electronAPI.network.onIntercepted(networkInterceptCallback);
      console.log('[TemuUploadPanel] ✅ 网络拦截器已设置（支持 create 和 queryByMd5）');
    } catch (err) {
      console.error('[TemuUploadPanel] 设置网络拦截器失败:', err);
    }
  }

  // 处理查询响应（queryByMd5）
  function handleQueryResponse(data: any) {
    try {
      console.log('[TemuUploadPanel] 📥 收到查询接口拦截数据:', {
        type: data.type,
        ruleId: data.ruleId,
        url: data.url,
        hasData: !!data.data,
        timestamp: new Date(data.timestamp).toLocaleString()
      });
      
      queryResponseReceived = true;
      
      if (data.data) {
        console.log('[TemuUploadPanel] 📥 查询响应数据:', JSON.stringify(data.data, null, 2));
        
        const response = data.data;
        if (response.success && response.result?.responseDetailList) {
          // 提取图片ID（从查询接口返回的已存在图片）
          const imageIds = response.result.responseDetailList
            .filter((item: any) => item.alreadyExists && item.id)
            .map((item: any) => item.id);
          
          if (imageIds.length > 0) {
            // 合并到已上传的ID列表（去重）
            const newIds = imageIds.filter((id: number) => !uploadedImageIds.includes(id));
            uploadedImageIds = [...uploadedImageIds, ...newIds];
            console.log('[TemuUploadPanel] ✅ 查询到已存在的图片IDs:', imageIds);
            console.log('[TemuUploadPanel] 📊 新增ID:', newIds, '，当前总ID数:', uploadedImageIds.length);
            
            // 检查：如果返回的ID数量等于上传的图片数量，说明所有图片都已存在
            const returnedIdCount = imageIds.length;
            const uploadedImageCount = currentUploadImageCount; // 主图1张 + 轮播图数量
            
            console.log('[TemuUploadPanel] 🔍 检查图片数量匹配:', {
              返回ID数量: returnedIdCount,
              上传图片数量: uploadedImageCount,
              是否匹配: returnedIdCount === uploadedImageCount
            });
            
            if (returnedIdCount === uploadedImageCount && uploadedImageCount > 0) {
              // 所有图片都已存在，不需要等待 create 接口
              console.log('[TemuUploadPanel] ✅ 所有图片都已存在，跳过 create 接口等待');
              statusMessage = `所有图片已存在！ID: ${imageIds.join(', ')} (总计: ${uploadedImageIds.length})`;
              
              // 直接完成当前上传流程
              completeCurrentUpload();
            } else {
              statusMessage = `查询到已存在图片ID: ${newIds.join(', ') || imageIds.join(', ')} (总计: ${uploadedImageIds.length})`;
            }
          }
        } else {
          console.warn('[TemuUploadPanel] ⚠️ 查询响应格式不符合预期:', response);
        }
      } else {
        console.warn('[TemuUploadPanel] ⚠️ 查询响应没有 data 数据');
      }
    } catch (err) {
      console.error('[TemuUploadPanel] ❌ 解析查询响应失败:', err);
    }
  }

  // 处理上传响应（create）
  function handleUploadResponse(data: any) {
    try {
      console.log('[TemuUploadPanel] 📥 收到上传接口拦截数据:', {
        type: data.type,
        ruleId: data.ruleId,
        url: data.url,
        hasData: !!data.data,
        timestamp: new Date(data.timestamp).toLocaleString()
      });
      
      if (data.data) {
        createResponseReceived = true;
        console.log('[TemuUploadPanel] 📥 上传响应数据:', JSON.stringify(data.data, null, 2));
        
        const response = data.data;
        if (response.success && response.result?.responseDetailList) {
          // 提取图片ID（从上传接口返回的新上传图片）
          const imageIds = response.result.responseDetailList
            .map((item: any) => item.id)
            .filter((id: number) => id); // 过滤掉无效ID
          
          if (imageIds.length > 0) {
            // 合并到已上传的ID列表（去重）
            const newIds = imageIds.filter((id: number) => !uploadedImageIds.includes(id));
            uploadedImageIds = [...uploadedImageIds, ...newIds];
            console.log('[TemuUploadPanel] ✅ 上传成功！图片IDs:', imageIds);
            console.log('[TemuUploadPanel] 📊 当前进度:', {
              已上传次数: currentUploadCount,
              总次数: uploadCount,
              已获得ID数: uploadedImageIds.length,
              所有ID: uploadedImageIds
            });
            statusMessage = `上传成功！获得图片ID: ${newIds.join(', ') || imageIds.join(', ')} (${currentUploadCount}/${uploadCount}, 总计: ${uploadedImageIds.length})`;
            
            // 完成当前上传流程
            completeCurrentUpload();
          } else {
            console.warn('[TemuUploadPanel] ⚠️ 上传响应中没有有效的图片ID');
          }
        } else {
          console.warn('[TemuUploadPanel] ⚠️ 上传响应格式不符合预期:', response);
        }
      } else {
        console.warn('[TemuUploadPanel] ⚠️ 上传响应没有 data 数据');
      }
    } catch (err) {
      console.error('[TemuUploadPanel] ❌ 解析上传响应失败:', err);
    }
  }

  // 处理搜索结果响应（pageQuery）
  function handlePageQueryResponse(data: any) {
    try {

      if (data.data) {
        const response = data.data;
        if (response.success && response.result?.materialList) {
          // 提取搜索结果：imgUrl, materialName, id
          const results = response.result.materialList.map((item: any) => ({
            id: item.id,
            materialName: item.materialName || '',
            imgUrl: item.imgUrl || ''
          }));
          
          // 合并到搜索结果列表（去重）
          const newResults = results.filter((r: any) => 
            !searchResults.some(existing => existing.id === r.id)
          );
          searchResults = [...searchResults, ...newResults];
          
          console.log('[TemuUploadPanel] ✅ 搜索到图片结果:', results);
          console.log('[TemuUploadPanel] 📊 当前搜索结果总数:', searchResults.length);
          statusMessage = `搜索完成！找到 ${results.length} 张图片 (总计: ${searchResults.length})`;
          
          // 搜索完成后不再自动触发填写商品，由用户手动点击"填写商品"按钮
          // 移除自动触发逻辑，让用户手动控制
        } else {
          console.warn('[TemuUploadPanel] ⚠️ 搜索响应格式不符合预期:', response);
        }
      } else {
        console.warn('[TemuUploadPanel] ⚠️ 搜索响应没有 data 数据');
      }
    } catch (err) {
      console.error('[TemuUploadPanel] ❌ 解析搜索响应失败:', err);
    }
  }

  // 在搜索完成后执行填写商品
  async function handleFillProductAfterSearch() {
    if (!tabId) return;

    try {
      const EDIT_PRODUCT_URL = 'https://agentseller.temu.com/goods/edit?productDraftId=9079572308&from=menu&st_time=1766207397385';
      
      console.log('[TemuUploadPanel] 🚀 开始填写商品流程...');
      statusMessage = '准备跳转到商品编辑页面...';
      
      // 1. 跳转到商品编辑页面
      await window.electronAPI.browser.navigate(tabId, EDIT_PRODUCT_URL);
      statusMessage = '等待页面加载完成...';
      
      // 2. 等待页面加载完成
      await waitForPageLoad();

      
      
      // 3. 执行填写商品脚本（使用第一个搜索结果的 materialName 作为商品标题）
      const goodsTitle = searchResults[0]?.materialName || '商品标题';
      // 提取所有搜索结果的图片URL
      const imageUrls = searchResults
        .filter(result => result.imgUrl && result.imgUrl.trim() !== '')
        .map(result => result.imgUrl);
      
      console.log('[TemuUploadPanel] 📝 使用商品标题:', goodsTitle);
      console.log('[TemuUploadPanel] 📝 图片URL数组:', imageUrls);
      statusMessage = `正在填写商品信息: ${goodsTitle} (${imageUrls.length} 张图片)...`;
      
      const fillResult = await executeFillProductScript(tabId, goodsTitle, imageUrls);
      
      if (fillResult.success) {
        statusMessage = `✅ 商品信息填写完成: ${goodsTitle}`;
        console.log('[TemuUploadPanel] ✅ 商品信息填写完成');
      } else {
        statusMessage = `❌ 商品信息填写失败: ${fillResult.error || '未知错误'}`;
        console.error('[TemuUploadPanel] ❌ 商品信息填写失败:', fillResult.error);
      }
    } catch (err: any) {
      console.error('[TemuUploadPanel] ❌ 填写商品流程失败:', err);
      statusMessage = `填写商品流程失败: ${err.message || '未知错误'}`;
    }
  }

  // 等待页面加载完成
  async function waitForPageLoad(timeout: number = 30000): Promise<void> {
    if (!tabId) return;

    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // 检查页面是否加载完成
        const result = await window.electronAPI.tab.executeScript(tabId, `
            if (document.readyState === 'complete') {
              // 检查关键元素是否存在（商品编辑页面的特征元素）
              const hasForm = document.querySelector('input, textarea, select');
              return { loaded: true, hasForm: !!hasForm };
            }
            return { loaded: false };
        `);

        if (result && result.loaded && result.hasForm) {
          console.log('[TemuUploadPanel] ✅ 页面加载完成');
          // 额外等待一下确保所有脚本都执行完成
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }
        console.log(result,"页面加载返回结果")
        // 等待500ms后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn('[TemuUploadPanel] 等待页面加载时出错:', err);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    throw new Error('页面加载超时');
  }

  // 完成当前上传流程（统一处理逻辑）
  async function completeCurrentUpload() {
    if(!tabId){return;}

    currentUploadCount++;
    
    // 成功后，位置索引自动递增（但不超过总数）
    if (isRunning) {
      positionIndex = Math.min(positionIndex + 1, mainImageFiles.length - 1);
      saveConfig();
      
      // 检查是否还需要继续上传
      const hasMoreImages = positionIndex < mainImageFiles.length;
      const hasMoreCount = currentUploadCount < uploadCount;
      
      if (hasMoreImages && hasMoreCount) {
        console.log('[TemuUploadPanel] 🔄 继续上传下一张，等待', uploadFrequency, 'ms...');
        // 继续上传下一张
        setTimeout(() => {
          startUploadProcess();
        }, uploadFrequency);
      } else {
        // 完成所有上传后，执行搜索图片的 JS 代码
        console.log('[TemuUploadPanel] 🎉 全部上传完成！开始搜索图片...');
        statusMessage = `全部上传完成！共上传 ${currentUploadCount} 次，获得 ${uploadedImageIds.length} 个图片ID，开始搜索图片...`;
        
        // 执行搜索图片的 JS 代码
        if (tabId) {
          // 清空之前的搜索结果和拦截数据
          searchResults = [];
          fillProductTriggered = false; // 重置填写商品触发标志
          statusMessage = '清空之前的搜索结果，准备执行搜索...';
          
          // 清空网络拦截器中的拦截数据（在浏览器中）
          try {
            await window.electronAPI.tab.executeScript(tabId, `
              (function() {
                if (window.__polyAppsInterceptedData) {
                  window.__polyAppsInterceptedData = [];
                  console.log('[TemuUploadPanel] ✅ 已清空网络拦截数据');
                }
                return { success: true };
              })();
            `);
            console.log('[TemuUploadPanel] ✅ 已清空网络拦截数据');
          } catch (err) {
            console.warn('[TemuUploadPanel] ⚠️ 清空网络拦截数据失败:', err);
          }
          
          const searchResult = await executeSearchImagesScript(tabId, uploadedImageIds);
          if (searchResult.success) {
            statusMessage = '搜索脚本已执行，等待搜索结果...';
          } else {
            statusMessage = `搜索脚本执行失败: ${searchResult.error || '未知错误'}`;
          }
        }
        
        // 完成所有任务
        isRunning = false;
        scanning = false;
        console.log('[TemuUploadPanel] 🎉 全部完成！');
        statusMessage = `全部完成！共上传 ${currentUploadCount} 次，获得 ${uploadedImageIds.length} 个图片ID，搜索到 ${searchResults.length} 张图片`;
      }
    }
  }

  // 等待元素出现
  async function waitForElement(selector: string, timeout: number = 30000): Promise<boolean> {
    if (!tabId) return false;

    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        // 直接执行代码，不使用 IIFE（因为 executeScript 会处理）
        const result = await window.electronAPI.tab.executeScript(tabId, `
          try {
            // 查找所有按钮
            const buttons = Array.from(document.querySelectorAll('button'));
            console.log('[TemuUploadPanel] 找到按钮数量:', buttons.length);
            
            // 查找包含"上传素材"文本的按钮
            const uploadButton = buttons.find(btn => {
              const span = btn.querySelector('span');
              const text = span ? span.textContent : '';
              const innerText = btn.innerText || btn.textContent || '';
              console.log('[TemuUploadPanel] 检查按钮文本:', text, innerText);
              return (text && text.includes('上传素材')) || (innerText && innerText.includes('上传素材'));
            });
            
            if (uploadButton) {
              console.log('[TemuUploadPanel] ✅ 找到上传按钮');
              const buttonText = uploadButton.innerText || uploadButton.textContent || '';
              // 返回可序列化的对象
              return { found: true, buttonText: String(buttonText) };
            }
            
            console.log('[TemuUploadPanel] ❌ 未找到上传按钮');
            return { found: false, buttonCount: buttons.length };
          } catch (e) {
            console.error('[TemuUploadPanel] 查找按钮时出错:', e);
            return { found: false, error: String(e.message || e) };
          }
        `);

        console.log('[TemuUploadPanel] 等待元素结果:', result, '类型:', typeof result, 'found属性:', result?.found);

        if (result && result.found) {
          return true;
        }

        // 等待500ms后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.warn('[TemuUploadPanel] 等待元素时出错:', err);
        // 等待500ms后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return false;
  }

  // 点击上传按钮
  async function clickUploadButton(): Promise<boolean> {
    if (!tabId) return false;

    try {
      // 直接执行代码，不使用 IIFE（因为 executeScript 会处理）
      const result = await window.electronAPI.tab.executeScript(tabId, `
        try {
          // 查找所有按钮
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log('[TemuUploadPanel] 点击前找到按钮数量:', buttons.length);
          
          // 查找包含"上传素材"文本的按钮
          const uploadButton = buttons.find(btn => {
            const span = btn.querySelector('span');
            const text = span ? span.textContent : '';
            const innerText = btn.innerText || btn.textContent || '';
            return (text && text.includes('上传素材')) || (innerText && innerText.includes('上传素材'));
          });
          
          if (uploadButton) {
            console.log('[TemuUploadPanel] 找到上传按钮，准备点击');
            // 尝试多种点击方式
            try {
              if (uploadButton.click) {
                uploadButton.click();
                console.log('[TemuUploadPanel] ✅ 已通过 click() 触发点击');
              } else if (uploadButton.dispatchEvent) {
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                uploadButton.dispatchEvent(clickEvent);
                console.log('[TemuUploadPanel] ✅ 已通过 dispatchEvent 触发点击');
              }
            } catch (clickErr) {
              console.error('[TemuUploadPanel] 点击时出错:', clickErr);
            }
            
            const buttonText = uploadButton.innerText || uploadButton.textContent || '';
            // 返回可序列化的对象
            return { success: true, buttonText: String(buttonText), clicked: true };
          }
          
          console.log('[TemuUploadPanel] ❌ 未找到上传按钮');
          return { success: false, error: '未找到上传按钮', buttonCount: buttons.length };
        } catch (e) {
          console.error('[TemuUploadPanel] 点击按钮时出错:', e);
          return { success: false, error: String(e.message || e) };
        }
      `);

      console.log('[TemuUploadPanel] 点击按钮结果:', result);
      // 如果返回 undefined，但控制台显示点击成功，我们也认为点击成功
      if (!result) {
        console.warn('[TemuUploadPanel] ⚠️ 点击结果返回 undefined，但可能已成功点击，继续流程');
        return true; // 假设点击成功
      }
      return result.success === true;
    } catch (err) {
      console.error('[TemuUploadPanel] 点击上传按钮失败:', err);
      return false;
    }
  }

  // 检查当前URL
  async function checkCurrentURL(): Promise<boolean> {
    if (!tabId) return false;

    try {
      const currentURL = await window.electronAPI.browser.getURL(tabId);
      return currentURL?.includes('agentseller.temu.com/material/material-center') || false;
    } catch (err) {
      console.error('[TemuUploadPanel] 获取当前URL失败:', err);
      return false;
    }
  }

  // 开始上传流程
  async function startUploadProcess() {
    if (!tabId) return;

    try {
      // 1. 检查当前URL
      statusMessage = '检查当前页面...';
      const isOnTargetPage = await checkCurrentURL();
      
      if (!isOnTargetPage) {
        statusMessage = '跳转到目标页面...';
        await window.electronAPI.browser.navigate(tabId, TARGET_URL);
        
        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // 2. 等待上传按钮出现
      statusMessage = '等待上传按钮出现...';
      const buttonFound = await waitForElement(UPLOAD_BUTTON_SELECTOR, 30000);
      
      if (!buttonFound) {
        statusMessage = '错误：未找到上传按钮';
        scanResult = {
          success: false,
          count: 0,
          message: '未找到上传按钮，请确保页面已加载完成'
        };
        isRunning = false;
        return;
      }

      // 3. 设置网络拦截（在点击之前）
      statusMessage = '设置网络拦截...';
      console.log('[TemuUploadPanel] 🔍 开始设置网络拦截规则...');
      try {
        // 添加 create 接口拦截规则
        await window.electronAPI.network.addRule(tabId, {
          id: NETWORK_RULE_ID_CREATE,
          pattern: '*agentseller.temu.com/phoenix-mms/material/create*',
          enabled: true
        });
        // 添加 queryByMd5 接口拦截规则
        await window.electronAPI.network.addRule(tabId, {
          id: NETWORK_RULE_ID_QUERY,
          pattern: '*agentseller.temu.com/phoenix-mms/material/queryByMd5*',
          enabled: true
        });
        console.log('[TemuUploadPanel] ✅ 网络拦截规则已添加:', NETWORK_RULE_ID_CREATE, NETWORK_RULE_ID_QUERY);
        statusMessage = '网络拦截已设置';
      } catch (err) {
        console.error('[TemuUploadPanel] 设置网络拦截失败:', err);
        statusMessage = '警告：网络拦截设置失败，但继续执行';
      }

      // 4. 设置文件上传拦截
      statusMessage = '设置文件上传拦截...';
      const selectedMainImage = mainImageFiles[positionIndex];
      const imagePaths = [selectedMainImage, ...carouselImageFiles];
      
      // 设置当前上传的图片数量（主图1张 + 轮播图数量）
      currentUploadImageCount = imagePaths.length;
      // 重置响应接收标志
      queryResponseReceived = false;
      createResponseReceived = false;
      
      console.log('[TemuUploadPanel] 📤 准备上传图片:', {
        主图索引: positionIndex,
        主图路径: selectedMainImage,
        轮播图数量: carouselImageFiles.length,
        总图片数: imagePaths.length,
        当前上传图片数量: currentUploadImageCount,
        图片路径列表: imagePaths
      });
      
      const scanResultData = await window.electronAPI.tab.triggerFileUploadScan(tabId, imagePaths);
      
      console.log('[TemuUploadPanel] 📤 文件上传拦截设置结果:', scanResultData);
      
      if (!scanResultData.success) {
        statusMessage = `错误：${scanResultData.message}`;
        scanResult = scanResultData;
        isRunning = false;
        scanning = false;
        return;
      }

      // 5. 点击上传按钮
      statusMessage = '点击上传按钮...';
      console.log('[TemuUploadPanel] 🖱️ 准备点击上传按钮...');
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待拦截器设置完成
      
      const clicked = await clickUploadButton();
      
      if (!clicked) {
        statusMessage = '错误：无法点击上传按钮';
        scanResult = {
          success: false,
          count: 0,
          message: '无法点击上传按钮'
        };
        isRunning = false;
        scanning = false;
        return;
      }

      statusMessage = '等待上传完成...';
      // 上传结果将通过网络拦截回调处理
      // 注意：scanning 会在上传响应处理完成后设置为 false
      
    } catch (err: any) {
      statusMessage = `错误：${err.message || '上传流程失败'}`;
      scanResult = {
        success: false,
        count: 0,
        message: err.message || '上传流程失败'
      };
      isRunning = false;
      scanning = false;
      console.error('[TemuUploadPanel] 上传流程失败:', err);
    }
  }

  async function selectMainImageDirectory() {
    try {
      const directory = await window.electronAPI.fs.selectDirectory();
      if (directory) {
        mainImageDirectory = directory;
        await loadMainImages();
        await saveConfig(); // 保存配置
      }
    } catch (err: any) {
      console.error('[TemuUploadPanel] 选择主图目录失败:', err);
      alert('选择目录失败: ' + err.message);
    }
  }

  async function loadMainImages() {
    if (!mainImageDirectory) return;
    
    try {
      const files = await window.electronAPI.fs.readImageFiles(mainImageDirectory);
      mainImageFiles = files;
      mainImageCount = files.length;
      
      // 清空之前的预览
      mainImagePreviews.clear();
      
      // 异步加载所有图片的 base64 预览
      for (const filePath of files) {
        try {
          const base64 = await window.electronAPI.fs.readImageAsBase64(filePath);
          mainImagePreviews.set(filePath, base64);
        } catch (err) {
          console.error('[TemuUploadPanel] 加载主图预览失败:', filePath, err);
        }
      }
      
      // 触发响应式更新
      mainImagePreviews = mainImagePreviews;
    } catch (err: any) {
      console.error('[TemuUploadPanel] 读取主图失败:', err);
      alert('读取图片失败: ' + err.message);
      mainImageFiles = [];
      mainImageCount = 0;
      mainImagePreviews.clear();
    }
  }

  async function selectCarouselImageDirectory() {
    try {
      const directory = await window.electronAPI.fs.selectDirectory();
      if (directory) {
        carouselImageDirectory = directory;
        await loadCarouselImages();
        await saveConfig(); // 保存配置
      }
    } catch (err: any) {
      console.error('[TemuUploadPanel] 选择轮播图目录失败:', err);
      alert('选择目录失败: ' + err.message);
    }
  }

  async function loadCarouselImages() {
    if (!carouselImageDirectory) return;
    
    try {
      const files = await window.electronAPI.fs.readImageFiles(carouselImageDirectory);
      carouselImageFiles = files;
      carouselImageCount = files.length;
      
      // 清空之前的预览
      carouselImagePreviews.clear();
      
      // 异步加载所有图片的 base64 预览
      for (const filePath of files) {
        try {
          const base64 = await window.electronAPI.fs.readImageAsBase64(filePath);
          carouselImagePreviews.set(filePath, base64);
        } catch (err) {
          console.error('[TemuUploadPanel] 加载轮播图预览失败:', filePath, err);
        }
      }
      
      // 触发响应式更新
      carouselImagePreviews = carouselImagePreviews;
    } catch (err: any) {
      console.error('[TemuUploadPanel] 读取轮播图失败:', err);
      alert('读取图片失败: ' + err.message);
      carouselImageFiles = [];
      carouselImageCount = 0;
      carouselImagePreviews.clear();
    }
  }

  async function handlePositionIndexChange(event: Event) {
    const target = event.target as HTMLInputElement;
    positionIndex = parseInt(target.value, 10) || 0;
    await saveConfig(); // 保存配置
  }

  // 上传图片功能
  async function toggleUploadImages() {
    if (!tabId) {
      return;
    }

    if (isRunning) {
      // 停止上传
      isRunning = false;
      scanResult = null;
      statusMessage = '已停止上传';
      console.log('[TemuUploadPanel] 已停止上传');
    } else {
      // 开始上传 - 验证配置
      if (mainImageFiles.length === 0) {
        alert('请先选择主图目录');
        return;
      }

      if (carouselImageFiles.length === 0) {
        alert('请先选择轮播图目录');
        return;
      }

      // 检查位置索引是否有效
      if (positionIndex < 0 || positionIndex >= mainImageFiles.length) {
        alert(`位置索引无效，应在 0-${mainImageFiles.length - 1} 之间`);
        return;
      }

      // 重置状态
      isRunning = true;
      scanning = true;
      scanResult = null;
      statusMessage = '准备开始上传图片...';
      uploadedImageIds = [];
      currentUploadCount = 0;
      searchResults = []; // 清空搜索结果
      fillProductTriggered = false; // 重置填写商品触发标志

      console.log('[TemuUploadPanel] 开始自动化上传流程...');
      // 开始上传流程
      await startUploadProcess();
      
      // 注意：scanning 会在上传完成或失败时设置为 false
    }
  }

  // 填写商品功能
  async function toggleFillProduct() {
    if (!tabId) {
      return;
    }

    if (isFillingProduct) {
      // 停止填写（目前不支持中途停止，但保留接口）
      isFillingProduct = false;
      statusMessage = '已停止填写商品';
      console.log('[TemuUploadPanel] 已停止填写商品');
    } else {
      // 开始填写商品
      if (searchResults.length === 0) {
        alert('请先上传图片并搜索，或确保已有搜索结果');
        return;
      }

      isFillingProduct = true;
      statusMessage = '准备填写商品...';
      console.log('[TemuUploadPanel] 开始填写商品流程...');
      
      try {
        await handleFillProductAfterSearch();
      } catch (err: any) {
        console.error('[TemuUploadPanel] 填写商品失败:', err);
        statusMessage = `填写商品失败: ${err.message || '未知错误'}`;
      } finally {
        isFillingProduct = false;
      }
    }
  }
</script>

<div class="temu-upload-panel">
  <div class="panel-header">
    <h3>上货</h3>
  </div>

  <div class="panel-content">
    <!-- 主图区域 -->
    <div class="section">
      <div class="section-header">
        <label>主图</label>
      </div>
      <div class="section-content">
        <button class="btn-select-folder" on:click={selectMainImageDirectory}>
          {mainImageDirectory ? '重新选择目录' : '选择目录'}
        </button>
        {#if mainImageDirectory}
          <div class="info-text">目录: {mainImageDirectory}</div>
        {/if}
        <div class="info-text">图片数量: {mainImageCount}</div>
        <div class="image-preview-container">
          <div class="image-preview-scroll">
            {#each mainImageFiles as imagePath, index}
              <div class="image-preview-item {index === positionIndex ? 'selected' : ''}">
                {#if mainImagePreviews.has(imagePath)}
                  <img src={mainImagePreviews.get(imagePath)} alt="主图 {index + 1}" />
                {:else}
                  <div class="image-loading">加载中...</div>
                {/if}
                <div class="image-index">{index + 1}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- 轮播图区域 -->
    <div class="section">
      <div class="section-header">
        <label>轮播图</label>
      </div>
      <div class="section-content">
        <button class="btn-select-folder" on:click={selectCarouselImageDirectory}>
          {carouselImageDirectory ? '重新选择目录' : '选择目录'}
        </button>
        {#if carouselImageDirectory}
          <div class="info-text">目录: {carouselImageDirectory}</div>
        {/if}
        <div class="info-text">图片数量: {carouselImageCount}</div>
        <div class="image-preview-container">
          <div class="image-preview-scroll">
            {#each carouselImageFiles as imagePath, index}
              <div class="image-preview-item">
                {#if carouselImagePreviews.has(imagePath)}
                  <img src={carouselImagePreviews.get(imagePath)} alt="轮播图 {index + 1}" />
                {:else}
                  <div class="image-loading">加载中...</div>
                {/if}
                <div class="image-index">{index + 1}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>


    <!-- 各项杂项配置 -->
    <div class="section">
      <div class="section-header">
        <label>配置</label>
      </div>
      <div class="section-content config-grid">
        <div class="config-item">
          <label>位置索引</label>
          <input 
            type="number" 
            class="input-number" 
            value={positionIndex} 
            min="0"
            max={mainImageFiles.length > 0 ? mainImageFiles.length - 1 : 0}
            on:input={handlePositionIndexChange}
          />
        </div>
        <div class="config-item">
          <label>上传次数</label>
          <input 
            type="number" 
            class="input-number" 
            min="1"
            bind:value={uploadCount}
            on:change={saveConfig}
          />
        </div>
        <div class="config-item">
          <label>上传频率 (ms)</label>
          <input 
            type="number" 
            class="input-number" 
            min="100"
            bind:value={uploadFrequency}
            on:change={saveConfig}
          />
        </div>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="section">
      <div class="section-content">
        <!-- 上传图片按钮 -->
        <button 
          class="btn-action btn-upload {isRunning ? 'running' : ''}"
          on:click={toggleUploadImages}
          disabled={scanning || !tabId}
        >
          {#if scanning}
            上传中...
          {:else if isRunning}
            停止上传
          {:else}
            上传图片
          {/if}
        </button>
        
        <!-- 填写商品按钮 -->
        <button 
          class="btn-action btn-fill {isFillingProduct ? 'running' : ''}"
          on:click={toggleFillProduct}
          disabled={isFillingProduct || !tabId || searchResults.length === 0}
        >
          {#if isFillingProduct}
            填写中...
          {:else}
            填写商品
          {/if}
        </button>
        
        {#if statusMessage}
          <div class="status-message {isRunning ? 'running' : ''}">
            {statusMessage}
          </div>
        {/if}
        
        {#if scanResult}
          <div class="scan-result {scanResult.success ? 'success' : 'error'}">
            {scanResult.message}
          </div>
        {/if}

        {#if uploadedImageIds.length > 0}
          <div class="uploaded-ids">
            <div class="uploaded-ids-header">已上传图片ID:</div>
            <div class="uploaded-ids-list">
              {uploadedImageIds.join(', ')}
            </div>
          </div>
        {/if}

        {#if searchResults.length > 0}
          <div class="search-results">
            <div class="search-results-header">搜索结果 ({searchResults.length} 张):</div>
            <div class="search-results-list">
              {#each searchResults as result}
                <div class="search-result-item">
                  <div class="result-info">
                    <div class="result-id">ID: {result.id}</div>
                    <div class="result-name">{result.materialName || '未命名'}</div>
                    {#if result.imgUrl}
                      <div class="result-url">
                        <a href={result.imgUrl} target="_blank" rel="noopener noreferrer">
                          {result.imgUrl}
                        </a>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .temu-upload-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    min-height: 0;
    background: rgba(26, 31, 58, 0.95);
    border-left: 1px solid rgba(79, 172, 254, 0.2);
    overflow: hidden;
  }

  .panel-header {
    flex-shrink: 0;
    padding: 16px;
    border-bottom: 1px solid rgba(79, 172, 254, 0.2);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .panel-content {
    flex: 1 1 0;
    min-height: 0;
    max-height: 100%;
    overflow-y: auto !important;
    overflow-x: hidden;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    scrollbar-width: thin;
    scrollbar-color: rgba(79, 172, 254, 0.5) rgba(10, 14, 39, 0.3);
    -webkit-overflow-scrolling: touch;
  }

  .panel-content::-webkit-scrollbar {
    width: 10px;
  }

  .panel-content::-webkit-scrollbar-track {
    background: rgba(10, 14, 39, 0.3);
    border-radius: 5px;
  }

  .panel-content::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.5);
    border-radius: 5px;
    border: 2px solid rgba(10, 14, 39, 0.3);
  }

  .panel-content::-webkit-scrollbar-thumb:hover {
    background: rgba(79, 172, 254, 0.7);
  }

  .section {
    background: rgba(10, 14, 39, 0.5);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .section-header {
    padding: 12px 16px;
    background: rgba(79, 172, 254, 0.05);
    border-bottom: 1px solid rgba(79, 172, 254, 0.1);
  }

  .section-header label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .btn-select-folder {
    padding: 8px 16px;
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-select-folder:hover:not(:disabled) {
    box-shadow: 0 2px 8px rgba(79, 172, 254, 0.4);
    transform: translateY(-1px);
  }

  .btn-select-folder:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .info-text {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    word-break: break-all;
  }

  .image-preview-container {
    height: 80px;
    overflow-x: auto;
    overflow-y: hidden;
    background: rgba(10, 14, 39, 0.3);
    border-radius: 4px;
    padding: 8px;
  }

  .image-preview-scroll {
    display: flex;
    gap: 8px;
    height: 100%;
  }

  .image-preview-item {
    position: relative;
    flex-shrink: 0;
    width: 64px;
    height: 64px;
    border-radius: 4px;
    overflow: hidden;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .image-preview-item.selected {
    border-color: #4facfe;
    box-shadow: 0 0 8px rgba(79, 172, 254, 0.5);
  }

  .image-preview-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .image-loading {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(10, 14, 39, 0.5);
    color: rgba(255, 255, 255, 0.5);
    font-size: 10px;
  }

  .image-index {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 2px;
  }

  .image-preview-scroll::-webkit-scrollbar {
    height: 4px;
  }

  .image-preview-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .image-preview-scroll::-webkit-scrollbar-thumb {
    background: rgba(79, 172, 254, 0.3);
    border-radius: 2px;
  }

  .select-template {
    padding: 8px 12px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    cursor: pointer;
    outline: none;
  }

  .select-template:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .config-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .config-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .config-item label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
  }

  .input-number {
    padding: 6px 10px;
    background: rgba(10, 14, 39, 0.8);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    outline: none;
  }

  .input-number:focus {
    border-color: #4facfe;
  }

  .input-number:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-action {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 6px;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .btn-action:last-child {
    margin-bottom: 0;
  }

  .btn-action:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(79, 172, 254, 0.4);
    transform: translateY(-2px);
  }

  .btn-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-upload {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }

  .btn-upload.running {
    background: linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%);
  }

  .btn-fill {
    background: linear-gradient(135deg, #34c759 0%, #30d158 100%);
  }

  .btn-fill.running {
    background: linear-gradient(135deg, #ff9500 0%, #ff9f0a 100%);
  }

  .btn-fill:disabled:not(.running) {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
  }

  .scan-result {
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 11px;
    margin-top: 8px;
  }

  .scan-result.success {
    background: rgba(52, 199, 89, 0.1);
    border: 1px solid rgba(52, 199, 89, 0.3);
    color: #34c759;
  }

  .scan-result.error {
    background: rgba(255, 59, 48, 0.1);
    border: 1px solid rgba(255, 59, 48, 0.3);
    color: #ff3b30;
  }

  .uploaded-ids {
    margin-top: 12px;
    padding: 12px;
    background: rgba(10, 14, 39, 0.5);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
  }

  .uploaded-ids-header {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
  }

  .uploaded-ids-list {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    word-break: break-all;
    max-height: 100px;
    overflow-y: auto;
  }

  .search-results {
    margin-top: 12px;
    padding: 12px;
    background: rgba(10, 14, 39, 0.5);
    border: 1px solid rgba(79, 172, 254, 0.2);
    border-radius: 6px;
    max-height: 300px;
    overflow-y: auto;
  }

  .search-results-header {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 8px;
  }

  .search-results-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .search-result-item {
    padding: 8px;
    background: rgba(10, 14, 39, 0.3);
    border: 1px solid rgba(79, 172, 254, 0.1);
    border-radius: 4px;
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-id {
    font-size: 11px;
    font-weight: 600;
    color: rgba(79, 172, 254, 0.9);
  }

  .result-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .result-url {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    word-break: break-all;
  }

  .result-url a {
    color: rgba(79, 172, 254, 0.8);
    text-decoration: none;
  }

  .result-url a:hover {
    color: rgba(79, 172, 254, 1);
    text-decoration: underline;
  }
</style>
