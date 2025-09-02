// scripts/send-report.js
// 매월 1일 09:30 KST에 “챗 열고 요약 시작하세요” 알람 메일만 전송

import nodemailer from 'nodemailer';

// 필수 환경변수 체크
const need = ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','EMAIL_FROM','EMAIL_TO'];
for (const k of need) {
  if (!process.env[k]) {
    console.error(`[ERROR] Missing env: ${k}`);
    process.exit(1);
  }
}
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, EMAIL_TO } = process.env;

// SMTP 트랜스포터
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

// 메일 콘텐츠 (심플 알림 + 버튼)
const subject = `Eyewear 월간 리포트 알림`;
const chatUrl = 'https://chat.openai.com/'; // 새 챗 시작 링크(딥링크 불가)
const helperText = '챗이 열리면 “이번 달 요약 시작”이라고 입력해 주세요.';

const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6">
  <h2 style="margin:0 0 8px">📩 월간 아이웨어 리포트 준비</h2>
  <p style="color:#555;margin:0 0 12px">아래 버튼을 눌러 챗을 열고, <b>이번 달 요약 시작</b>이라고 말씀해 주세요.<br/>요약 대상 매거진 전체를 한국어로 정리해 드립니다.</p>
  <p style="margin:16px 0">
    <a href="${chatUrl}" 
       style="background:#0ea5e9;color:#fff;padding:10px 18px;text-decoration:none;border-radius:8px;display:inline-block;">
      챗 열기
    </a>
  </p>
  <p style="color:#666;font-size:13px;margin:8px 0 0">${helperText}</p>
  <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
  <details>
    <summary style="cursor:pointer;color:#555">요약 대상 매거진(클릭하여 보기)</summary>
    <ul style="margin:8px 0 0 16px">
      <li>Vision Monday (US)</li>
      <li>Eyestylist, Eyebook, Spectr Magazine, TEF (EU)</li>
      <li>Eyewear Biz, iOFT/Japan Eyewear Awards, Senken Shimbun (Japan)</li>
      <li>V.MAGAZINE, HKTDC/홍콩 국제안경전 (HK/대만)</li>
      <li>GQ, Vogue (패션)</li>
    </ul>
  </details>
  <p style="color:#777;font-size:12px;margin-top:16px">— 자동 알림 메일</p>
</div>
`;

const text = [
  '📩 월간 아이웨어 리포트 준비',
  '',
  '아래 링크로 챗을 열고 “이번 달 요약 시작”이라고 입력해 주세요.',
  chatUrl,
  '',
  '요약 대상: Vision Monday / Eyestylist / Eyebook / Spectr / TEF / Eyewear Biz / iOFT / Senken / V.MAGAZINE / HKTDC / GQ / Vogue',
  '',
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
