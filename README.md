# Grok2API-rs

> This project is based on [grok2api](https://github.com/chenyme/grok2api) refactored in Rust.

> [!NOTE]
> For learning and research purposes only. Please comply with Grok's Terms of Service and local laws and regulations.

## Overview

`Grok2API-rs` is a Rust implementation of a Grok to OpenAI-compatible API gateway, featuring an admin dashboard (Token management, Configuration, Cache, Downstream controls, Dialog debugging).

- Backend: Rust + Axum
- Deployment: Single binary / Docker
- Upstream requests: Uses built-in `wreq` (no external `curl-impersonate` dependency)
- Endpoints: `/v1/chat/completions`, `/v1/responses`, `/v1/images/generations`, `/v1/images/generations/nsfw`, etc.

System homepage screenshot:  
![System homepage screenshot](docs/images/1image.png)

## v0.2.0 Updates

- NSFW link chain stability fix (including failure fallback and error details).
- New admin dashboard "Dialog" page (supports Chat / Responses / Images / Images NSFW).
- Dialog page supports SSE streaming, Markdown rendering, image display (URL/Base64).
- New "Downstream Management" page for toggling exposed downstream APIs per endpoint.
- Docker deployment solution and GHCR auto-publish workflow.

Downstream management screenshot:  
![Downstream management screenshot](docs/images/2image.png)

## Downstream Endpoints

| Endpoint            | Path                          | Config Toggle                          |
|---------------------|-------------------------------|----------------------------------------|
| Chat Completions    | `/v1/chat/completions`        | `downstream.enable_chat_completions`   |
| Responses API       | `/v1/responses`               | `downstream.enable_responses`          |
| Images Generations  | `/v1/images/generations`      | `downstream.enable_images`             |
| Images NSFW         | `/v1/images/generations/nsfw` | `downstream.enable_images_nsfw`        |
| Models              | `/v1/models`                  | `downstream.enable_models`             |
| Files               | `/v1/files`                   | `downstream.enable_files`              |

Admin dashboard: `/admin` (Token Management / Configuration / Cache / Downstream / Dialog).

## Deployment

### 1) Single Binary Deployment

```bash
# Assuming grok2api-rs and config.defaults.toml are in the current directory
mkdir -p data
cp config.defaults.toml data/config.toml
cp /path/to/token.json data/token.json

chmod +x ./grok2api-rs
SERVER_HOST=0.0.0.0 SERVER_PORT=8000 ./grok2api-rs
```

Directory structure:

```text
grok2api-rs/
├─ grok2api-rs
└─ data/
   ├─ config.toml
   └─ token.json
```

System deployment screenshot:  
![System deployment screenshot](docs/images/7image.png)

### 2) Docker Quick Deployment (Recommended)

```bash
git clone https://github.com/XeanYu/grok2api-rs.git
cd grok2api-rs

mkdir -p data
cp config.defaults.toml data/config.toml
cp data/token.json.example data/token.json

# You can skip copying token.json manually; the container will auto-create {"ssoBasic": []} on first start
docker compose pull
docker compose up -d
docker compose logs -f
```

Then open the admin dashboard to import tokens:

- `http://127.0.0.1:8000/admin`
- Go to "Token Management" to import/paste `ssoBasic`

Build and run local image:

```bash
docker build -t grok2api-rs:local .
IMAGE=grok2api-rs:local docker compose up -d
```

### 3) Upgrade Using Latest Image

```bash
docker pull ghcr.io/xeanyu/grok2api-rs:latest
```
```bash
docker run -d \
  --name grok2api \
  -p 8000:8000 \
  ghcr.io/xeanyu/grok2api-rs:latest
```

### 4) GitHub Actions Auto-Publish

The repository includes `.github/workflows/docker-publish.yml`:

- Push to `main`: publishes `ghcr.io/xeanyu/grok2api-rs:latest`
- Push tag (e.g., `v0.2.0`): publishes `ghcr.io/xeanyu/grok2api-rs:v0.2.0` with matching tag
- Multi-architecture: `linux/amd64` + `linux/arm64`

## Building

```bash
# Local release build
cargo build --release

# Linux x86_64 musl static build (requires cargo-zigbuild + zig)
cargo zigbuild --release --target x86_64-unknown-linux-musl
```

## Configuration

Copy `config.defaults.toml` to `data/config.toml` and adjust as needed.

Full example:

```toml
[grok]
temporary = true
stream = true
thinking = true
dynamic_statsig = true
filter_tags = ["xaiartifact","xai:tool_usage_card","grok:render"]
timeout = 120
base_proxy_url = ""
asset_proxy_url = ""
cf_clearance = ""
wreq_emulation = "chrome_136"
wreq_emulation_usage = ""
wreq_emulation_nsfw = ""
max_retry = 3
retry_status_codes = [401,429,403]
imagine_default_image_count = 4
imagine_sso_daily_limit = 10
imagine_blocked_retry = 3
imagine_max_retries = 5

[app]
app_url = "http://127.0.0.1:8000"
app_key = "grok2api"
api_key = ""
image_format = "url"
video_format = "url"

[token]
auto_refresh = true
refresh_interval_hours = 8
fail_threshold = 5
save_delay_ms = 500
reload_interval_sec = 30

[cache]
enable_auto_clean = true
limit_mb = 1024

[performance]
assets_max_concurrent = 25
media_max_concurrent = 50
usage_max_concurrent = 25
assets_delete_batch_size = 10
assets_batch_size = 10
assets_max_tokens = 1000
usage_batch_size = 50
usage_max_tokens = 1000
nsfw_max_concurrent = 10
nsfw_batch_size = 50
nsfw_max_tokens = 1000

[downstream]
enable_chat_completions = true
enable_responses = true
enable_images = true
enable_images_nsfw = true
enable_models = true
enable_files = true
```

Key configuration options:

- `app.api_key`: Bearer Token for downstream calls (empty means no authentication).
- `app.app_key`: Admin dashboard login password.
- `app.image_format`: Default image return format (`url` / `base64`). If request includes `response_format`, the request parameter takes precedence.
- `grok.wreq_emulation*`: Upstream browser fingerprint template, can be configured globally or separately for Usage/NSFW.
- `grok.base_proxy_url` / `grok.asset_proxy_url`: Optional proxy addresses.

## curl Examples

### Chat Completions

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-4",
    "messages": [{"role":"user","content":"Hello"}]
  }'
