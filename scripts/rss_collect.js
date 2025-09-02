import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { DateTime } from 'luxon';

const TIMEZONE = 'Asia/Seoul';

// 피드 URL로 카테고리 힌트 추출
function hintFromFeedUrl(u='') {
  const s = u.toLowerCase();
  if (s.includes('/frame-collections/') || s.includes('/sunwear-collections/')) return 'New Products';
  if (s.includes('/brands-and-designers/')) return 'Brands';
  if (s.includes('/high-visibility/')) return 'Trends';
  return null; // 모르면 분류기한테 맡김
}

export async function collectFromRSS(start, end) {
  const feedsPath = path.join(process.cwd(), 'config', 'feeds.json');
  const feeds = fs.existsSync(feedsPath)
    ? JSON.parse(fs.readFileSync(feedsPath, 'utf-8'))
    : {};

  const parser = new Parser();
  const out = {};
  const seen = new Set(); // 중복 제거(도메인+제목)

  for (const [mag, urls] of Object.entries(feeds)) {
    out[mag] = out[mag] || [];
    for (const url of urls || []) {
      const secHint = hintFromFeedUrl(url);
      try {
        const feed = await parser.parseURL(url);
        for (const it of feed.items || []) {
          const pub = parseDate(it);
          if (!pub || pub < start.minus({ days: 2 }) || pub > end.plus({ days: 2 })) continue;

          const title = (it.title || '').trim();
          const link = (it.link || '').trim();
          const snippet = (it.contentSnippet || it.content || '').toString().replace(/\s+/g,' ').trim();

          const sig = `${new URL(link).hostname}|${title.toLowerCase()}`;
          if (seen.has(sig)) continue;
          seen.add(sig);

          out[mag].push({
            title,
            link,
            snippet,
            source: 'rss',
            sectionHint: secHint // 분류 시 우선 반영
          });
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
