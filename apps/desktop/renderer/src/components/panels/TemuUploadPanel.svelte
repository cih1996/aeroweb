<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { searchImages, fillProduct, clickUploadImage } from './actions/temu-actions';

  export let tabId: string | null = null;

  // 配置对象
  let config = {
    // 主图相关
    mainImageDirectory: null as string | null,
    mainImageFiles: [] as string[],
    mainImageCount: 0,
    mainImagePreviews: new Map<string, string>() as Map<string, string>, // 存储图片路径到 base64 data URL 的映射
    
    // 轮播图相关
    carouselImageDirectory: null as string | null,
    carouselImageFiles: [] as string[],
    carouselImageCount: 0,
    carouselImagePreviews: new Map<string, string>() as Map<string, string>, // 存储图片路径到 base64 data URL 的映射
    
    // 其他配置
    positionIndex: 0,
    uploadCount: 1,
    uploadFrequency: 1000,
  };

  // 临时状态变量
  let currentUploadCount = 0; // 当前已上传次数
  let searchResults: Array<{ id: number; materialName: string; imgUrl: string }> = []; // 搜索结果
  let fillProductTriggered = false; // 是否已触发填写商品流程

  // 目标页面URL
  const TARGET_URL = 'https://agentseller.temu.com/material/material-center';

  // 保存配置到 Electron
  async function saveConfig() {
    if (!tabId) return;
    
    const configToSave = {
      mainImageDirectory: config.mainImageDirectory,
      carouselImageDirectory: config.carouselImageDirectory,
      positionIndex: config.positionIndex,
      uploadCount: config.uploadCount,
      uploadFrequency: config.uploadFrequency,
    };
    
    try {
      await window.electronAPI.config.save('temu-upload', tabId, configToSave);
      console.log("保存配置成功")
    } catch (err) {
      console.error('[TemuUploadPanel] 保存配置失败:', err);
    }
  }

  // 从 Electron 加载配置
  async function loadConfig() {
    if (!tabId) return;
    
    try {
      const result = await window.electronAPI.config.load('temu-upload', tabId);
      if (result.success && result.config) {
        const savedConfig = result.config;
        
        // 恢复配置
        if (savedConfig.mainImageDirectory) {
          config.mainImageDirectory = savedConfig.mainImageDirectory;
          await loadMainImages(savedConfig.mainImageDirectory);
        }
        
        if (savedConfig.carouselImageDirectory) {
          config.carouselImageDirectory = savedConfig.carouselImageDirectory;
          await loadCarouselImages();
        }
        
        if (savedConfig.positionIndex !== undefined) {
          config.positionIndex = savedConfig.positionIndex;
        }
        
        if (savedConfig.uploadCount !== undefined) {
          config.uploadCount = savedConfig.uploadCount;
        }
        
        if (savedConfig.uploadFrequency !== undefined) {
          config.uploadFrequency = savedConfig.uploadFrequency;
        }
      }
    } catch (err) {
      console.error('[TemuUploadPanel] 加载配置失败:', err);
    }
  }

  onMount(async () => {
    // 从 Electron 存储加载配置
    console.log("[TemuUploadPanel] 加载配置")
    await loadConfig();

  });

  onDestroy(() => {

  });




  // 从文件路径提取文件名（不含扩展名）
  function getFileNameWithoutExtension(filePath: string): string {
    const fileName = filePath.split(/[/\\]/).pop() || '';
    const lastDotIndex = fileName.lastIndexOf('.');
    return lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  }

  // 根据原始图片路径顺序重新排序搜索结果
  function reorderSearchResults(
    originalImagePaths: string[],
    searchResults: Array<{ id: number; materialName: string; imgUrl: string }>
  ): Array<{ id: number; materialName: string; imgUrl: string }> {
    // 创建文件名到搜索结果的映射
    const resultMap = new Map<string, { id: number; materialName: string; imgUrl: string }>();
    for (const result of searchResults) {
      resultMap.set(result.materialName, result);
    }

    // 按照原始图片路径顺序重新排序
    const reorderedResults: Array<{ id: number; materialName: string; imgUrl: string }> = [];
    for (const imagePath of originalImagePaths) {
      const fileName = getFileNameWithoutExtension(imagePath);
      const result = resultMap.get(fileName);
      if (result) {
        reorderedResults.push(result);
      } else {
        console.warn(`[TemuUploadPanel] 未找到匹配的搜索结果: ${fileName}`);
      }
    }

    // 如果有些搜索结果没有匹配到，添加到末尾
    for (const result of searchResults) {
      if (!reorderedResults.find(r => r.id === result.id)) {
        reorderedResults.push(result);
      }
    }

    return reorderedResults;
  }

