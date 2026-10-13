// Amazon PA-API — keys added later. Works in fallback mode till then.
const TAG = process.env.AMAZON_TAG || ''; // e.g. 'mytag-21'
const ACCESS_KEY = process.env.AMAZON_PAAPI_KEY || '';
const SECRET_KEY = process.env.AMAZON_PAAPI_SECRET || '';

function buildAffiliateLink(url) {
  if (!TAG) return url; // no tag yet → plain link
  const clean = url.split('?')[0].split('/ref=')[0];
  return `${clean}?tag=${TAG}`;
}

async function getProduct(url) {
  // TODO: plug PA-API here when keys arrive.
  // Fallback: minimal product object from URL
  return { title: 'Trending Product', price: '', image: '', url };
}

module.exports = { buildAffiliateLink, getProduct };
