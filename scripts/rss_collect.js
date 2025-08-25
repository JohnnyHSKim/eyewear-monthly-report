import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { DateTime } from 'luxon';

const TIMEZONE = 'Asia/Seoul';

export async function collectFromRSS(start, end) {
  const feedsPath = path.join(process.cwd(), 'config', 'feeds.json');
  const feeds = fs.existsSync(feedsPath)
    ? JSON.parse(fs.readFileSync(feedsPath, 'utf-8'))
    : {};

  const parser = new Parser();
  const out = {};

  for (const [mag, urls] of Object.entries(feeds)) {
    out[mag] = out[mag] || [];
    for (const url of urls || []) {
      try {
        const feed = await parser.parseURL(url);
        for (const it of feed.items || []) {
          const pub = parseDate(it);
          if (pub && pub >= start && pub <= end) {
            out[mag].push({
              title: it.title || '(no title)',
              link: it.link || '',
              snippet: (it.contentSnippet || it.content || '').trim(),
              source: 'rss'
            });
          }
        }
      } catch (e) {
        console.error(`[RSS] ${mag} ${url} -> ${e.message}`);
      }
    }
  }
  return out;
}

function parseDate(item) {
  const candidates = [item.isoDate, item.pubDate, item.published, item.updated];
  for (const c of candidates) {
    if (!c) continue;
    let d = DateTime.fromISO(c, { zone: TIMEZONE, setZone: true });
    if (!d.isValid) d = DateTime.fromRFC2822(c, { zone: TIMEZONE, setZone: true });
    if (d.isValid) return d;
  }
  return null;
}
