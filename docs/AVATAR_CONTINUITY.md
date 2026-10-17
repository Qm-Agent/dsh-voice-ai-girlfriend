# 数字人连贯性

选择数字人后，待机与口播共用其 DUIX 模板的构图。音频不等待动作播放完成；口播首帧解码后才移走待机层，口播结束时保留末帧，待机按口播时间对应到源视频姿势再接回。切换角色会清理旧的动作素材和缓存。

月白额外提供对话动作库：明确动作请求、问候或感谢才触发动作；没有定时随机拨头发/卖萌。动作通常在口播结束后的停顿处播放，使用同一待机画面的入场与收尾过渡。其他角色仅改善待机/口播衔接，不借用月白动作。素材配置与限制见 [动作库说明](../assets/actions/README.md)。

## 本地验证

- `node --experimental-strip-types --test desktop/action-policy.test.cjs`
- 在 bridge 目录运行 `../.venv/Scripts/python.exe -m unittest test_dh_audio_minimum`
- 启动本地服务后运行 `desktop/node_modules/electron/dist/electron.exe desktop --all-avatar-continuity-test`

桌面集成验证会逐个切换当前配置中的形象、合成并播放测试语音，检查首帧覆盖、实际播放结束和待机姿势恢复，最后恢复原形象。结果写入 `.local/desktop/all-avatar-continuity-test.json`，逐帧记录保存在同目录。该测试会发出声音，仅在主动运行此参数时执行。

当前验证覆盖 `amber_fox`、`cyber_iris`、`moon_bai`、`my_avatar` 及两个快速版本。人物素材、模型配置与生成产物仍使用本机路径，不上传密钥或个人配置。已有素材仍可能在大幅姿态变化处显出短暂融合痕迹，此修改不宣称生成了连续的身体运动或原生高清横屏视频。
