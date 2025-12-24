# 应用配置说明

## 目录结构

```
apps/
├── apps.json          # 应用配置文件
└── icons/             # 应用图标目录
    ├── whatsapp.svg
    ├── telegram.svg
    └── ...
```

## 配置文件格式

`apps.json` 文件格式如下：

```json
{
  "apps": [
    {
      "id": "whatsapp",
      "name": "WhatsApp",
      "url": "https://web.whatsapp.com",
      "icon": "whatsapp.svg",
      "color": "#25D366"
    }
  ]
}
```

### 字段说明

- **id** (必需): 应用的唯一标识符
- **name** (必需): 应用的显示名称
- **url** (必需): 应用的网址
- **icon** (必需): 图标文件名（相对于 `icons/` 目录）
- **color** (可选): 应用的主题色，用于 UI 装饰效果

## 添加新应用

1. 在 `icons/` 目录下添加应用的 SVG 图标文件
2. 在 `apps.json` 中添加应用配置项
3. 重启应用或刷新页面即可看到新应用

## 图标要求

- 格式：SVG
- 建议尺寸：24x24 或 48x48
- 颜色：建议使用单色或品牌色
- 文件命名：使用小写字母和连字符，如 `my-app.svg`

