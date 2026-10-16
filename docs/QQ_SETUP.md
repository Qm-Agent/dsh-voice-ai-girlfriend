# QQ 双向文字与语音

本分支使用独立 NapCat Docker 容器，不调用旧版 `start-napcat.cmd`，不关闭 Windows QQ。镜像固定摘要，WebUI / OneBot 仅绑定 127.0.0.1。用户登录机器人小号，另一个 QQ 作为唯一测试收件人；两号需能够互发私聊消息。

## 本机准备与登录

1. `.venv/Scripts/python.exe bridge/setup-qq.py`：生成随机 WebUI / OneBot token，保存在被 Git 忽略的 `.local/napcat/config` 与本地桥接配置中。重复运行保留 token。
2. `docker compose -f bridge/docker-compose-qq.yml up -d`。
3. 从 NapCat WebUI `http://127.0.0.1:6099/webui` 自行扫码登录机器人 QQ；WebUI token 位于本机 `.local/napcat/config/webui.json`。二维码也可通过 `docker cp dsh-napcat:/app/napcat/cache/qrcode.png .local/napcat-login.png` 获取，过期需更新。
4. 确认两个 QQ 号后运行 `.venv/Scripts/python.exe bridge/configure-qq.py --bot-qq <机器人号> --target-qq <测试收件人>`。
5. 重启 `dsh-napcat` 和本项目 voice bridge，使账号配置生效；桌面应用重新启动、旧浏览器刷新。
6. 打开“小雅 · 陪伴聊天”会话，保持 QQ 联动开关开启。桌面隐藏到托盘仍可处理 QQ；完全退出桌面和所有聊天网页则无法调用 DSH 会话。

读状态：`.venv/Scripts/python.exe bridge/verify-qq.py`，该命令不会发送消息。登录号匹配、OneBot 连接、会话连接均正常后再开始真实测试。

## 实现与边界

- OneBot 正向 WebSocket → 收件人白名单 / 自发消息过滤 / message_id 去重 → 有界队列 → 当前陪伴会话 → 关联请求的回复。
- 仅 QQ 发起的请求回复到 QQ，不将网页历史或普通桌面聊天自动推送出去。桌面连接优先；现有会话不会被新网页反复抢占。
- 语音输入：NapCat `get_record` 转 WAV，以 base64 返回 → 本地 FunASR → 同一聊天链路。单条限制 60 秒。
- 语音输出：本地 TTS → SILK → base64 发送，避免 Windows 临时路径不能被 Docker 读取的问题；先发送文字，再发送语音。
- 暂不处理群聊、图片理解、好友自动通过。无连接最多等 120 秒，模型回复最多等 180 秒；失败记录在 `/api/qq/status`，不无限重发。
- 当前桌面切换到其他会话会重连 QQ；测试期间请留在陪伴会话。模型服务、NapCat、语音桥接需要持续运行。

## 测试

本地回归 `.venv/Scripts/python.exe bridge/test_qq.py`：7 项测试覆盖白名单、数组/CQ 消息、语音转换、跨 Docker 发语音、事件去重、文字+语音回复和 STT 调用。使用模拟 OneBot，不向真实 QQ 发消息。

真实验收（必须登录并确认测试 QQ）：
- 测试 QQ 发一条带唯一标记的文字给机器人，确认收到一条文字回复和一条可播放语音。
- 测试 QQ 用手机发一条简短语音，确认识别内容正确并收到文字+语音回复。
- 刷新网页或同时打开桌面与网页，确认不会回推历史、重复回复。

2026-10-17：容器与私有配置已准备，本地 7 项回归通过；真实 QQ 双向收发尚待用户扫码和确认两个 QQ 号，不能以模拟测试代替实测。
