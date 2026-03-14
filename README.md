# PolyWebsAI

AI-powered browser automation tool with CLI/MCP support.

## Features

- Multi-instance browser management
- CLI commands for automation
- MCP Server for AI integration
- HTTP API for programmatic control
- File upload interception (no dialog popups)
- Screenshot, DOM snapshot, console logs

## Installation

Download from [Releases](https://github.com/cih1996/polyWebsAI/releases):

| Platform | File |
|----------|------|
| macOS (Intel) | `PolyWebsAI-x.x.x-x64.dmg` |
| macOS (Apple Silicon) | `PolyWebsAI-x.x.x-arm64.dmg` |
| Windows | `PolyWebsAI-x.x.x-x64.exe` |
| Linux | `PolyWebsAI-x.x.x-x64.AppImage` |

## CLI Usage

```bash
# List tabs
polyweb tabs

# Create new tab
polyweb tab new https://example.com --name "My Tab"

# Take screenshot
polyweb tab screenshot <tabId> -o screenshot.png

# Execute JavaScript
polyweb tab exec <tabId> -e "document.title"

# Click element
polyweb tab click <tabId> "button.submit"

# Type text
polyweb tab type <tabId> "input#search" "hello world"

# Upload file (no dialog)
polyweb tab upload <tabId> /path/to/file.png
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tabs` | List all tabs |
| POST | `/api/tabs` | Create new tab |
| GET | `/api/tabs/:id` | Get tab info |
| DELETE | `/api/tabs/:id` | Close tab |
| POST | `/api/tabs/:id/goto` | Navigate |
| POST | `/api/tabs/:id/screenshot` | Take screenshot |
| POST | `/api/tabs/:id/snapshot` | Get DOM snapshot |
| POST | `/api/tabs/:id/exec` | Execute JS |
| POST | `/api/tabs/:id/click` | Click element |
| POST | `/api/tabs/:id/type` | Type text |
| POST | `/api/tabs/:id/upload` | Upload file |
| GET | `/api/tabs/:id/console` | Get console logs |

## Tech Stack

- Electron + Svelte + TypeScript
- Turbo (Monorepo) + Vite
- pnpm

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Build
pnpm build:desktop

# Package
pnpm dist:mac   # macOS
pnpm dist:win   # Windows
pnpm dist:linux # Linux
```

## License

MIT
