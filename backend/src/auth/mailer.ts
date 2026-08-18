import nodemailer, { type Transporter } from "nodemailer";
import type { JobPosting } from "../types.js";
import { matchOverallPercent } from "../utils/matchReport.js";

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

export interface UpdateSummary {
  collected: number;
  newlyMatched: number;
}

// UPDATE 완료 메일에 함께 실을 "오늘의 추천 공고" 텍스트/HTML 조각을 만든다.
// 추천 목록 판정은 utils/recommendations.getRecommendations가 담당하고, 여기서는 표시만 한다.
// 추천이 없으면 빈 문자열을 반환해 섹션 자체를 생략한다.
function buildRecommendationSection(
  recommendations: JobPosting[],
  dashboardUrl: string,
): { text: string; html: string } {
  if (recommendations.length === 0) return { text: "", html: "" };

  const rows = recommendations.map((job) => {
    const pct = matchOverallPercent(job.documents?.matchReport);
    const badge = pct !== null ? `${pct}%` : "-";
    const link = `${dashboardUrl}/jobs/${job.id}`;
    return { badge, company: job.company, title: job.title, link };
  });

  const text =
    `\n✨ 오늘의 추천 공고 (매칭률 70% 이상) ${rows.length}건\n` +
    rows.map((r) => `- [${r.badge}] ${r.company} — ${r.title}\n  ${r.link}`).join("\n") +
    "\n";

  const html = `<h3 style="margin:24px 0 8px">✨ 오늘의 추천 공고 <span style="color:#888;font-weight:normal">(매칭률 70% 이상 · ${rows.length}건)</span></h3>
<ul style="padding-left:0;list-style:none;margin:0">
${rows
  .map(
    (r) => `  <li style="margin:8px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px">
    <a href="${r.link}" style="text-decoration:none;color:#1f2937">
      <span style="display:inline-block;min-width:44px;padding:2px 8px;margin-right:8px;background:#3f6fd1;color:#fff;border-radius:12px;font-size:12px;text-align:center">${r.badge}</span>
      <b>${r.company}</b> — ${r.title}
    </a>
  </li>`,
  )
  .join("\n")}
</ul>`;

  return { text, html };
}

// 공고 UPDATE(수집 → 매칭률 조회 → 평점 조회) 완료 시 해당 사용자에게 완료 알림 메일을 보낸다.
// 오늘의 추천 공고(매칭률 70% 이상)가 있으면 목록을 함께 싣는다(없으면 섹션 생략).
// SMTP 미설정이면 실제 발송 없이 로그만 남긴다(개발 폴백). 발송 실패가 배치를 막지 않도록
// 호출부에서 결과를 기다리되 예외는 삼킨다.
export async function sendUpdateCompleteEmail(
  to: string,
  summary: UpdateSummary,
  recommendations: JobPosting[] = [],
): Promise<void> {
  const dashboardUrl = process.env.APP_BASE_URL || "http://localhost:4000";
  if (!isMailConfigured()) {
    console.log(
      `[mailer] SMTP 미설정 — UPDATE 완료 메일 미발송(${to}). 수집 ${summary.collected} / 신규매칭 ${summary.newlyMatched} / 추천 ${recommendations.length}`
    );
    return;
  }
  const rec = buildRecommendationSection(recommendations, dashboardUrl);
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await getTransporter().sendMail({
    from,
    to,
    subject: "[curryUP] 공고 UPDATE 완료 알림",
    text:
      `공고 업데이트가 완료되었습니다.\n\n` +
      `- 스캔한 공고: ${summary.collected}건\n` +
      `- 신규 매칭 공고: ${summary.newlyMatched}건\n` +
      `- 매칭률 조회 및 평점 조회까지 완료되었습니다.\n` +
      rec.text +
      `\n대시보드에서 확인하세요:\n${dashboardUrl}\n`,
    html: `<p><b>공고 업데이트가 완료되었습니다.</b></p>
<ul>
  <li>스캔한 공고: <b>${summary.collected}</b>건</li>
  <li>신규 매칭 공고: <b>${summary.newlyMatched}</b>건</li>
  <li>매칭률 조회 및 평점 조회까지 완료되었습니다.</li>
</ul>
${rec.html}
<p style="margin-top:16px"><a href="${dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#3f6fd1;color:#fff;text-decoration:none;border-radius:6px">대시보드 보기</a></p>
<p style="color:#888;font-size:12px">curryUP 공고 자동 수집 알림입니다.</p>`,
  });
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
