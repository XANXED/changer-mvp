const statusEl = document.getElementById("status");
const userEl = document.getElementById("user");
const initDataEl = document.getElementById("initdata");

const btnValidate = document.getElementById("btn-validate");
const btnExpand = document.getElementById("btn-expand");

const API_BASE = "https://changer-mvp.egorkachek01.workers.dev";

function setStatus(text) {
  statusEl.textContent = text;
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function getWebApp() {
  return window.Telegram?.WebApp;
}

function init() {
  const tg = getWebApp();
  if (!tg) {
    setStatus("Telegram WebApp SDK не найден (открой в Telegram)");
    return;
  }

  tg.ready();
  setStatus("Telegram WebApp готов");

  // Покажем initData для отладки
  initDataEl.textContent = tg.initData || "(пусто)";

  btnExpand.addEventListener("click", () => {
    tg.expand();
  });

  btnValidate.addEventListener("click", async () => {
    if (!API_BASE || API_BASE.includes("REPLACE_WITH")) {
      setStatus("Сначала вставь URL Worker в API_BASE");
      return;
    }

    try {
      setStatus("Отправляю initData на сервер...");
      userEl.textContent = "(в процессе)";

      const res = await fetch(`${API_BASE}/api/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus(`Ошибка: HTTP ${res.status}`);
        userEl.textContent = pretty(data);
        return;
      }

      setStatus("initData валидно");
      userEl.textContent = pretty(data.user);
    } catch (e) {
      setStatus("Ошибка сети/JS");
      userEl.textContent = String(e);
    }
  });
}

init();
