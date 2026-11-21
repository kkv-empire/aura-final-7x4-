export default function handler(req, res) {
  const check = (k) => {
    const v = process.env[k] || "";
    return { has: !!v, len: v.length, start: v.slice(0, 10) };
  };
  res.status(200).json({
    YT_AIVENDORA: check("YT_AIVENDORA"),
    YT_TRENDMIND: check("YT_TRENDMIND"),
    YT_SMARTSHIPLY: check("YT_SMARTSHIPLY"),
    YT_NICHEPILOT: check("YT_NICHEPILOT"),
    YT_ADBRAINX: check("YT_ADBRAINX"),
    YT_CARTFLOW: check("YT_CARTFLOW"),
    YT_GLOBALDROP: check("YT_GLOBALDROP"),
    YT_CLIENT_ID: check("YT_CLIENT_ID"),
    YT_CLIENT_SECRET: check("YT_CLIENT_SECRET"),
    has_TG_BOT_TOKEN: !!process.env.TG_BOT_TOKEN,
  });
}