```

### Responses API (Text)

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-4",
    "input": "Hello"
  }'
```

Responses text Q&A screenshot:  
![Responses text Q&A screenshot](docs/images/3image.png)

### Responses API (Image Generation)

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-imagine-1.0",
    "input": [
      {"type":"input_text","text":"Draw a cat floating in space"}
    ]
  }'
```

Responses image generation screenshot:  
![Responses image generation screenshot](docs/images/4image.png)

### NSFW Image Generation

```bash
curl http://127.0.0.1:8000/v1/images/generations/nsfw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-imagine-1.0",
    "prompt": "Create a nightclub-style portrait poster",
    "n": 1,
    "response_format": "url"
  }'
```

### Get Model List

```bash
curl http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

Available models list screenshot:  
![Available models list screenshot](docs/images/5image.png)

sub2api model call screenshot:  
<img src="docs/images/6image.png" alt="sub2api model call screenshot" width="50%">

## Differences from Original Project

### Added

- `/v1/responses` (OpenAI Responses API compatible)
- `/v1/images/generations/nsfw` (NSFW-specific image generation)
- Admin dashboard with "Downstream Management" and "Dialog" pages
- Dialog page supports SSE, Markdown, and mixed text/image display
- Unified `wreq` upstream chain (no external `curl-impersonate` dependency)
- Docker deployment and GHCR auto-publish workflow

### Not Yet Implemented

- Currently only supports local storage (`SERVER_STORAGE_TYPE` other values will fallback)
- No multi-node/distributed deployment capability yet (currently single-instance focused)
