# Grok2API-rs

> 本项目基于 [grok2api](https://github.com/chenyme/grok2api) 重构。

> [!NOTE]
> 本项目仅供学习与研究，使用者必须在遵循 Grok 的 **使用条款** 以及 **法律法规** 的情况下使用，不得用于非法用途。

## 1. 后端重构说明

- 使用 Rust + Axum 重写服务端，保持 OpenAI 兼容接口与管理后台能力。
- 静态资源内置到二进制，支持单个二进制文件部署。
- 上游 Grok 请求统一走内置 `wreq` 浏览器指纹请求链路，无需外部二进制。
- 配置加载合并默认值，支持后台在线修改并持久化。

系统首页截图：  
![系统首页截图](docs/images/1image.png)

## 2. 安装步骤

- 配置文件给出完整的标准配置文件，并配有说明
  - 将 `config.defaults.toml` 复制为 `data/config.toml`，并按需修改。
  - 标准配置示例（含说明）：

```toml
[app]
# 调用 API 的 Bearer Token；为空则不校验
api_key = ""
# 后台登录密码
app_key = "grok2api"
# 对外访问地址（用于文件链接）
app_url = "http://127.0.0.1:8000"
# 图片返回格式：url / base64
image_format = "url"
# 视频返回格式：url
video_format = "url"

[grok]
# 临时对话模式
temporary = true
# 默认流式输出
stream = true
# 思维链输出
thinking = true
# 动态 Statsig 指纹
dynamic_statsig = true
# 过滤标签
filter_tags = ["xaiartifact","xai:tool_usage_card","grok:render"]
# 请求超时（秒）
timeout = 120
# Grok 基础代理地址（可留空）
base_proxy_url = ""
# 资源代理地址（可留空）
asset_proxy_url = ""
# Cloudflare 验证 Cookie（可留空）
cf_clearance = ""
# wreq 浏览器指纹模板（例如 chrome_136 / edge_136 / firefox_136）
wreq_emulation = "chrome_136"
# Usage（/rest/rate-limits）专用指纹，留空则跟随 wreq_emulation
wreq_emulation_usage = ""
# NSFW 开启接口专用指纹，留空则跟随 wreq_emulation
wreq_emulation_nsfw = ""
# 最大重试次数
max_retry = 3
# 触发重试的状态码
retry_status_codes = [401,429,403]

[token]
# 自动刷新 Token
auto_refresh = true
# 刷新间隔（小时）
refresh_interval_hours = 8
# 失败阈值
fail_threshold = 5
# 保存延迟（毫秒）
save_delay_ms = 500
# 多进程一致性刷新间隔（秒）
reload_interval_sec = 30

[cache]
# 自动清理缓存
enable_auto_clean = true
# 缓存上限（MB）
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
# 下游接口开关
enable_chat_completions = true
enable_responses = true
enable_images = true
enable_images_nsfw = true
enable_models = true
enable_files = true
```

> Grok Token 号池存储于 `data/token.json`。

### 单文件部署参考目录结构

```
/grok2api-rs
├─ grok2api-rs
└─ data
   ├─ config.toml
   └─ token.json
```

### 二进制文件部署教程（命令行）

```bash
# 1) 准备目录
mkdir -p grok2api-rs/data

# 2) 配置文件
cp config.defaults.toml grok2api-rs/data/config.toml

# 3) Token 号池
cp /path/to/token.json grok2api-rs/data/token.json

# 4) 启动服务
chmod +x grok2api-rs/grok2api-rs
SERVER_HOST=0.0.0.0 SERVER_PORT=8000 ./grok2api-rs/grok2api-rs
```

系统部署执行截图：  
![系统部署执行截图](docs/images/7image.png)

### Docker 快捷部署（推荐）

```bash
# 1) 拉取项目
git clone https://github.com/XeanYu/grok2api-rs.git
cd grok2api-rs

# 2) 准备数据目录
mkdir -p data
cp config.defaults.toml data/config.toml

# 3) 准备 token 池（至少放 1 个可用 ssoBasic）
cat > data/token.json <<'JSON'
{
  "ssoBasic": []
}
JSON

# 4) 启动（默认拉取 GHCR 最新镜像）
docker compose pull
docker compose up -d

# 5) 查看日志
docker compose logs -f
```

如果你想本地构建镜像再运行：

```bash
docker build -t grok2api-rs:local .
IMAGE=grok2api-rs:local docker compose up -d
```

> 默认管理端地址：`http://127.0.0.1:8000/admin`，默认后台密码在 `data/config.toml` 的 `app.app_key`。

### GitHub 自动发布 Docker 镜像

仓库已提供 `.github/workflows/docker-publish.yml`：

- 推送到 `main`：自动发布 `ghcr.io/<owner>/grok2api-rs:latest`
- 推送标签（如 `v1.0.0`）：自动发布同名 tag 镜像
- 同时构建 `linux/amd64` 与 `linux/arm64`

### 项目编译教程（命令行）

```bash
# 常规 release 构建
cargo build --release

# 静态 musl 构建（需要 cargo-zigbuild 和 zig）
cargo zigbuild --release --target x86_64-unknown-linux-musl
```

### curl 调用示例

Chat Completions：

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-4",
    "messages": [{"role":"user","content":"你好"}]
  }'
```

Responses API：

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-4",
    "input": "你好"
  }'
```

Responses 调用 grok-4 文本问答截图：  
![Responses 文本问答截图](docs/images/3image.png)

Responses 图片生成：

```bash
curl http://127.0.0.1:8000/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-imagine-1.0",
    "input": [
      {"type":"input_text","text":"画一只在太空漂浮的猫"}
    ]
  }'
```

Responses 调用生图截图：  
![Responses 生图截图](docs/images/4image.png)

NSFW 专用图片生成（会先尝试为该 Token 开启 NSFW）：

```bash
curl http://127.0.0.1:8000/v1/images/generations/nsfw \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "grok-imagine-1.0",
    "prompt": "绘制一张夜店风格的人像海报",
    "n": 1
  }'
```

获取可用模型：

```bash
curl http://127.0.0.1:8000/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"
```

获取可用模型列表截图：  
![可用模型列表截图](docs/images/5image.png)

sub2api 调用模型截图：  
<img src="docs/images/6image.png" alt="sub2api 调用模型截图" width="50%">

## 3. 与原项目相比缺失的内容

- 仅支持本地存储（`SERVER_STORAGE_TYPE` 其他值会降级并提示）。
- 暂未提供多节点/分布式部署能力（当前以单实例部署为主）。

## 4. 与原项目相比新增的内容

- 新增 `/v1/responses`（OpenAI Responses API 兼容）。
- 新增 `/v1/images/generations/nsfw`（NSFW 专用图片生成接口）。
- 新增“下游管理”页面，支持下游接口开关。  
  ![下游管理截图](docs/images/2image.png)
- 静态资源内置，支持单文件二进制部署。
- 上游 Grok 请求统一走 `wreq` 浏览器指纹链路（无需外部二进制）。
- 新增 Docker 部署方案与 GHCR 自动构建发布工作流。
