/**
 * fit-tts — Cloudflare Worker that proxies ElevenLabs text-to-speech for fit.955827.xyz
 *
 * Route: fit.955827.xyz/api/tts?t=<text>&l=<en|zh>&tone=<cue|go|calm|cheer>
 * - Hides the ElevenLabs API key (env secret)
 * - Maps tone -> voice_settings for a more natural workout cadence
 * - Caches rendered audio in KV so repeated phrases cost nothing
 * - Returns audio/mpeg; any misconfig returns a non-audio status so the client
 *   falls back to its built-in Web Speech voice.
 */

function voiceSettings(tone) {
  // calmer for rest/notes, brighter for go, warmer/brighter for cheer
  if (tone === "go") return { stability: 0.35, similarity_boost: 0.75, use_speaker_boost: true };
  if (tone === "cheer") return { stability: 0.25, similarity_boost: 0.8, use_speaker_boost: true };
  if (tone === "calm") return { stability: 0.6, similarity_boost: 0.65, use_speaker_boost: true };
  return { stability: 0.5, similarity_boost: 0.7, use_speaker_boost: true };
}

function audioResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/tts") {
      return new Response("fit-tts: use /api/tts?t=<text>&l=<en|zh>&tone=<cue>", { status: 404 });
    }

    const text = (url.searchParams.get("t") || "").trim();
    const lang = url.searchParams.get("l") || "en";
    const tone = url.searchParams.get("tone") || "cue";
    if (!text) return new Response("missing t", { status: 400 });
    if (text.length > 400) return new Response("too long", { status: 413 });

    const voiceId = env.VOICE_ID;
    if (!voiceId || voiceId === "REPLACE_ME") {
      return new Response("voice not configured", { status: 503 });
    }

    const cacheKey = lang + "|" + tone + "|" + text;
    if (env.TTS_CACHE) {
      try {
        const hit = await env.TTS_CACHE.get(cacheKey, { type: "arrayBuffer" });
        if (hit) return audioResponse(hit);
      } catch (e) {}
    }

    const elUrl =
      "https://api.elevenlabs.io/v1/text-to-speech/" +
      encodeURIComponent(voiceId) +
      "?output_format=mp3_44100_128";

    let r;
    try {
      r = await fetch(elUrl, {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVEN_API_KEY,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: voiceSettings(tone),
        }),
      });
    } catch (e) {
      return new Response("upstream error", { status: 502 });
    }

    if (!r.ok) {
      const msg = await r.text().catch(() => "");
      return new Response("tts " + r.status + " " + msg.slice(0, 200), { status: 502 });
    }

    const buf = await r.arrayBuffer();
    if (env.TTS_CACHE) {
      ctx.waitUntil(
        env.TTS_CACHE.put(cacheKey, buf).catch(function () {})
      );
    }
    return audioResponse(buf);
  },
};