// 上传图片功能
async function toggleUploadImages() {
    if (!tabId) {
      return;
    }
    // 开始上传 - 验证配置
    if (config.mainImageFiles.length === 0) { alert('请先选择主图目录'); return;  }
    if (config.carouselImageFiles.length === 0) { alert('请先选择轮播图目录');return;  }
    if (config.positionIndex < 0 || config.positionIndex >= config.mainImageFiles.length) {alert(`位置索引无效，应在 0-${config.mainImageFiles.length - 1} 之间`); return; }
    // 重置状态
    currentUploadCount = 0;
    searchResults = []; // 清空搜索结果
    fillProductTriggered = false; // 重置填写商品触发标志
    console.log('[TemuUploadPanel] 开始自动化上传流程...');
    try {
      // 设置文件上传拦截
      const selectedMainImage = config.mainImageFiles[config.positionIndex];
      const imagePaths = [selectedMainImage, ...config.carouselImageFiles];
      
      // 验证图片路径
      if (!selectedMainImage) {
        return;
      }
      // 验证轮播图路径
      if (config.carouselImageFiles.length === 0) {
        return;
      }
      
      console.log('[TemuUploadPanel] 📤 准备上传图片:', {
        主图索引: config.positionIndex,
        主图路径: selectedMainImage,
        轮播图数量: config.carouselImageFiles.length,
        总图片数: imagePaths.length,
        图片路径列表: imagePaths
      });
      const scanResultData = await window.electronAPI.tab.triggerFileUploadScan(tabId, imagePaths);
      if (!scanResultData.success) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待拦截器设置完成
      const clickResult = await clickUploadImage(tabId, imagePaths.length);
      if (!clickResult.success) {
        return;
      }
      
      // 根据原始图片路径顺序重新排序搜索结果
      const rawResults = clickResult.data;
      searchResults = reorderSearchResults(imagePaths, rawResults);
      
      console.log("[TemuUploadPanel] 上传图片响应结果（原始）:", rawResults);
      console.log("[TemuUploadPanel] 上传图片响应结果（重新排序后）:", searchResults);

    } catch (err: any) {
      console.error('[TemuUploadPanel] 上传流程失败:', err);
    }
}
  
  // 填写商品功能
  async function toggleFillProduct() {
    if (!tabId) {
      return;
    }

      console.log('[TemuUploadPanel] 开始填写商品流程...');
      try {
        // 3. 执行填写商品脚本（使用第一个搜索结果的 materialName 作为商品标题）
        const goodsTitle = searchResults[0]?.materialName || '商品标题';
        // 提取所有搜索结果的图片URL
        const imageUrls = searchResults
          .filter(result => result.imgUrl && result.imgUrl.trim() !== '')
          .map(result => result.imgUrl);
        
        console.log('[TemuUploadPanel] 📝 使用商品标题:', goodsTitle);
        console.log('[TemuUploadPanel] 📝 图片URL数组:', imageUrls);
        await fillProduct(tabId, goodsTitle, imageUrls);
        
      } catch (err: any) {
        console.error('[TemuUploadPanel] 填写商品失败:', err);
      } 
  }
  
  // 打开主图路径选择器
  async function selectMainImageDirectory() {
    try {
      const directory = await window.electronAPI.fs.selectDirectory();
      if (directory) {
        config.mainImageDirectory = directory;
        await loadMainImages(directory);
        await saveConfig(); // 保存配置
      }
    } catch (err: any) {
      console.error('[TemuUploadPanel] 选择主图目录失败:', err);
      alert('选择目录失败: ' + err.message);
    }
  }

  // 加载指定主图路径图片
  async function loadMainImages(directory?: string) {
    const targetDirectory = directory || config.mainImageDirectory;
    if (!targetDirectory) return;
    
    try {
      const files = await window.electronAPI.fs.readImageFiles(targetDirectory);
      config.mainImageFiles = files;
      config.mainImageCount = files.length;
      
      // 清空之前的预览
      config.mainImagePreviews.clear();
      
      // 异步加载所有图片的 base64 预览
      for (const filePath of files) {
        try {
          const base64 = await window.electronAPI.fs.readImageAsBase64(filePath);
          config.mainImagePreviews.set(filePath, base64);
        } catch (err) {
          console.error('[TemuUploadPanel] 加载主图预览失败:', filePath, err);
        }
      }
      
      // 触发响应式更新
      config = config;
    } catch (err: any) {
      console.error('[TemuUploadPanel] 读取主图失败:', err);
      alert('读取图片失败: ' + err.message);
      config.mainImageFiles = [];
      config.mainImageCount = 0;
      config.mainImagePreviews.clear();
      config = config;
    }
  }

  // 打开轮播图路径选择器
  async function selectCarouselImageDirectory() {
    try {
      const directory = await window.electronAPI.fs.selectDirectory();
      if (directory) {
        config.carouselImageDirectory = directory;
        await loadCarouselImages();
        await saveConfig(); // 保存配置
      }
    } catch (err: any) {
      console.error('[TemuUploadPanel] 选择轮播图目录失败:', err);
      alert('选择目录失败: ' + err.message);
    }
  }

  // 加载指定轮播图路径图片
  async function loadCarouselImages() {
    if (!config.carouselImageDirectory) return;
    
    try {
      const files = await window.electronAPI.fs.readImageFiles(config.carouselImageDirectory);
      config.carouselImageFiles = files;
      config.carouselImageCount = files.length;
      
      // 清空之前的预览
      config.carouselImagePreviews.clear();
      
      // 异步加载所有图片的 base64 预览
      for (const filePath of files) {
        try {
          const base64 = await window.electronAPI.fs.readImageAsBase64(filePath);
          config.carouselImagePreviews.set(filePath, base64);
        } catch (err) {
          console.error('[TemuUploadPanel] 加载轮播图预览失败:', filePath, err);
        }
      }
      
      // 触发响应式更新
      config = config;
    } catch (err: any) {
      console.error('[TemuUploadPanel] 读取轮播图失败:', err);
      alert('读取图片失败: ' + err.message);
      config.carouselImageFiles = [];
      config.carouselImageCount = 0;
      config.carouselImagePreviews.clear();
      config = config;
    }
  }

  // 更新上传索引位置
  async function handlePositionIndexChange(event: Event) {
    const target = event.target as HTMLInputElement;
    config.positionIndex = parseInt(target.value, 10) || 0;
    config = config;
    await saveConfig(); 
  }

  
