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
| 可选功能 | DUIX 数字人口型、QQ 桥接；默认关闭，需另行部署 |

对话模型不替代语音模型。Qwen Base 需要参考音频；部署验证可以使用公开模型所带的测试音频，自定义音色请提供自己的参考音频及逐字文本。待机动画与 DUIX 实时口型是不同功能。

## 环境与配置

Python 环境位于 `.venv`。先安装 `bridge/requirements.txt`，再安装匹配的 CUDA 版 torch/torchaudio；不要仅凭 `pip install` 成功判断 GPU 可用。用以下命令检查：

```powershell
.venv\Scripts\python.exe -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

DSH 需要 Node.js `^22.19.0 || >=24`。本地可选 Node 运行时位置为 `.local/runtime/node_modules/node/bin`，启动脚本优先使用该目录。DSH 的 `fs-ext` 原生依赖需要 Visual Studio C++ Build Tools 和 Windows SDK；安装完成后，在 DSH 目录执行 `pnpm rebuild fs-ext`。源码构建执行 `pnpm run build`。

复制 `bridge/bridge-config.example.json` 为 `bridge/bridge-config.json`，配置实际模型、素材及参考音频路径。当前桥接有多处路径相对于工作目录解析，建议使用绝对路径。VAD 的现有代码读取 `bridge/models/silero-vad/silero_vad_v4.jit`。

DSH 使用本项目独立的 `.local/dsh-home`。`settings.yaml` 中的 `llm-pi-ai.providers` 配置 `api: anthropic-messages`、`baseURL`、`apiKeyEnv: MINIMAX_API_KEY` 及 `models`；密钥放在该目录的 `.env`。不要把其他项目完整的环境文件复制过来，只使用对话接口所需的密钥。

插件运行包放在 `.local/plugin`，使用上游独立插件仓库的构建脚本，`src` 与本仓库 `dsh-plugin/src` 同步。在该目录执行 `node build.mjs`。修改本仓库插件源码后，需要重新同步并构建。通过 DSH 的 `plugin --profile web add link:<插件绝对路径>` 注册运行包。

## 启动与验证

在本仓库根目录执行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File bridge/start-local.ps1
```

脚本在后台启动桥接，在当前终端运行 DSH，输出 DSH 登录地址；关闭 DSH 请在该终端按 Ctrl+C。仅启动桥接时加 `-BridgeOnly`。桥接接口文档位于 `http://127.0.0.1:8765/docs`；日志位于 `.local` 和 `bridge/logs`。

```powershell
# 检查 HTTP 服务、素材、音色列表和数字人状态
.venv\Scripts\python.exe bridge/verify-local.py

# 实际语音识别和合成；首次调用需要加载模型
.venv\Scripts\python.exe bridge/verify-local.py --audio models/funasr/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch/asr_example.wav --text "你好，本地语音测试。" --output tts_out.wav
```

`/api/health` 返回 `status: ok` 只表示 HTTP 服务运行。必须分别完成真实 STT、TTS 请求与浏览器对话，才能判断整条链路通过；麦克风及扬声器还需要在用户浏览器中实际试听确认。
