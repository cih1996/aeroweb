# AI 服务模块

这个模块提供了统一的 AI API 调用接口，支持多种 AI 服务商（OpenAI、DeepSeek 等），并提供了提示词管理、历史对话管理等功能。

## 目录结构

```
services/ai/
├── index.ts              # 模块导出
├── types.ts              # 类型定义
├── config.ts             # 配置管理（存储/加载 AI 配置）
├── prompt-loader.ts      # 提示词文件加载器
├── history-manager.ts    # 历史对话管理器
└── ai-service.ts         # AI 服务核心类
```

## 功能特性

- ✅ 支持多种 AI 服务商（OpenAI、DeepSeek）
- ✅ 提示词文件管理（通过文件路径配置）
- ✅ 历史对话管理（按会话ID区分）
- ✅ 流式响应支持
- ✅ 配置管理（API Key、代理等）
- ✅ 清空历史对话

## 使用方法

### 1. 配置 AI 服务

在左侧菜单点击"AI 设置"按钮，配置：
- AI 服务商（OpenAI/DeepSeek）
- API Key
- Base URL（可选）
- 模型名称
- 是否使用代理
- 代理地址（如果启用）

### 2. 使用 AI 服务

```typescript
import { AIService, loadAIConfig } from '../services/ai';

// 加载配置
const config = loadAIConfig();

// 创建服务实例
const aiService = new AIService(config);

// 加载提示词文件
await aiService.loadPromptFile('douyin-assistant.txt');

// 设置历史对话文件
aiService.setHistoryFile('session_123');

// 发送消息（流式）
for await (const chunk of aiService.chatStream('你好', {
  historyFile: 'session_123',
  useHistory: true,
  maxTokens: 2000,
  temperature: 0.7,
  stream: true,
})) {
  console.log(chunk.content);
}
```

### 3. 提示词文件

提示词文件存放在 `public/prompts/` 目录下：

- `default.txt` - 默认提示词
- `douyin-assistant.txt` - 抖音助手提示词

可以通过文件路径加载提示词：

```typescript
await aiService.loadPromptFile('douyin-assistant.txt');
```

### 4. 历史对话管理

历史对话按会话ID（historyFile）区分，每个会话独立存储：

```typescript
// 获取历史对话
const history = aiService.getHistory('session_123');

// 清空历史对话
aiService.clearHistory('session_123');
```

## API 参考

### AIService

#### 方法

- `loadPromptFile(promptFilePath: string): Promise<void>` - 加载提示词文件
- `setSystemPrompt(prompt: string | null): void` - 设置系统提示词
- `setHistoryFile(historyFile: string): void` - 设置历史对话文件
- `getHistory(historyFile?: string): Message[]` - 获取历史对话
- `clearHistory(historyFile?: string): void` - 清空历史对话
- `chat(message: string, options?: ChatOptions): Promise<ChatResponse>` - 发送消息（非流式）
- `chatStream(message: string, options?: ChatOptions, onChunk?: (chunk: StreamChunk) => void): AsyncGenerator<StreamChunk>` - 发送消息（流式）

### 配置管理

- `loadAIConfig(): AIConfig` - 加载配置
- `saveAIConfig(config: AIConfig): void` - 保存配置
- `validateConfig(config: AIConfig): { valid: boolean; error?: string }` - 验证配置

### 历史对话管理

- `loadHistory(historyFile: string): Message[]` - 加载历史对话
- `saveHistory(historyFile: string, history: Message[]): void` - 保存历史对话
- `clearHistory(historyFile: string): void` - 清空历史对话
- `getHistoryCount(historyFile: string): number` - 获取历史对话数量

## 提示词文件格式

提示词文件是纯文本文件，可以包含占位符（未来扩展）：

```
你是一个友好的AI助手。

你的主要职责：
1. 理解用户的需求
2. 提供准确、有用的回答
```

## 注意事项

1. 配置保存在 localStorage 中，键名为 `ai_config`
2. 历史对话保存在 localStorage 中，键名为 `ai_history_{historyFile}`
3. 提示词文件需要放在 `public/prompts/` 目录下
4. 使用代理时，需要确保代理地址格式正确（`http://host:port` 或 `https://host:port`）

