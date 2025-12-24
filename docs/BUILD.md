# Electron 应用打包说明

## 前置要求

1. 确保已安装所有依赖：`pnpm install`
2. 确保所有 workspace 包已构建完成

## 打包命令

### 从根目录打包（推荐）

```bash
# 构建并打包 Windows 版本
pnpm dist:win

# 构建并打包 macOS 版本
pnpm dist:mac

# 构建并打包 Linux 版本
pnpm dist:linux

# 构建并打包当前平台版本
pnpm dist

# 仅打包（不生成安装程序，用于测试）
pnpm pack
```

### 从 apps/desktop 目录打包

```bash
cd apps/desktop

# 先构建项目
pnpm build

# 然后打包
pnpm dist        # 当前平台
pnpm dist:win    # Windows
pnpm dist:mac    # macOS
pnpm dist:linux  # Linux
pnpm pack        # 仅打包（测试用）
```

## 输出位置

打包后的文件会输出到 `apps/desktop/release/` 目录：

- **Windows**: `Poly Apps-0.1.0-x64.exe` (安装程序)
- **macOS**: `Poly Apps-0.1.0.dmg` (磁盘镜像)
- **Linux**: `Poly Apps-0.1.0-x64.AppImage` (可执行文件)

## 快速启动

打包完成后，可以直接运行生成的可执行文件：

- **Windows**: 双击 `Poly Apps-0.1.0-x64.exe` 安装，或运行 `release/win-unpacked/Poly Apps.exe`
- **macOS**: 双击 `Poly Apps-0.1.0.dmg` 安装
- **Linux**: 直接运行 `Poly Apps-0.1.0-x64.AppImage`

## 使用代理或镜像源加速下载

### 方法一：使用国内镜像源（已配置）

配置文件 `electron-builder.yml` 已默认使用淘宝镜像源，如果速度仍然慢，可以尝试方法二。

### 方法二：使用代理

如果您的代理地址是 `http://127.0.0.1:7890`，可以这样设置：

**PowerShell:**
```powershell
# 设置代理环境变量
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"

# 然后执行打包
pnpm dist:win
```

**CMD:**
```cmd
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890
pnpm dist:win
```

**或者使用带代理的脚本（已添加到 package.json）:**
```bash
# 先设置代理环境变量，然后使用代理脚本
# PowerShell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
pnpm dist:win:proxy
```

### 方法三：修改镜像源

编辑 `apps/desktop/electron-builder.yml`，修改 `electronDownload.mirror` 为其他镜像：
- 淘宝镜像：`https://npmmirror.com/mirrors/electron/`
- 官方源：`https://github.com/electron/electron/releases/download/`

## 注意事项

1. 首次打包会下载 Electron 二进制文件，可能需要一些时间
2. 打包前确保所有依赖的 workspace 包都已构建（`pnpm build` 会自动处理）
3. 如果需要自定义图标，请将图标文件放在 `build/` 目录：
   - Windows: `build/icon.ico`
   - macOS: `build/icon.icns`
   - Linux: `build/icon.png`
4. 如果下载失败，检查网络连接或尝试使用代理

## 清理

```bash
# 清理构建产物和打包文件
pnpm clean
```

