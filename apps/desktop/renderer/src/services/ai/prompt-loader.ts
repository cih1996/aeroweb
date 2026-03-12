/**
 * 提示词文件加载器
 * 负责从文件路径加载提示词内容
 */

import { generateActionDocs } from './action-docs';

/**
 * 加载提示词文件
 * @param promptFilePath 提示词文件路径（相对于 public 目录）
 */
export async function loadPromptFile(promptFilePath: string): Promise<string> {
  try {
    let url = promptFilePath;
    if (!promptFilePath.startsWith('http://') && !promptFilePath.startsWith('https://') && !promptFilePath.startsWith('./') && !promptFilePath.startsWith('/')) {
      url = `./prompts/${promptFilePath}`;
    } else if (promptFilePath.startsWith('/')) {
      url = `.${promptFilePath}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`加载提示词文件失败: ${response.status} ${response.statusText}`);
    }

    let content = await response.text();

    // 替换操作方法说明占位符
    if (content.includes('{{ACTION_DOCS}}')) {
      const actionDocs = generateActionDocs();
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
  return ['default.txt'];
}
