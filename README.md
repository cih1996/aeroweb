# 🌐 AeroWeb — Browser for AI Agents

<p align="center">
  <img src="docs/assets/aeroweb-logo.png" alt="AeroWeb" width="200">
</p>

<p align="center">
  <strong>Let AI take the wheel. 🚀</strong>
</p>

<p align="center">
  <a href="https://github.com/cih1996/polyWebsAI/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/cih1996/polyWebsAI/release.yml?style=for-the-badge" alt="Build"></a>
  <a href="https://github.com/cih1996/polyWebsAI/releases"><img src="https://img.shields.io/github/v/release/cih1996/polyWebsAI?include_prereleases&style=for-the-badge" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License"></a>
</p>

**AeroWeb** is a browser built for AI agents. It exposes browser capabilities through CLI, HTTP API, and MCP Server — no human interaction required. Click buttons, fill forms, upload files, take screenshots, all programmatically.

If you want your AI to browse the web like a human but faster and without popups, this is it.

[Releases](https://github.com/cih1996/polyWebsAI/releases) · [CLI Docs](#cli-usage) · [API Reference](#api-endpoints) · [MCP Integration](#mcp-server)

## Why AeroWeb?

| Feature | Chrome DevTools | Puppeteer | AeroWeb |
|---------|-----------------|-----------|---------|
| GUI for debugging | ❌ | ❌ | ✅ |
| Multi-instance management | ❌ | Manual | ✅ Built-in |
| File upload without dialog | ❌ | Complex | ✅ One command |
| MCP Server for AI | ❌ | ❌ | ✅ Native |
| Standalone app | ❌ | ❌ | ✅ Download & run |

## Install

Download from [Releases](https://github.com/cih1996/polyWebsAI/releases):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | `AeroWeb-x.x.x-arm64.dmg` |
| macOS (Intel) | `AeroWeb-x.x.x-x64.dmg` |
| Windows | `AeroWeb-x.x.x-x64.exe` |
| Linux | `AeroWeb-x.x.x-x64.AppImage` |

## Quick Start

```bash
# 1. Launch AeroWeb app

# 2. Create a new tab
aeroweb tab new https://example.com --name "My Bot"

# 3. Let AI do its thing
aeroweb tab type <tabId> "input#search" "hello world"
aeroweb tab click <tabId> "button[type=submit]"
aeroweb tab screenshot <tabId> -o result.png
```

## Highlights

- **🖥️ Visual Browser** — Real Chromium with GUI, see what AI sees.
- **🤖 MCP Server** — Native integration with Claude, GPT, and other AI agents.
- **📡 HTTP API** — RESTful endpoints for any language/platform.
- **⌨️ CLI Tools** — Shell commands for scripting and automation.
- **📁 File Upload** — Intercept file dialogs, inject files programmatically.
- **📸 Screenshots** — Capture full page or specific elements.
- **🔍 DOM Snapshot** — Get page structure for AI analysis.
- **📋 Console Logs** — Collect browser console output.
- **🏷️ Multi-Tab** — Manage multiple browser instances independently.

## CLI Usage

```bash
# List all tabs
aeroweb tabs

# Create new tab
aeroweb tab new <url> [--name "Tab Name"]

# Navigate
aeroweb tab goto <tabId> <url>

# Screenshot
aeroweb tab screenshot <tabId> [-o output.png] [--full]

# DOM Snapshot
aeroweb tab snapshot <tabId>

# Execute JavaScript
aeroweb tab exec <tabId> -e "document.title"

# Click element
aeroweb tab click <tabId> "button.submit"

# Type text
aeroweb tab type <tabId> "input#email" "test@example.com" [-c]

# Upload file (no dialog!)
aeroweb tab upload <tabId> /path/to/file.png

# Get console logs
aeroweb tab console <tabId>

# Close tab
aeroweb tab close <tabId>
```

## API Endpoints

Base URL: `http://localhost:18923/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/tabs` | List all tabs |
| `POST` | `/tabs` | Create new tab |
| `GET` | `/tabs/:id` | Get tab info |
| `DELETE` | `/tabs/:id` | Close tab |
| `POST` | `/tabs/:id/goto` | Navigate to URL |
| `POST` | `/tabs/:id/screenshot` | Take screenshot |
| `POST` | `/tabs/:id/snapshot` | Get DOM snapshot |
| `POST` | `/tabs/:id/exec` | Execute JavaScript |
| `POST` | `/tabs/:id/click` | Click element |
| `POST` | `/tabs/:id/type` | Type into element |
| `POST` | `/tabs/:id/upload` | Upload file |
| `GET` | `/tabs/:id/console` | Get console logs |

### Example: Login automation

```bash
# Create tab
curl -X POST http://localhost:18923/api/tabs \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/login", "name": "Login Bot"}'

# Type username
curl -X POST http://localhost:18923/api/tabs/tab_xxx/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "#username", "text": "admin"}'

# Type password
curl -X POST http://localhost:18923/api/tabs/tab_xxx/type \
  -H "Content-Type: application/json" \
  -d '{"selector": "#password", "text": "secret123"}'

# Click login
curl -X POST http://localhost:18923/api/tabs/tab_xxx/click \
  -H "Content-Type: application/json" \
  -d '{"selector": "button[type=submit]"}'

# Screenshot result
curl -X POST http://localhost:18923/api/tabs/tab_xxx/screenshot \
  --output result.png
```

## MCP Server

AeroWeb exposes an MCP Server for AI agent integration.

```json
{
  "mcpServers": {
    "aeroweb": {
      "command": "aeroweb",
      "args": ["mcp"]
    }
  }
}
```

Available tools for AI:
- `browser_list_tabs` — List open tabs
- `browser_new_tab` — Open new tab
- `browser_goto` — Navigate to URL
- `browser_screenshot` — Take screenshot
- `browser_snapshot` — Get DOM structure
- `browser_exec` — Run JavaScript
- `browser_click` — Click element
- `browser_type` — Type text
- `browser_upload` — Upload file
- `browser_console` — Get console logs

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                      AI Agent                           │
│              (Claude / GPT / Custom)                    │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
   ┌────────┐   ┌──────────┐   ┌─────────┐
   │  CLI   │   │ HTTP API │   │   MCP   │
   └────┬───┘   └────┬─────┘   └────┬────┘
        │            │              │
        └────────────┼──────────────┘
                     ▼
        ┌────────────────────────┐
        │       AeroWeb          │
        │   (Electron Browser)   │
        │                        │
        │  ┌──────┐ ┌──────┐    │
        │  │ Tab1 │ │ Tab2 │ …  │
        │  └──────┘ └──────┘    │
        └────────────────────────┘
```

## Development

```bash
# Clone
git clone https://github.com/cih1996/polyWebsAI.git
cd polyWebsAI

# Install
pnpm install

# Dev mode
pnpm dev

# Build
pnpm build:desktop

# Package
pnpm dist:mac    # macOS
pnpm dist:win    # Windows
pnpm dist:linux  # Linux
```

## Tech Stack

- **Runtime**: Electron 39
- **Frontend**: Svelte + TypeScript
- **Build**: Turbo (Monorepo) + Vite
- **Package**: pnpm

## Roadmap

- [ ] Keyboard shortcuts simulation
- [ ] Network request interception
- [ ] Cookie/Storage management
- [ ] Proxy configuration per tab
- [ ] Recording & playback
- [ ] Headless mode

## License

MIT © 2024

---

<p align="center">
  <sub>Built for AI, by humans. 🤖</sub>
</p>
