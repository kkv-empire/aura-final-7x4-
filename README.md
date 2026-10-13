# AURA 7x4 Bot — Vercel (webhook + cron)

## Files
- `api/telegram.js` → Telegram webhook (BotFather me setWebhook karo)
- `api/cron.js` → Vercel Cron, har 30 min me due posts karta hai
- `api/post.js` → manual test
- `lib/` → youtube, instagram, telegram, wix, amazon, video, distributor, queue
- `config/niches.json` → 7 niche config
- `vercel.json` → cron schedule

## Setup
1. GitHub repo me ye files daalo (api/ folder ke andar wali api me, baaki bahar)
2. Vercel env me tokens bharo (TG_BOT_TOKEN, YT_REFRESH_JSON, TG_CHANNELS_JSON, WIX_KEYS_JSON, IG_FB_JSON)
3. Deploy ke baad Telegram me webhook set karo:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tumhara-app.vercel.app/api/telegram`
4. Bot ko `/post aivendora <link>` bhejo → queue → cron gap deke post karega

## Amazon keys (baad me)
AMAZON_TAG, AMAZON_PAAPI_KEY, AMAZON_PAAPI_SECRET env me add karo.
