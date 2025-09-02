import nodemailer from 'nodemailer';
import { prevMonthRange, classifyItems, buildEmail, enrichSummaries } from './make_report.js';
import { collectFromRSS } from './rss_collect.js';
import { collectFromSearch } from './search_collect.js';

const need = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','EMAIL_FROM','EMAIL_TO'];
for (const k of need) {
  if (!process.env[k]) { console.error(`[ERROR] Missing env: ${k}`); process.exit(1); }
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO } = process.env;
const port = Number(SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,        // 465=SSL, 587=STARTTLS
  requireTLS: port === 587,    // 587일 때 권장
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 20000,
  greetingTimeout: 20000
});

(async () => {
  try {
    // 1) 전월 기간(KST)
    const { start, end } = prevMonthRange();

    // 2) 수집 (RSS → 부족분 검색 보강)
    const rssData = await collectFromRSS(start, end);
    const searchData = await collectFromSearch(start, end, rssData);

    // 3) 합치기
    const combined = { ...rssData };
    for (const [mag, arr] of Object.entries(searchData)) {
      combined[mag] = (combined[mag] || []).concat(arr);
    }

    // 4) 분류 → 요약 붙이기 → 본문 생성
    const buckets = classifyItems(combined);
    await enrichSummaries(buckets);   // 기사별 1~2문장 요약
    const { subject, html, text } = buildEmail(buckets, start, end);

    // 5) 발송
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      text,
      html
    });
    console.log('[OK] Monthly report sent:', info.messageId || info.response || info);
  } catch (err) {
    console.error('[ERROR] Monthly report failed:', err?.message || err);
    process.exit(1);
  }
})();