</script>

<div class="temu-upload-panel">
  <div class="panel-content">
    <!-- 主图区域 -->
    <div class="section">
      <div class="section-header">
        <label for="main-image-directory">主图</label>
      </div>
      <div class="section-content" role="button" tabindex="0" >
  
          <div class="info-text">目录: {config.mainImageDirectory || '未选择'}

            <button type="button" class="btn-select-folder" on:click={selectMainImageDirectory} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectMainImageDirectory(); } }}>
              选择
            </button>
          </div>
  
        <div class="info-text">图片数量: {config.mainImageCount}</div>
        <div class="image-preview-container">
          <div class="image-preview-scroll">
            {#each config.mainImageFiles as imagePath, index}
              <div class="image-preview-item {index === config.positionIndex ? 'selected' : ''}">
                {#if config.mainImagePreviews.has(imagePath)}
                  <img src={config.mainImagePreviews.get(imagePath)} alt="主图 {index + 1}" />
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
        <label for="carousel-image-directory">轮播图</label>
      </div>
      <div class="section-content">
      
          <div class="info-text">目录: {config.carouselImageDirectory || '未选择'}

            <button type="button" class="btn-select-folder" on:click={selectCarouselImageDirectory} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { selectCarouselImageDirectory(); } }}>
              选择
            </button>
          </div>
   

        

        <div class="info-text">图片数量: {config.carouselImageCount}</div>
        <div class="image-preview-container">
          <div class="image-preview-scroll">
            {#each config.carouselImageFiles as imagePath, index}
              <div class="image-preview-item">
                {#if config.carouselImagePreviews.has(imagePath)}
                  <img src={config.carouselImagePreviews.get(imagePath)} alt="轮播图 {index + 1}" />
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
        <label for="config">配置</label>
      </div>
      <div class="section-content config-grid">
        <div class="config-item">
          <label for="position-index">位置索引</label>
          <input 
            type="number" 
            class="input-number" 
            value={config.positionIndex} 
            min="0"
            max={config.mainImageFiles.length > 0 ? config.mainImageFiles.length - 1 : 0}
            on:input={handlePositionIndexChange}
          />
        </div>
        <div class="config-item">
          <label for="upload-count">上传次数</label>
          <input 
            type="number" 
            class="input-number" 
            min="1"
            bind:value={config.uploadCount}
            on:change={saveConfig}
          />
        </div>
        <div class="config-item">
          <label for="upload-frequency">上传频率 (ms)</label>
          <input 
            type="number" 
            class="input-number" 
            min="100"
            bind:value={config.uploadFrequency}
            on:change={saveConfig}
          />
        </div>
      </div>
    </div>

    <!-- 功能按钮 -->
    <div class="section">
      <div class="section-content">
        <!-- 上传图片按钮 -->
        <button class="btn-action btn-upload" on:click={toggleUploadImages}>上传图片</button>
        
        <!-- 填写商品按钮 -->
        <button class="btn-action btn-fill" on:click={toggleFillProduct}>填写商品</button>

        <button
          class="btn-action btn-navigate"
          on:click={async () => {
            if (!tabId) return;
            await window.electronAPI.browser.navigate(tabId, TARGET_URL);
          }}
        >
          跳转素材中心
        </button>
        <button
          class="btn-action btn-navigate"
          on:click={async () => {
            if (!tabId) return;
            try {
              const CREATE_PRODUCT_URL = 'https://agentseller.temu.com/goods/edit?productDraftId=9079572308&from=menu&st_time=1766207397385';
              await window.electronAPI.browser.navigate(tabId, CREATE_PRODUCT_URL);
            } catch (err) {

              console.error('[TemuUploadPanel] 跳转商品创建页面失败:', err);
            }
          }}
        >
          跳转商品创建
        </button>
  
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
    gap: 5px;
  }

  .btn-select-folder {
    float: right;
    border: none;
    border-radius: 6px;
    color: white;
    background: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
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


  .btn-upload {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }

 
  .btn-fill {
    background: linear-gradient(135deg, #34c759 0%, #30d158 100%);
  }

  .btn-navigate{
    background: linear-gradient(135deg, #f17209 0%, #e65f11 100%);
  }

</style>
