/**
 * AI 配置管理
 * 负责存储和加载 AI 配置（API Key、代理等）
 * 每个服务商有独立的配置存储
 */

import type { AIConfig } from './types';

const STORAGE_KEY_PREFIX = 'ai_config_';
const CURRENT_PROVIDER_KEY = 'ai_current_provider';

/**
 * 获取默认配置（根据服务商）
 */
export function getDefaultConfig(provider: 'openai' | 'deepseek' = 'openai'): AIConfig {
  const defaults: Record<string, Partial<AIConfig>> = {
    openai: {
      provider: 'openai',
      apiKey: '',
      baseUrl: '',
      model: 'gpt-4o-mini',
      useProxy: false,
      proxyUrl: '',
    },
    deepseek: {
      provider: 'deepseek',
      apiKey: '',
      baseUrl: '',
      model: 'deepseek-chat',
      useProxy: false,
      proxyUrl: '',
    },
  };

  return defaults[provider] as AIConfig;
}

/**
 * 获取当前选择的服务商
 */
export function getCurrentProvider(): 'openai' | 'deepseek' {
  try {
    const stored = localStorage.getItem(CURRENT_PROVIDER_KEY);
    if (stored === 'openai' || stored === 'deepseek') {
      return stored;
    }
  } catch (error) {
    console.error('[AIConfig] 获取当前服务商失败:', error);
  }
  return 'openai';
}

/**
 * 设置当前选择的服务商
 */
export function setCurrentProvider(provider: 'openai' | 'deepseek'): void {
  try {
    localStorage.setItem(CURRENT_PROVIDER_KEY, provider);
  } catch (error) {
    console.error('[AIConfig] 设置当前服务商失败:', error);
  }
}

/**
 * 获取服务商的存储键
 */
function getProviderStorageKey(provider: 'openai' | 'deepseek'): string {
  return `${STORAGE_KEY_PREFIX}${provider}`;
}

/**
 * 加载指定服务商的配置
 */
export function loadAIConfig(provider?: 'openai' | 'deepseek'): AIConfig {
  const targetProvider = provider || getCurrentProvider();
  const storageKey = getProviderStorageKey(targetProvider);
  
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) {
      return getDefaultConfig(targetProvider);
    }
    const config = JSON.parse(stored) as AIConfig;
    // 确保 provider 字段正确
    config.provider = targetProvider;
    // 合并默认配置，确保所有字段都存在
    return { ...getDefaultConfig(targetProvider), ...config };
  } catch (error) {
    console.error('[AIConfig] 加载配置失败:', error);
    return getDefaultConfig(targetProvider);
  }
}

/**
 * 保存指定服务商的配置
 */
export function saveAIConfig(config: AIConfig): void {
  try {
    const provider = config.provider;
    const storageKey = getProviderStorageKey(provider);
    
    // 保存该服务商的配置
    localStorage.setItem(storageKey, JSON.stringify(config));
    
    // 更新当前选择的服务商
    setCurrentProvider(provider);
    
    console.log(`[AIConfig] ${provider} 配置已保存`);
  } catch (error) {
    console.error('[AIConfig] 保存配置失败:', error);
    throw error;
  }
}

/**
 * 加载所有服务商的配置
 */
export function loadAllConfigs(): Record<'openai' | 'deepseek', AIConfig> {
  return {
    openai: loadAIConfig('openai'),
    deepseek: loadAIConfig('deepseek'),
  };
}

/**
 * 验证配置是否完整
 */
export function validateConfig(config: AIConfig): { valid: boolean; error?: string } {
  if (!config.apiKey || config.apiKey.trim() === '') {
    return { valid: false, error: 'API Key 不能为空' };
  }
  
  if (config.useProxy && (!config.proxyUrl || config.proxyUrl.trim() === '')) {
    return { valid: false, error: '启用代理时，代理地址不能为空' };
  }
  
  return { valid: true };
}

