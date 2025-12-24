/**
 * 提示词文件加载器
 * 负责从文件路径加载提示词内容
 */

import { generateActionDocs } from './action-docs';

/**
 * 加载提示词文件
 * @param promptFilePath 提示词文件路径（相对于 public 目录或绝对路径）
 * @param appId 应用ID，用于动态注入操作方法说明
 */
export async function loadPromptFile(promptFilePath: string, appId?: string): Promise<string> {
  try {
    // 统一使用相对路径加载提示词文件（生产环境标准）
    let url = promptFilePath;
    if (!promptFilePath.startsWith('http://') && !promptFilePath.startsWith('https://') && !promptFilePath.startsWith('./') && !promptFilePath.startsWith('/')) {
      url = `./prompts/${promptFilePath}`;
    } else if (promptFilePath.startsWith('/')) {
      // 将绝对路径转换为相对路径
      url = `.${promptFilePath}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`加载提示词文件失败: ${response.status} ${response.statusText}`);
    }
    
    let content = await response.text();
    
    // 如果提示词中包含 {{ACTION_DOCS}} 占位符，则替换为操作方法说明
    if (content.includes('{{ACTION_DOCS}}') && appId) {
      const actionDocs = generateActionDocs(appId);
      content = content.replace('{{ACTION_DOCS}}', actionDocs);
    }
    
    return content.trim();
  } catch (error) {
    console.error('[PromptLoader] 加载提示词失败:', error);
    throw error;
  }
}

/**
 * 获取提示词文件列表
 */
export async function listPromptFiles(): Promise<string[]> {
  try {
    // 这里可以扩展为从服务器获取提示词列表
    // 目前返回默认的提示词文件列表
    return [
      'default.txt',
      'douyin-assistant.txt',
    ];
  } catch (error) {
    console.error('[PromptLoader] 获取提示词列表失败:', error);
    return [];
  }
}

