# TG Mini App MVP (Cloudflare Pages + Workers)

## 1) Deploy Worker (API)

Требуется Node.js + аккаунт Cloudflare.

```bash
cd worker
npm i
npx wrangler login
npx wrangler secret put BOT_TOKEN
# вставь токен твоего бота
npx wrangler deploy
