/**
 * clone.mjs — clone the rcj-voice female singer into an ElevenLabs voice.
 *
 * Usage:
 *   ELEVEN_API_KEY=xxxxx node clone.mjs
 *
 * Prints VOICE_ID. Then set it in wrangler.toml (VOICE_ID) and run
 * `wrangler secret put ELEVEN_API_KEY`, then `wrangler deploy`.
 *
 * Sources are the confirmed same-voice a-cappella tracks the user picked
 * (《我的未来不是梦》+《掌声响起来》, incl. the long "（二）" takes). The
 * #t=0,60 fragment is stripped so we feed full-length audio to the cloner.
 */

const KEY = process.env.ELEVEN_API_KEY;
if (!KEY) {
  console.error("ERROR: set ELEVEN_API_KEY first (export ELEVEN_API_KEY=xxxxx)");
  process.exit(1);
}

// priority same-voice a-cappella sources (full files, fragment stripped)
const SRC = [
  "https://cdn.955827.xyz/music/wodeweilaibushimeng.m4a", // 我的未来不是梦
  "https://cdn.955827.xyz/music/zhangshengxiangqilai.m4a", // 掌声响起来
  "https://cdn.955827.xyz/music/wodeweilaibushimeng-2.m4a", // 我的未来不是梦（二）long
  "https://cdn.955827.xyz/music/zhangshengxiangqilai-2.m4a", // 掌声响起来（二）long
  "https://cdn.955827.xyz/music/fenshenqingren.m4a", // 分身情人
  "https://cdn.955827.xyz/music/hongdou.m4a", // 红豆
  "https://cdn.955827.xyz/music/nuannuan.m4a", // 暖暖
];

const form = new FormData();
form.append("name", "FitCoach-Voice");
form.append("description", "Cloned from rcj-voice a-cappella (same female singer) for fit.955827.xyz guided workouts.");
let added = 0;
for (const u of SRC) {
  try {
    const r = await fetch(u);
    if (!r.ok) {
      console.warn("skip (http " + r.status + "): " + u);
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    // ElevenLabs accepts audio/m4a; name it .m4a
    form.append("files", new Blob([buf], { type: "audio/m4a" }), u.split("/").pop());
    added++;
    console.log("added " + u.split("/").pop() + " (" + (buf.length / 1024 / 1024).toFixed(1) + " MB)");
  } catch (e) {
    console.warn("skip (err): " + u + " -> " + e.message);
  }
}

if (!added) {
  console.error("no source audio downloaded; check network / cdn URLs");
  process.exit(1);
}

console.log("Uploading " + added + " file(s) to ElevenLabs…");
const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
  method: "POST",
  headers: { "xi-api-key": KEY },
  body: form,
});

const j = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("clone failed (" + res.status + "): " + JSON.stringify(j).slice(0, 300));
  process.exit(1);
}

console.log("");
console.log("VOICE_ID=" + j.voice_id);
console.log("");
console.log("Next steps:");
console.log("  1. set VOICE_ID=" + j.voice_id + " in fit-tts/wrangler.toml");
console.log("  2. wrangler secret put ELEVEN_API_KEY   (paste the same key)");
console.log("  3. wrangler deploy");
console.log("  4. Cloudflare Dashboard → Workers → fit-tts → Triggers → Add route fit.955827.xyz/api/*");
console.log("  fit.955827.xyz will auto-detect /api/tts and switch narration to the cloned voice.");
