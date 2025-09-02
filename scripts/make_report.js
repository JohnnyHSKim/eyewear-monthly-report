import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import { htmlToText } from 'html-to-text';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const TIMEZONE = 'Asia/Seoul';
const MAX_PER_SECTION = 8;    // 섹션당 기사 수 상향
const SHOW_SUMMARY = true;    // 요약 표시

export function prevMonthRange() {
  const now = DateTime.now().setZone(TIMEZONE);
  return {
    start: now.minus({ months: 1 }).startOf('month'),
    end: now.minus({ months: 1 }).endOf('month')
  };
}

export function classifyItems(magToItems) {
  const kwPath = path.join(process.cwd(), 'config', 'keywords.json');
  const kw = fs.existsSync(kwPath)
    ? JSON.parse(fs.readFileSync(kwPath, 'utf-8'))
    : { trends: [], new_products: [], brands: [] };

  const bucketsByMag = {};
  for (const [mag, arr] of Object.entries(magToItems)) {
    const buckets = { Trends: [], 'New Products': [], Brands: [] };

    for (const it of arr || []) {
      const text = `${(it.title||'')} ${(it.snippet||'')}`.toLowerCase();

      // 1) 피드에서 준 힌트가 있으면 우선
      let section = it.sectionHint || null;

      // 2) 힌트가 없으면 키워드 분류
      if (!section) {
        const isNew   = kw.new_products.some(k => text.includes(k.toLowerCase()));
        const isTrend = kw.trends.some(k => text.includes(k.toLowerCase()));
        const isBrand = kw.brands.some(k => text.includes(k.toLowerCase()));
        section = isNew ? 'New Products' : (isTrend ? 'Trends' : (isBrand ? 'Brands' : 'Trends'));
      }

      buckets[section].push(it);
    }

    // 각 섹션 상한
    for (const k of Object.keys(buckets)) {
      buckets[k] = buckets[k].slice(0, MAX_PER_SECTION);
    }
    bucketsByMag[mag] = buckets;
  }
  return bucketsByMag;
}

export async function enrichSummaries(bucketsByMag) {
  // 각 기사에 1~2문장 요약 붙이기(메타/본문에서 추출)
  const all = [];
  for (const [mag, buckets] of Object.entries(bucketsByMag)) {
    for (const [sec, arr] of Object.entries(buckets)) {
      for (const it of arr) all.push(it);
    }
  }

  const LIMIT = 18; // 과도한 외부 요청 방지(최대 18개만 요약)
  for (let i=0; i<Math.min(LIMIT, all.length); i++) {
    const it = all[i];
    if (it.summary) continue;
    try {
      it.summary = await pullSummary(it.link, it.snippet);
    } catch (e) {
      it.summary = it.snippet ? truncate(it.snippet, 180) : '';
    }
  }
}

async function pullSummary(url, fallback='') {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) return truncate(fallback, 180);

  const html = await res.text();

  // 우선 메타 태그
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const meta =
    doc.querySelector('meta[name="description"]')?.content ||
    doc.querySelector('meta[property="og:description"]')?.content ||
    '';

  // Readability로 본문 추출
  let text = '';
  try {
    const reader = new Readability(doc);
    const article = reader.parse();
    if (article?.textContent) text = article.textContent;
  } catch {}

  const raw = (meta || text || fallback || '').replace(/\s+/g,' ').trim();
  if (!raw) return '';

  // 1~2문장 요약(간단 규칙)
  const sentences = raw.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return truncate(sentences, 260);
}

function truncate(s, n) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n-1) + '…';
}

export function buildEmail(bucketsByMag, start, end) {
  const period = `${start.toFormat('yyyy-MM-dd')} ~ ${end.toFormat('yyyy-MM-dd')} (KST)`;
  const subject = `Eyewear Monthly — ${start.toFormat('yyyy.MM')} 요약`;

  let html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; line-height:1.6">
    <h2>전월 아이웨어 리포트 요약</h2>
    <p style="color:#555">기간: ${period}</p>
  `;

  for (const [mag, buckets] of Object.entries(bucketsByMag)) {
    const sections = Object.entries(buckets).filter(([, arr]) => arr && arr.length);
    if (!sections.length) continue;
    html += `<h3 style="margin-top:20px">${mag}</h3>`;
    for (const [secTitle, arr] of sections) {
      html += `<h4 style="margin:14px 0 6px">${secTitle}</h4><ul>`;
      for (const it of arr) {
        const ttl = escapeHTML(it.title || '(no title)');
        const url = it.link || '#';
        const sum = it.summary ? `<div style="color:#555;font-size:13px;margin:2px 0 8px">${escapeHTML(it.summary)}</div>` : '';
        html += `<li style="margin-bottom:6px"><a href="${url}">${ttl}</a>${SHOW_SUMMARY ? sum : ''}</li>`;
      }
      html += `</ul>`;
    }
  }
  html += `<p style="margin-top:20px;color:#777">— 자동 생성 리포트</p></div>`;
  const text = htmlToText(html, { wordwrap: 100 });
  return { subject, html, text };
}

function escapeHTML(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
