// Manual test: GET /api/post?niche=aivendora&url=https://amazon.in/dp/XXX
const { postToAllPlatforms } = require('../lib/distributor');

module.exports = async (req, res) => {
  const { niche, url } = req.query;
  if (!niche || !url) return res.status(400).send('need ?niche=&url=');
  await postToAllPlatforms(niche, url);
  return res.status(200).send('posted');
};
