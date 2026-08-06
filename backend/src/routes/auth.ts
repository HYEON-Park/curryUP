import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Router, type Request } from "express";
import { authMiddleware, signToken } from "../auth/jwt.js";
import { isMailConfigured, sendVerificationEmail } from "../auth/mailer.js";
import {
  findUserByEmail,
  findUserByVerifyToken,
  getProfile,
  isProfileConfigured,
  saveUser,
  setLastLogin,
  updateUser,
  type User,
} from "../data/store.js";
import { getBaseUrl } from "../utils/network.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 10;
const PORT = process.env.PORT || 4000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

function makeVerification(): { token: string; expires: string } {
  return { token: randomUUID(), expires: new Date(Date.now() + VERIFY_TTL_MS).toISOString() };
}

function verifyLink(token: string): string {
  return `${getBaseUrl(PORT)}/api/auth/verify?token=${token}`;
}

// 이 로그인 요청이 로컬(localhost/LAN)에서 왔는지 판별한다.
// 자동 배치는 로컬 로그인 유저만 대상으로 삼으므로(공개 URL/터널 접속은 배치 제외), 이 값을 저장한다.
// - 터널·프록시는 X-Forwarded-* 헤더를 붙이므로 그런 요청은 공개로 간주한다.
// - 그 외에는 Host가 localhost/사설 LAN 대역일 때만 로컬로 본다.
function isLocalRequest(req: Request): boolean {
  if (req.headers["x-forwarded-for"] || req.headers["x-forwarded-host"]) return false;
  const hostname = String(req.headers.host ?? "")
    .toLowerCase()
    .split(":")[0]
    .replace(/^\[|\]$/g, "");
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

// 회원가입: 이메일 중복 검사 → bcrypt 해싱 → users.json 추가 → 인증 메일 발송.
// 인증 전에는 로그인할 수 없다(login에서 차단).
authRouter.post("/signup", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ error: "올바른 이메일 형식이 아닙니다." });
    return;
  }
  // bcrypt는 72바이트에서 잘리므로 최대 길이를 64자로 제한한다.
  if (password.length < 8 || password.length > 64) {
    res.status(400).json({ error: "비밀번호는 8자 이상 64자 이하여야 합니다." });
    return;
  }
  if (await findUserByEmail(email)) {
    res.status(409).json({ error: "이미 가입된 이메일입니다." });
    return;
  }

  const hash = await bcrypt.hash(password, BCRYPT_COST);
  const { token, expires } = makeVerification();
  const user: User = {
    userId: `usr_${Date.now()}`,
    email,
    password: hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    emailVerified: false,
    verifyToken: token,
    verifyExpires: expires,
  };
  await saveUser(user);

  const link = verifyLink(token);
  await sendVerificationEmail(email, link);

  // SMTP 미설정(개발)일 때만 링크를 응답에 실어 프런트에서 바로 눌러 테스트할 수 있게 한다.
  res.status(201).json({ email, needsVerification: true, devLink: isMailConfigured() ? undefined : link });
});

// 로그인: 이메일 조회 → bcrypt.compare → 이메일 인증 확인 → JWT 발급.
authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: "이메일 인증이 필요합니다. 메일의 링크를 확인해주세요.", needsVerification: true });
    return;
  }

  await setLastLogin(user.userId, isLocalRequest(req));
  const token = signToken({ userId: user.userId, email: user.email });
  const hasProfile = isProfileConfigured(await getProfile(user.userId));
  res.json({ token, userId: user.userId, email: user.email, hasProfile });
});

// 이메일 인증 링크 클릭 처리. 성공/실패 후 프런트 로그인 화면으로 리다이렉트한다.
authRouter.get("/verify", async (req, res) => {
  const token = String(req.query.token ?? "");
  const user = token ? await findUserByVerifyToken(token) : undefined;
  const expired = user?.verifyExpires ? new Date(user.verifyExpires).getTime() < Date.now() : true;

  if (!user || expired) {
    res.redirect("/login?verified=0");
    return;
  }
  await updateUser(user.userId, { emailVerified: true, verifyToken: null, verifyExpires: null });
  res.redirect("/login?verified=1");
});

// 인증 메일 재발송. 이메일 존재 여부를 노출하지 않도록 항상 200으로 응답한다.
authRouter.post("/resend", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const user = await findUserByEmail(email);
  if (user && !user.emailVerified) {
    const { token, expires } = makeVerification();
    await updateUser(user.userId, { verifyToken: token, verifyExpires: expires });
    const link = verifyLink(token);
    await sendVerificationEmail(email, link);
    res.json({ ok: true, devLink: isMailConfigured() ? undefined : link });
    return;
  }
  res.json({ ok: true });
});

// 내 정보 + 프로필 작성 여부. 새로고침·URL 직접 진입 시 프런트 라우트 가드가 호출한다.
authRouter.get("/me", authMiddleware, async (req, res) => {
  const { userId, email } = req.user!;
  const hasProfile = isProfileConfigured(await getProfile(userId));
  res.json({ userId, email, hasProfile });
});
