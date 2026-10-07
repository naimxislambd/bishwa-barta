#!/usr/bin/env node
/**
 * বিশ্ব বার্তা — news fetcher
 * Pulls Bengali international news from free RSS feeds, dedupes against
 * data/news.json and saves the merged list (newest first, max 300).
 * Zero dependencies. Run: node fetch-news.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data', 'news.json');
const MAX_ITEMS = 300;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const SOURCES = [
  {
    name: 'BBC বাংলা',
    nameEn: 'BBC News Bangla',
    site: 'https://www.bbc.com/bengali',
    feed: 'https://www.bbc.com/bengali/index.xml',
  },
  {
    // Google News-এর বাংলা টপ স্টোরিজ — প্রথম আলো, বিডিনিউজ২৪ সহ
    // নানা বাংলা সংবাদমাধ্যমের তাজা খবর এক ফিডে
    name: 'গুগল নিউজ বাংলা',
    nameEn: 'Google News Bangla',
    site: 'https://news.google.com/?hl=bn&gl=BD&ceid=BD:bn',
    feed: 'https://news.google.com/rss?hl=bn&gl=BD&ceid=BD:bn',
    useSourceTag: true,
  },
  // NOTE: ভয়েস অব আমেরিকার RSS ফিড আপডেট বন্ধ (সর্বশেষ: মার্চ ২০২৫),
  // তাই আপাতত বাদ দেওয়া হয়েছে। ফিড সচল হলে আবার যোগ করা যাবে:
  // { name: 'ভয়েস অব আমেরিকা', site: 'https://www.voabangla.com',
  //   feed: 'https://www.voabangla.com/api/' },
];

// Items matching these are not news articles (audio programs etc.)
const SKIP_TITLE = /broadcast|podcast|সংবাদ\s*বুলেটিন/i;

function fetchText(url, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http');
    const req = lib.get(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(new URL(res.headers.location, url).href, timeoutMs));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => { req.destroy(new Error(`timeout: ${url}`)); });
  });
}

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"').replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(s) {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function cleanText(s) {
  return decodeEntities(stripTags(stripCdata(s || ''))).trim();
}

function summarize(s, max = 240) {
  s = cleanText(s);
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function pickImage(itemXml) {
  // media:thumbnail first, then image enclosure
  let m = itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
       || itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i);
  if (m) {
    let u = m[1];
    // BBC ichef thumbs are 240px — ask for a bigger rendition
    u = u.replace('ichef.bbci.co.uk/ace/ws/240/', 'ichef.bbci.co.uk/ace/ws/800/')
         .replace('ichef.bbci.co.uk/ace/standard/240/', 'ichef.bbci.co.uk/ace/standard/800/');
    return u;
  }
  m = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image[^"]*"/i)
   || itemXml.match(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/i);
  return m ? m[1] : null;
}

function parseRss(xml, source) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const b of blocks) {
    const get = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? m[1] : '';
    };
    const title = cleanText(get('title'));
    let link = cleanText(get('link'));
    if (!link) {
      const lm = b.match(/<link[^>]*href="([^"]+)"/i);
      if (lm) link = lm[1];
    }
    if (!title || !link || SKIP_TITLE.test(title)) continue;
    const desc = get('description') || get('content:encoded') || '';
    const summary = summarize(desc);
    if (!summary || summary.length < 20) continue;
    const pubRaw = cleanText(get('pubDate') || get('dc:date') || '');
    let pubDate = new Date(pubRaw);
    if (isNaN(pubDate.getTime())) pubDate = new Date();
    // drop items older than 14 days
    if (Date.now() - pubDate.getTime() > 14 * 864e5) continue;

    const id = crypto.createHash('sha1').update(link).digest('hex').slice(0, 12);

    // Google News feed-এ <source> ট্যাগে আসল প্রকাশকের নাম থাকে
    let srcName = source.name, srcSite = source.site;
    if (source.useSourceTag) {
      const sm = b.match(/<source[^>]*url="([^"]*)"[^>]*>([\s\S]*?)<\/source>/i)
              || b.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      if (sm) {
        const sName = cleanText(sm[2] || sm[1]);
        if (sName) srcName = sName;
        const sUrl = b.match(/<source[^>]*url="([^"]*)"/i);
        if (sUrl && sUrl[1]) srcSite = sUrl[1];
      }
    }

    items.push({
      id,
      title,
      link,
      summary,
      image: pickImage(b),
      pubDate: pubDate.toISOString(),
      source: srcName,
      sourceSite: srcSite,
    });
  }
  return items;
}

async function main() {
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!Array.isArray(existing)) existing = [];
  } catch { /* first run */ }

  const seen = new Map(existing.map((it) => [it.link, it]));
  // শিরোনাম-ভিত্তিক ডুপ্লিকেট ধরতে (একই খবর ভিন্ন ফিডে এলে)
  const normTitle = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const seenTitles = new Set([...seen.values()].map((it) => normTitle(it.title)));
  let added = 0;

  for (const src of SOURCES) {
    try {
      const xml = await fetchText(src.feed);
      const items = parseRss(xml, src);
      for (const it of items) {
        const nt = normTitle(it.title);
        if (!seen.has(it.link) && !seenTitles.has(nt)) {
          it.fetchedAt = new Date().toISOString();
          seen.set(it.link, it);
          seenTitles.add(nt);
          added++;
        }
      }
      console.log(`✓ ${src.name}: ${items.length} parsed, total ${seen.size}`);
    } catch (err) {
      console.error(`✗ ${src.name}: ${err.message}`);
    }
  }

  const merged = [...seen.values()]
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, MAX_ITEMS);

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(merged, null, 1) + '\n');
  console.log(`done: +${added} new, ${merged.length} stored → ${DATA_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
