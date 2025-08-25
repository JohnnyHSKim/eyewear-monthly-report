import fs from 'fs';
import path from 'path';
import { DateTime } from 'luxon';
import { htmlToText } from 'html-to-text';

const TIMEZONE = 'Asia/Seoul';
const MAX_PER_SECTION = 6;

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
      const isNew   = kw.new_products.some(k => text.includes(k.toLowerCase()));
      const isTrend = kw.trends.some(k => text.includes(k.toLowerCase()));
      const isBrand = kw.brands.some(k => text.includes(k.toLowerCase()));

      const section = isNew ? 'New Products' : (isTrend ? 'Trends' : (isBrand ? 'Brands' : 'Trends'));
      buckets[section].push(it);
    }
    // 각 섹션 상한 적용
    for (const k of Object.keys(buckets)) {
      buckets[k] = buckets[k].slice(0, MAX_PER_SECTION);
    }
    bucketsByMag[mag] = buckets;
  }
  return bucketsByMag;
}

export function buildEmail(bucketsByMag, start, end) {
  const period = `${start.toFormat('yyyy-MM-dd')} ~ ${end.toFormat('yyyy-MM-dd')} (KST)`;
  const subject = `Eyewear Monthly — ${start.toFormat('yyyy.MM')} 요약`;

  // HTML
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
        const safeTitle = escapeHTML(it.title || '(no title)');
        const url = it.link || '#';
        html += `<li><a href="${url}">${safeTitle}</a></li>`;
      }
      html += `</ul>`;
    }
  }
  html += `<p style="margin-top:20px;color:#777">— 자동 생성 리포트</p></div>`;

  // TEXT
  const text = htmlToText(html, { wordwrap: 100 });

  return { subject, html, text };
}

function escapeHTML(s='') {
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
