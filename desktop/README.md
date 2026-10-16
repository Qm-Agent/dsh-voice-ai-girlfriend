# 小雅桌面陪伴窗

复用本机 DSH（3080）和 voice bridge（8765），不新增模型配置、不另存聊天记录。首次启动自动读取本机 `.local/dsh.stdout.log` 的登录地址；登录存储与浏览器隔离，凭据仅保存在被 Git 忽略的 `.local/desktop`。仅连接回环地址，远端页面不开放 Node.js 或桌面 IPC 权限。

## 使用

当前机器双击 `desktop/start-desktop.cmd`。现有服务需要先启动；若未启动，运行 `bridge/start-local.ps1`。首次安装：在 desktop 目录运行 `npm ci`（需要 Node 22.12+，会下载锁定版本 Electron）。

- **陪伴**：独立角色窗口，原生标题栏可拖动，窗口边缘可缩放。
- **聊天**：切回现有 DSH 会话；首次可新建“小雅 · 陪伴聊天”会话或选择已有会话。
- **置顶**：顶部按钮或托盘菜单切换。
- **收起 / 关闭窗口**：隐藏到系统托盘，不退出服务。
- **Ctrl+Alt+Space**：从任意应用呼出聊天并聚焦输入框。若被其他程序占用，从托盘双击打开。
- **托盘右键 → 退出桌面陪伴**：退出桌面程序，已有 DSH、语音、Docker 服务仍运行。

分别记忆陪伴、聊天窗口的尺寸和位置，屏幕变化时把窗口限制在可见区域。窗口显示时桌面优先发声；隐藏后浏览器可接管，异常退出后最多 6 秒恢复。打开着的旧网页需刷新一次以加载协调逻辑。没有物理麦克风时可直接打字；待机视频和数字人口型继续复用已有服务。

## 验证

`powershell -NoProfile -ExecutionPolicy Bypass -File desktop/start-desktop.ps1 -SelfTest`

需先退出正在运行的桌面实例。验证结果写入 `.local/desktop/self-test.json`；覆盖置顶、尺寸变化、关闭隐藏、恢复、视图切换、快捷键注册，以及 DSH 输入框和角色视频组件加载。快捷键实际按键、发送消息和播放仍应在真实桌面中验证。

桥接与租约回归：`.venv/Scripts/python.exe bridge/test_dh_pipeline.py`。

这是源码运行版，尚未制作签名安装包；不包含透明桌宠走动、Live2D 动作或主动提醒。

## QQ 与直播扩展

QQ 已有双向实现：NapCat / OneBot v11 → bridge WebSocket → 当前 DSH 会话 → 模型回复 → 文本 / TTS 语音回推；另有图片发送接口。需要配置本机 NapCat、登录机器人 QQ、目标 QQ 和本地 token，然后启用 `bridge-config.json` 的 qq 配置。部署与双向语音测试见 [QQ_SETUP.md](../docs/QQ_SETUP.md)；未确认账号前保持关闭，不会发送 QQ 消息。原仓库的 `start-napcat.cmd` 含作者机器路径且会关闭 QQ，不能直接用于本机。

抖音尚未接入。官方直播互动工具可提供评论、点赞、礼物等事件，需完成相应应用接入、审核和主播授权；这不是一个任意直播间 URL 就能使用的公共弹幕接口。

后续链路可复用为：官方弹幕事件 → 去重、限流、内容筛选、回答队列 → MiniMax → TTS / DUIX → 直播伴侣画面与声音。高频弹幕需合并/挑选，避免每条都触发生成；当前 DUIX 仍为分段视频生成，不能保证实时秒回。

官方参考：
- https://partner.open-douyin.com/docs/resource/zh-CN/live-interactive-tools/introduction/interactive-tools-guide
- https://developer.open-douyin.com/docs/resource/zh-CN/live-interactive-tools/development/tutorial/live-tool-guide

## 本机验证记录（2026-10-16）

- 桌面原生状态自检与 3 项桥接回归通过，输入框、4 个角色视频元素加载正常。
- 实际按 Ctrl+Alt+Space 呼出聊天并打字发送；MiniMax 回复“桌面陪伴已经准备好了”。
- DUIX 生成 1.952 秒音画视频，桌面播放器 currentTime 到达 duration，ended=true，error=null；并记录了播放过程中的帧。
- 测试期间 Docker 的 WSL 内部网络失联，重启 Docker Desktop 并恢复原 DUIX 容器后验证通过。
- 麦克风实录仍待物理设备；本次验证使用打字输入。
