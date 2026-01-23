/**
 * Cloudflare Worker: валидирует Telegram Mini App initData.
 * Секрет хранится как Wrangler secret: BOT_TOKEN
 */

const VALID_AUTH_WINDOW = 300; // Данные считаются валидными только в течение 5 минут (300 секунд)

export default {
  async fetch(request, env) {
    // 1. Обработка CORS (Preflight request)
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }));
    }

    try {
      const url = new URL(request.url);

      // Простейший Healthcheck
      if (url.pathname === "/api/health") {
        return cors(json({ ok: true, ts: Date.now() }));
      }

      // Основной эндпоинт валидации
      if (url.pathname === "/api/validate" && request.method === "POST") {
        return await handleValidate(request, env);
      }

      return cors(json({ ok: false, error: "NOT_FOUND" }, 404));
    } catch (err) {
      // Внутреннее логирование для разработчика
      console.error("Worker Error:", err);
      // Пользователю отдаем только общий код ошибки без деталей реализации
      return cors(json({ ok: false, error: "INTERNAL_SERVER_ERROR" }, 500));
    }
  },
};

/**
 * Основная логика валидации initData
 */
async function handleValidate(request, env) {
  // Проверка конфигурации сервера
  if (!env.BOT_TOKEN) {
    console.error("Критическая ошибка: BOT_TOKEN не установлен в секретах Cloudflare");
    return cors(json({ ok: false, error: "SERVER_CONFIG_ERROR" }, 500));
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return cors(json({ ok: false, error: "INVALID_JSON" }, 400));
  }

  const initData = body?.initData;
  if (!initData || typeof initData !== "string") {
    return cors(json({ ok: false, error: "INIT_DATA_REQUIRED" }, 400));
  }

  const parsed = parseInitData(initData);
  const hash = parsed.get("hash");
  const authDate = Number(parsed.get("auth_date") || "0");

  if (!hash) {
    return cors(json({ ok: false, error: "HASH_MISSING" }, 400));
  }

  // --- НОВОВВЕДЕНИЕ: Защита от Replay-атак ---
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > VALID_AUTH_WINDOW) {
    return cors(json({ ok: false, error: "DATA_EXPIRED" }, 401));
  }

  // --- Валидация подписи (HMAC-SHA256) ---
  const dataCheckString = buildDataCheckString(parsed);
  const secretKey = await telegramWebAppSecretKey(env.BOT_TOKEN);
  const expectedHash = await hmacHex(secretKey, dataCheckString);

  if (!timingSafeEqual(hash, expectedHash)) {
    return cors(json({ ok: false, error: "INVALID_SIGNATURE" }, 401));
  }

  // Извлекаем данные пользователя
  let user = null;
  try {
    user = parsed.get("user") ? JSON.parse(parsed.get("user")) : null;
  } catch {
    user = null;
  }

  return cors(
    json({
      ok: true,
      user: user ? {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        language_code: user.language_code
      } : null,
      auth_date: authDate
    })
  );
}

// --- Вспомогательные функции (Utility) ---

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function cors(resp) {
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*"); // В проде лучше заменить на конкретный домен
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(resp.body, { status: resp.status, headers });
}

function parseInitData(initData) {
  return new URLSearchParams(initData);
}

function buildDataCheckString(params) {
  const entries = [];
  for (const [k, v] of params.entries()) {
    if (k === "hash") continue;
    entries.push([k, v]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return entries.map(([k, v]) => `${k}=${v}`).join("\n");
}

async function telegramWebAppSecretKey(botToken) {
  const key = await crypto.subtle.importKey(
    "raw",
    encodeUtf8(botToken),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encodeUtf8("WebAppData"));
  return new Uint8Array(sig);
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

function encodeUtf8(s) {
  return new TextEncoder().encode(s);
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}