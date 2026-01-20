/**
 * Cloudflare Worker: валидирует Telegram Mini App initData.
 * Секрет хранится как Wrangler secret: BOT_TOKEN
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS (MVP)
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    if (url.pathname === "/api/health") {
      return cors(json({ ok: true, ts: Date.now() }));
    }

    if (url.pathname === "/api/validate" && request.method === "POST") {
      if (!env.BOT_TOKEN) {
        return cors(json({ ok: false, error: "BOT_TOKEN secret is not set" }, 500));
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return cors(json({ ok: false, error: "Invalid JSON" }, 400));
      }

      const initData = body?.initData;
      if (!initData || typeof initData !== "string") {
        return cors(json({ ok: false, error: "initData is required" }, 400));
      }

      const parsed = parseInitData(initData);
      const hash = parsed.get("hash");
      if (!hash) {
        return cors(json({ ok: false, error: "hash missing in initData" }, 400));
      }

      // Собираем data_check_string
      const dataCheckString = buildDataCheckString(parsed);

      const secretKey = await telegramWebAppSecretKey(env.BOT_TOKEN);
      const expectedHash = await hmacHex(secretKey, dataCheckString);

      if (!timingSafeEqual(hash, expectedHash)) {
        return cors(json({ ok: false, error: "initData signature invalid" }, 401));
      }

      // (Опционально) Проверка свежести auth_date
      const authDate = Number(parsed.get("auth_date") || "0");
      // Для MVP — не режем, просто возвращаем; в проде обычно делают TTL, например 1-5 минут.

      let user = null;
      try {
        user = parsed.get("user") ? JSON.parse(parsed.get("user")) : null;
      } catch {
        user = null;
      }

      return cors(
        json({
          ok: true,
          auth_date: authDate,
          user,
          raw: Object.fromEntries(parsed.entries())
        })
      );
    }

    return cors(json({ ok: false, error: "Not found" }, 404));
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function cors(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(resp.body, { status: resp.status, headers });
}

/**
 * initData — это querystring формата "a=1&b=2&...".
 * Значения urlencoded.
 */
function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  // Важно: URLSearchParams уже делает url-decode
  return params;
}

/**
 * data_check_string:
 * - берём все пары key=value кроме hash
 * - сортируем по key лексикографически
 * - соединяем через "\n"
 */
function buildDataCheckString(params) {
  const entries = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash") continue;
    entries.push([k, v]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

/**
 * secret_key = HMAC_SHA256("WebAppData", bot_token)
 */
async function telegramWebAppSecretKey(botToken) {
  const key = await importHmacKey(encodeUtf8(botToken));
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8("WebAppData"));
  return new Uint8Array(sig); // bytes
}

async function hmacHex(keyBytes, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8(data));
  return toHex(new Uint8Array(sig));
}

async function importHmacKey(rawBytes) {
  return crypto.subtle.importKey(
    "raw",
    rawBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function encodeUtf8(s) {
  return new TextEncoder().encode(s);
}

function toHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/**
 * Минимальная timing-safe проверка (по длине и по всем символам)
 */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}
