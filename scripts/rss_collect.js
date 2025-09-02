import fs from 'fs';
import path from 'path';
import Parser from 'rss-parser';
import { DateTime } from 'luxon';

const TIMEZONE = 'Asia/Seoul';

/**
 * 피드 URL에서 섹션 힌트를 유추
 * - Vision Monday 기준:
 *   frame-collections, sunwear-collections => New Products
 *   brands-and-designers                  => Brands
 *   high-visibility                       => Trends
 */
function hintFromFeedUrl(u = '') {
  const s = u.toLowerCase();
  if (s.includes('/frame-collections/') || s.includes('/sunwear-collections/')) return 'New Products';
  if (s.includes('/brands-and-designers/')) return 'Brands';
  if (s.includes('/high-visibility/')) return 'Trends';
  return null;
}

/**
 * RSS 수집: 전월 기간(start~end)에 걸친 아이템을 모아 매체별로 반환
 * - 날짜 필터는 전월 경계 ±2일 버퍼
 * - 중복 제거: host + lower(title)
 * - 섹션 힌트: feed URL 기반 (분류기 보정용)
 * - 디버그 로그: raw 아이템, 필터 결과
 */
export async function collectFromRSS(start, end) {
  const feedsPath = path.join(process.cwd(), 'config', 'feeds.json');
  const feeds = fs.existsSync(feedsPath)
    ? JSON.parse(fs.readFileSync(feedsPath, 'utf-8'))
    : {};

  const parser = new Parser();
  const out = {};
  const seen = new Set();

  // 날짜 버퍼(±2일)
  const START = start.minus({ days: 2 });
  const END   = end.plus({ days: 2 });

  for (const [mag, urls] of Object.entries(feeds)) {
    out[mag] = out[mag] || [];
    for (const url of urls || []) {
      const secHint = hintFromFeedUrl(url);

      try {
        const feed = await parser.parseURL(url);
        // 피드 타이틀 디버그
        console.log(`[DEBUG][RSS] feed ok: ${mag} <- ${url} (items=${(feed.items || []).length})`);

        for (const item of feed.items || []) {
          const pub = parseDate(item);
          // 원본 값 디버그
          console.log(`[DEBUG][RSS][RAW] ${mag} :: "${(item.title || '').trim()}" pub=${pub ? pub.toISO() : 'N/A'}`);

          // 날짜 필터
          if (!pub || pub < START || pub > END) {
            console.log(`[DEBUG][RSS][SKIP date] "${(item.title || '').trim()}"`);
            continue;
          }

          const title = (item.title || '').trim();
          const link  = (item.link || '').trim();
          if (!title || !link) {
            console.log(`[DEBUG][RSS][SKIP missing] title/link missing`);
            continue;
          }

          // 중복 제거(호스트 + 제목)
          let host = '';
          try { host = new URL(link).hostname; } catch {}
          const sig = `${host}|${title.toLowerCase()}`;
          if (seen.has(sig)) {
            console.log(`[DEBUG][RSS][SKIP dup] "${title}"`);
            continue;
          }
          seen.add(sig);

          const snippet = (item.contentSnippet || item.content || '')
            .toString()
            .replace(/\s+/g, ' ')
            .trim();

          out[mag].push({
            title,
            link,
            snippet,
            source: 'rss',
            sectionHint: secHint
          });

          console.log(`[DEBUG][RSS][KEEP] ${mag} :: "${title}" → sectionHint=${secHint || 'null'}`);
        }
      } catch (e) {
        console.error(`[RSS][ERROR] ${mag} ${url} -> ${e.message}`);
      }
    }
  }

  return out;
}

function parseDate(item) {
  const candidates = [item.isoDate, item.pubDate, item.published, item.updated];
  for (const c of candidates) {
    if (!c) continue;
    // ISO 우선 → 안 되면 RFC2822
    let d = DateTime.fromISO(c, { zone: TIMEZONE, setZone: true });
    if (!d.isValid) d = DateTime.fromRFC2822(c, { zone: TIMEZONE, setZone: true });
    if (d.isValid) return d;
  }
  return null;
}
