// Sends one product to all 4 platforms for a niche
const { buildAffiliateLink, getProduct } = require('./amazon');
const { makeVideo } = require('./video');
const { postYouTube } = require('./youtube');
const { postTelegram } = require('./telegram');
const { postInstagram } = require('./instagram');
const { postWix } = require('./wix');

async function postToAllPlatforms(niche, productUrl) {
  const product = await getProduct(productUrl);          // PA-API (or fallback scrape)
  const link = buildAffiliateLink(productUrl);           // tag auto-attached
  const video = await makeVideo(product, niche);         // 30-sec promo
  const caption = `${product.title}\n\nDeal: ${link}\n#deals #${niche}`;

  await postYouTube(niche, video, caption);
  await postInstagram(niche, video, caption);
  await postTelegram(niche, video, caption);
  await postWix(niche, product, link);
  console.log(`Done: ${niche} posted to 4 platforms.`);
}

module.exports = { postToAllPlatforms };
