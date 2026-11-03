# fit-tts · 克隆女声播报代理

把 rcj-voice 里那位女声（清唱）克隆出来，给 `fit.955827.xyz` 做**全部播报**的嗓音：动作要领、注意事项、倒计时提示、收尾夸奖，都用她的音色念。

## 原理

- `fit-coach` 每次要播报一句，先打 `fit.955827.xyz/api/tts?t=<文案>&l=<en|zh>&tone=<cue>`。
- 本 Worker 代理 ElevenLabs，**API key 只在服务端**，客户端永远看不到。
- 渲染出的 mp3 在 KV 缓存，重复文案零配额消耗。
- `fit-coach` 把成功音频存进浏览器 CacheStorage，**首次之后同一句秒出、且断网也能用**。
- **Web Speech 永远兜底**：Worker 没部署 / 断网 / 接口报错 → 自动回退原来的台妹系统嗓音，零回归。
- `fit-coach` 启动时自动 ping 一次 `/api/tts`，Worker 一上线就自动启用克隆嗓，不用改代码。

## 克隆嗓音（一次性）

```bash
cd fit-tts
export ELEVEN_API_KEY=你的key        # https://elevenlabs.io → Profile → API Key
node clone.mjs                        # 用 rcj-voice 的清唱源（优先《我的未来不是梦》《掌声响起来》长版）克隆
# 输出 VOICE_ID=xxxx
```

`clone.mjs` 默认喂 7 首同声清唱（含你点名的两首长版），约 15–20 分钟干净人声，足够 Professional 级克隆。

## 部署 Worker

```bash
wrangler secret put ELEVEN_API_KEY    # 粘贴同一个 key
# 编辑 wrangler.toml：VOICE_ID 改成 clone.mjs 输出的 id；TTS_CACHE 的 id 改成 `wrangler kv namespace create fittts_cache` 得到的 id
wrangler deploy
```

部署后在 Cloudflare 控制台把 Worker 挂到域名路径：
**Workers → fit-tts → Triggers → Add route → `fit.955827.xyz/api/*`**
（或取消 wrangler.toml 里 `routes` 的注释再 deploy 一次）

## 费用

- ElevenLabs 克隆 + 多语 TTS 需要 **Starter $5/月**（免费档不含克隆）。
- 每句文案只在首次渲染时调一次 API，之后 KV + 浏览器双缓存，日常使用近乎零成本。
- 想完全免费可改用 **OpenVoice**（自托管，支持中英），把 `src/index.js` 里的 ElevenLabs 调用换成你的 OpenVoice 端点即可，客户端无需改动。

## 已知取舍

- 源是**唱歌**不是说话，克隆出的嗓音念白会带一点「唱腔」，不是纯播音腔——这是用唱歌抽干声克隆的固有代价，已与用户确认接受。
- 中文走 ElevenLabs 多语模型（`eleven_multilingual_v2`），是标准普通话女声，不是台语/闽南语；「台妹」气质靠语调参数近似。
- 3-2-1 倒数蜂鸣保持原样（清脆不抢戏），克隆嗓负责「10 秒提醒 / 准备 / 各动作口令 / 收尾」等**说**的部分。
