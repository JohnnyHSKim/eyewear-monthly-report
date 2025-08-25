// scripts/send-report.js
// 최소 동작: SMTP로 테스트 메일을 발송한다.
// (전월 요약 자동화는 나중에 이 파일을 확장)

import nodemailer from 'nodemailer';

// GitHub Actions에서 주입되는 환경변수
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  EMAIL_TO
} = process.env;

// 기본 검증
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[ERROR] Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}
requireEnv('SMTP_HOST');
requireEnv('SMTP_PORT');
requireEnv('SMTP_USER');
requireEnv('SMTP_PASS');
requireEnv('EMAIL_FROM');
requireEnv('EMAIL_TO');

// 포트/보안 설정
const port = Number(SMTP_PORT);
const isSecure = port === 465; // 465=SSL, 587=STARTTLS

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: isSecure,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

const subject = `Eyewear Monthly – 테스트 메일`;
const text = [
  '안녕하세요,',
  '',
  '이 메일은 GitHub Actions에서 SMTP 설정이 정상인지 확인하기 위한 테스트입니다.',
  '워크플로가 정상 동작하면 매월 1일 09:30 요약 → 10:00 발송으로 전환할 수 있습니다.',
  '',
  '- FROM: ' + EMAIL_FROM,
  '- TO: ' + EMAIL_TO,
  '',
  '정상 수신되면 알려주세요.'
].join('\n');

(async () => {
  try {
    const info = await transporter.sendMail({
      from: EMAIL_FROM,
      to: EMAIL_TO,
      subject,
      text
    });
    console.log('[OK] Mail sent:', info.messageId || info.response || info);
  } catch (err) {
    console.error('[ERROR] Failed to send mail:', err?.message || err);
    process.exit(1);
  }
})();
