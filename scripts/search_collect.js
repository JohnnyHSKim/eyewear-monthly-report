import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { DateTime } from 'luxon';

const TIMEZONE = 'Asia/Seoul';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const GOOGLE_CSE_KEY = process.env.GOOGLE_CSE_KEY || '';
const GOOGLE_CSE_CX  = process.env.GOOGLE_CSE_CX  || '';

const MAX_RESULTS_PER_MAG = 12;

export async function collectFromSearch(start, end, existingByMag) {
  const sitesPath = path.join(process.cwd(), 'config', 'sites.json');
  const sites = fs.existsSync(sitesPath)
    ? JSON.parse(fs.readFileSync(sitesPath, 'utf-8'))
    : {};

  const out = {};

  for (const [mag, domains] of Object.entries(sites)) {
    // RSS로 충분하면 스킵
    const haveEnough = (existingByMag[mag] || []).length >= 6;
    if (haveEnough) continue;

    const queries = buildQueriesForRange(start);
    const items = [];

    for (const domain of domains) {
      for (const q of queries) {
        const term = `site:${domain} ${q}`;
        const results = await search(term);
        for (const r of results) {
          // 간단 중복 제거
          const sig = `${new URL(r.url).host}|${normalize(r.title)}`;
          if (items.find(x => x.sig === sig)) continue;
          items.push({ title: r.title, link: r.url, snippet: r.snippet || '', source: r.engine, sig });
          if (items.length >= MAX_RESULTS_PER_MAG) break;
        }
        if (items.length >= MAX_RESULTS_PER_MAG) break;
      }
      if (items.length >= MAX_RESULTS_PER_MAG) break;
    }
    out[mag] = items;
  }
  return out;
}

function buildQueriesForRange(start) {
  const ym = start.toFormat('yyyy-MM');
  return [
    `eyewear trends ${ym}`,
    `new collection ${ym}`,
    `launch eyewear ${ym}`,
    `brand collaboration eyewear ${ym}`
  ];
}

function normalize(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function search(term) {
  if (SERPAPI_KEY) {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', term);
    url.searchParams.set('num', '10');
    url.searchParams.set('api_key', SERPAPI_KEY);
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      const arr = (j.organic_results || []).map(o => ({
        title: o.title, url: o.link, snippet: o.snippet, engine: 'serpapi'
      }));
      return arr;
    } else {
      console.error('[SerpApi] ' + (await r.text()));
    }
  }
  if (GOOGLE_CSE_KEY && GOOGLE_CSE_CX) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('q', term);
    url.searchParams.set('key', GOOGLE_CSE_KEY);
    url.searchParams.set('cx', GOOGLE_CSE_CX);
    url.searchParams.set('num', '10');
    const r = await fetch(url);
    if (r.ok) {
      const j = await r.json();
      const arr = (j.items || []).map(o => ({
        title: o.title, url: o.link, snippet: o.snippet, engine: 'google-cse'
      }));
      return arr;
    } else {
      console.error('[Google CSE] ' + (await r.text()));
    }
  }
  // 아무 키도 없으면 빈 배열
  return [];
}
