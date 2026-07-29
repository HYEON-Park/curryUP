import nodemailer, { type Transporter } from "nodemailer";

// SMTP 설정은 .env로 분리 관리한다:
//   SMTP_HOST, SMTP_PORT(기본 587), SMTP_SECURE(true면 465 SSL), SMTP_USER, SMTP_PASS, MAIL_FROM
// Gmail을 쓸 경우: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true,
//   SMTP_USER=<gmail 주소>, SMTP_PASS=<앱 비밀번호(2단계 인증 후 발급)>
// 미설정 시에는 실제 발송 없이 인증 링크를 서버 로그에 출력하는 개발용 폴백으로 동작한다.

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  if (!isMailConfigured()) {
    // 개발용 폴백: 실제 발송 없이 링크만 남긴다. .env에 SMTP를 설정하면 실제 메일이 나간다.
    console.log(`[mailer] SMTP 미설정 — 인증 메일 미발송. 인증 링크(${to}): ${link}`);
    return;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to,
    subject: "[curryUP] 이메일 인증을 완료해주세요",
    text: `아래 링크를 눌러 이메일 인증을 완료해주세요 (24시간 내 유효):\n\n${link}\n\n본인이 요청하지 않았다면 무시하세요.`,
    html: `<p>아래 버튼을 눌러 이메일 인증을 완료해주세요 <b>(24시간 내 유효)</b>.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#3f6fd1;color:#fff;text-decoration:none;border-radius:6px">이메일 인증하기</a></p>
<p>버튼이 안 되면 이 링크를 브라우저에 붙여넣으세요:<br><a href="${link}">${link}</a></p>
<p style="color:#888;font-size:12px">본인이 요청하지 않았다면 무시하세요.</p>`,
  });
}
