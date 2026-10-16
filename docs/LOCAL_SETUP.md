# Windows 本地部署

本副本保留上游历史；`origin` 指向自己的 GitHub 仓库，`upstream` 指向原作者。模型、密钥、日志和本地运行目录不上传。

## 当前部署路线

| 层 | 组件 |
| --- | --- |
| 对话界面 | DeepSeek Harness `dsh-v0.1.3-alpha.1`，源码放在本仓库同级 `deepseek-harness` |
| 对话模型 | MiniMax，使用 Anthropic 兼容协议；模型 ID 和 endpoint 在本地 settings 中配置 |
| 中文语音识别 | `iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch` |
| 语音合成 | `Qwen/Qwen3-TTS-12Hz-1.7B-Base`，Windows CUDA 路线 |
| 语音活动检测 | Silero VAD v4 |
| 数字人口型 | DUIX Docker 服务，使用 RTX 3090；网页数字人开关控制 |
| 可选功能 | QQ 桥接未启用 |

对话模型不替代语音模型。Qwen Base 需要参考音频；部署验证可以使用公开模型所带的测试音频，自定义音色请提供自己的参考音频及逐字文本。待机动画与 DUIX 实时口型是不同功能。

## 环境与配置

Python 环境位于 `.venv`。安装 `bridge/requirements-windows.txt`，并安装匹配的 CUDA 版 torch/torchaudio（本机使用 `2.8.0+cu128`）。Windows 依赖文件固定了 Qwen 兼容版本，避免 Transformers `5.20.1` 引发的 `MimiConfig.rope_theta` 错误。更改依赖前先停止桥接，以免 Windows 锁住已加载的 DLL。不要仅凭 `pip install` 成功判断 GPU 可用。用以下命令检查：

```powershell
.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

DSH 需要 Node.js `^22.19.0 || >=24`。本地可选 Node 运行时位置为 `.local/runtime/node_modules/node/bin`，启动脚本优先使用该目录。DSH 的 `fs-ext` 原生依赖需要 Visual Studio C++ Build Tools 和 Windows SDK；安装完成后，在 DSH 目录执行 `pnpm rebuild fs-ext`。源码构建执行 `pnpm run build`。

复制 `bridge/bridge-config.example.json` 为 `bridge/bridge-config.json`，配置实际模型、素材及参考音频路径。当前桥接有多处路径相对于工作目录解析，建议使用绝对路径。VAD 的现有代码读取 `bridge/models/silero-vad/silero_vad_v4.jit`。

DSH 使用本项目独立的 `.local/dsh-home`。`settings.yaml` 中的 `llm-pi-ai.providers` 配置 `api: anthropic-messages`、`baseURL`、`apiKeyEnv: MINIMAX_API_KEY` 及 `models`；密钥放在该目录的 `.env`。不要把其他项目完整的环境文件复制过来，只使用对话接口所需的密钥。

插件运行包放在 `.local/plugin`，使用上游独立插件仓库的构建脚本，`src` 与本仓库 `dsh-plugin/src` 同步。在该目录执行 `node build.mjs`。修改本仓库插件源码后，需要重新同步并构建。通过 DSH 的 `plugin --profile web add link:<插件绝对路径>` 注册运行包。

## 启动与验证

### 陪伴角色

`presets/companion` 是小雅的聊天预设，只挂载角色提示，不挂载终端、文件和其他编码工具。运行 `powershell -NoProfile -ExecutionPolicy Bypass -File bridge/install-companion.ps1` 安装到独立 DSH home；新建会话时选择“小雅 · 陪伴聊天”，或在 settings.yaml 设置 `agent-presets.default: companion`。现有标准模式会话不会自动更换人设。模型选择 MiniMax-M3.1-Flash-Preview。

### DUIX 口型服务

本机 RTX 3090 使用上游标准镜像 `guiji2025/duix.avatar`，配置位于 `bridge/docker-compose-local.yml`。Docker Desktop 需启动并支持 NVIDIA GPU；执行 `docker compose -f bridge/docker-compose-local.yml up -d`。服务只绑定 `127.0.0.1:9000`，共享目录 `.local/duix` 映射为容器 `/code/data`。

把人物视频放在 `.local/duix/temp/my_avatar.mp4`，桥接的 `digital_human.data_dir` 使用该共享目录的绝对路径、`duix_base` 使用 `http://127.0.0.1:9000`。共享目录创建后重启桥接，让视频静态路由挂载；在网页打开数字人开关。口型按语音生成视频后播放，存在合成等待时间，不是实时视频通话。模型和生成视频不上传 GitHub。

