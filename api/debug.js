// api/debug.js - Sirf Env Check ke liye, Secret nahi dikhayega
module.exports = async (req, res) => {
  const a = process.env.YT_REFRESH_JSON || "";
  const b = process.env.YT_JSON || "";
  let ka = [], kb = [];
  try { ka = Object.keys(JSON.parse(a || "{}")); } catch (e) { ka = ["PARSE_FAIL"]; }
  try { kb = Object.keys(JSON.parse(b || "{}")); } catch (e) { kb = ["PARSE_FAIL"]; }
  return res.status(200).json({
    has_YT_REFRESH_JSON: a.length > 0,
    len_YT_REFRESH_JSON: a.length,
    keys_YT_REFRESH_JSON: ka,
    has_YT_JSON: b.length > 0,
    len_YT_JSON: b.length,
    keys_YT_JSON: kb,
    has_TG_BOT_TOKEN: !!process.env.TG_BOT_TOKEN,
    has_GH_TOKEN: !!process.env.GH_TOKEN,
  });
};
