// scripts/send-report.js
// 매월 1일 09:30 KST에 "새 챗으로 전월 아이웨어 리포트 요청" 프롬프트가 담긴 링크를 보내는 알림 메일

import nodemailer from 'nodemailer';
import { DateTime } from 'luxon';

// ── 필수 환경변수 체크 ─────────────────────────────────────────────────────────
const need = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','EMAIL_FROM','EMAIL_TO'];
for (const k of need) {
  if (!process.env[k]) {
    console.error(`[ERROR] Missing env: ${k}`);
    process.exit(1);
  }
}
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO } = process.env;

// ── 전월(YYYY-MM) 계산 (KST) ──────────────────────────────────────────────────
const KST = 'Asia/Seoul';
const prevMonth = DateTime.now().setZone(KST).minus({ months: 1 });
const ym = prevMonth.toFormat('yyyy년 M월');

// ── 새 챗에 미리 채워둘 지시문(엄격 버전) ─────────────────────────────────────
const basePrompt = `지난달(${ym})에 발행된 
Vision Monday, Eyestylist, Eyebook, Spectr Magazine, The Eyewear Forum, 
Eyewear Biz, Senken Shimbun, iOFT/Japan Eyewear Awards, V.MAGAZINE (HK), 
HKTDC/HK Optical Fair, GQ, Vogue 
각 매체의 모든 기사 중에서 아이웨어(eyewear, glasses, optical) 관련 내용을 
트렌드 / 신제품 출시 / 신생 브랜드 보도 중심으로 정리해줘. 

조건:
1) 매거진별로 bullet 요약 (한국어) 
2) 원문 링크 포함 
3) 한 매체도 누락하지 말고, 기사 없는 경우 '해당 월 기사 없음'으로 표기`;

// ChatGPT 새 챗 시작 URL에 프롬프트 포함 (URL 인코딩)
const chatUrl = `https://chat.openai.com/?q=${encodeURIComponent(basePrompt)}`;

// ── SMTP 트랜스포터 ───────────────────────────────────────────────────────────
const port = Number(SMTP_PORT);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,       // 465=SSL
  requireTLS: port === 587,   // 587=STARTTLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 20000,
  greetingTimeout: 20000
});

// ── 메일 콘텐츠 ───────────────────────────────────────────────────────────────
const subject = `Eyewear 월간 리포트 알림 — ${ym}`;
const helperText = '버튼을 누르면 새 챗이 열리고, 전월 리포트 지시문이 자동 입력됩니다.';

const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6">
  <h2 style="margin:0 0 10px">📩 월간 아이웨어 리포트 준비 — ${ym}</h2>
  <p style="color:#555;margin:0 0 12px">${helperText}</p>
  <p style="margin:16px 0">
    <a href="${chatUrl}"
       style="background:#0ea5e9;color:#fff;padding:10px 18px;text-decoration:none;border-radius:8px;display:inline-block;">
      챗 열기
    </a>
  </p>
  <details style="margin-top:12px">
    <summary style="cursor:pointer;color:#555">요약 대상 매거진 보기</summary>
    <ul style="margin:8px 0 0 16px">
      <li>US: Vision Monday</li>
      <li>EU: Eyestylist, Eyebook, Spectr Magazine, The Eyewear Forum</li>
      <li>Japan: Eyewear Biz, Senken Shimbun, iOFT/Japan Eyewear Awards</li>
      <li>HK/TW: V.MAGAZINE, HKTDC/HK Optical Fair</li>
      <li>Fashion: GQ, Vogue</li>
    </ul>
  </details>
  <p style="color:#777;font-size:12px;margin-top:16px">— 자동 알림 메일</p>
</div>
`;

const text = [
  `📩 월간 아이웨어 리포트 준비 — ${ym}`,
  '',
  helperText,
  chatUrl,
  '',
  '대상: Vision Monday / Eyestylist / Eyebook / Spectr / The Eyewear Forum / Eyewear Biz / Senken / iOFT / V.MAGAZINE / HKTDC / GQ / Vogue',
  '— 자동 알림 메일'
].join('\n');

(async () => {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      text,
      html
    });
    console.log('[OK] Alarm mail sent:', info.messageId || info.response || info);
  } catch (err) {
    console.error('[ERROR] Failed to send alarm mail:', err?.message || err);
    process.exit(1);
  }
})();