部署方式参考 [DUIX 官方精简 Compose](https://github.com/duixcom/Duix-Avatar/blob/main/deploy/docker-compose-lite.yml)。

在本仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File bridge/start-local.ps1
```

脚本在后台启动桥接，在当前终端运行 DSH，输出 DSH 登录地址；关闭 DSH 请在该终端按 Ctrl+C。仅启动桥接时加 `-BridgeOnly`。桥接接口文档位于 `http://127.0.0.1:8765/docs`；日志位于 `.local` 和 `bridge/logs`。

```powershell
# 检查 HTTP 服务、素材、音色列表和数字人状态
.venv\Scripts\python.exe bridge/verify-local.py

# 实际语音识别和合成；首次调用需要加载模型
.venv\Scripts\python.exe bridge/verify-local.py --audio models/funasr/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/example/asr_example.wav --text "你好，本地语音测试。" --output tts_out.wav
```

`/api/health` 返回 `status: ok` 只表示 HTTP 服务运行。必须分别完成真实 STT、TTS 请求与浏览器对话，才能判断整条链路通过；麦克风及扬声器还需要在用户浏览器中实际试听确认。

## 本机验证记录（2026-10-16）

### 常见故障与功能边界

- 麦克风显示“未检测到麦克风”对应浏览器 `NotFoundError`。先在 Windows 设置 → 系统 → 声音 → 输入中确认存在可用麦克风，再允许网站访问；播放设备和立体声混音不能替代实际麦克风。
- 含 emoji 的回复曾导致 Windows GBK 标准输出抛出异常并中断 TTS；桥接现为 Windows 标准输出/错误流配置 UTF-8，已用含 emoji 语句实际合成验证。
- 待机动画是循环播放预录视频，不会按聊天文本做指定动作；说话口型由 DUIX 服务生成，需在网页打开数字人开关。
- DSH 标准模式是编码助手；陪伴聊天请选择本项目的“小雅 · 陪伴聊天”预设。
- 新浏览器没有 DSH 登录状态时，需要打开启动终端打印的带 token 地址，不能只打开裸地址。

- Windows、Python 3.11.15、Node.js 22.22.0、RTX 3090；CUDA torch/torchaudio 2.8.0+cu128，Python 依赖一致性检查通过。
- DSH 构建通过，网页使用 MiniMax-M3.1-Flash-Preview 完成真实对话。
- FunASR GPU 识别公开测试音频通过，Silero WebSocket 返回 speech_start / speech_end。
- Qwen3-TTS 合成“你好，本地语音测试。”，再送回 STT，识别为“你好本地语音测试”。
- 网页回复“你好，语音功能已经准备好了。”触发 `/api/tts`，返回 HTTP 200、2.78 秒 WAV，完成网页到本地合成的联动。
- 待机动画可见；当前音色使用公开测试音频作为参考，QQ 推送未启用。麦克风尚未接入，采集需设备就绪后验证。
- DUIX 容器识别 RTX 3090，网页回复生成 1024×1024 H.264 + AAC 视频，浏览器播放器成功加载并播放到结尾；画面检查可见生成的说话口型。
- 陪伴预设完成 MiniMax 真实对话验证，没有调用编码工具。已修复新会话首条回复被误判为历史而跳过朗读的问题；新会话首句朗读成功，刷新不重播。
- 本地 DUIX 请求不继承环境代理，避免本机代理将回环请求转发后返回 502。
