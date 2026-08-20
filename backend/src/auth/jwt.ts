import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isUserAdmin } from "../data/store.js";

// JWT_SECRET은 .env로 분리 관리한다(server.ts가 process.loadEnvFile로 로드).
// ESM import는 server.ts의 loadEnvFile()보다 먼저 실행되므로, 시크릿은 모듈 로드 시점이 아니라
// 호출 시점에 lazy로 읽어야 .env 값이 반영된다. 미설정 시 임시 기본값을 쓰되 한 번만 경고한다.
let warnedMissingSecret = false;
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (!warnedMissingSecret) {
    console.warn("[auth] JWT_SECRET 미설정 — 임시 기본값 사용 중. backend/.env에 JWT_SECRET을 설정하세요.");
    warnedMissingSecret = true;
  }
  return "dev-insecure-secret-change-me";
}

const TOKEN_TTL = "7d";

export interface AuthPayload {
  userId: string;
  email: string;
}

// req.user 타입 확장.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL });
}

// Authorization: Bearer <token> 검증 미들웨어. 성공 시 req.user에 { userId, email } 주입.
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, getSecret()) as AuthPayload;
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}

// 관리자 전용 라우트 가드. authMiddleware 뒤에 붙여 req.user가 채워진 상태를 전제로 한다.
// 토큰의 role을 신뢰하지 않고 저장소(users.json)를 매번 확인해, 권한 회수가 즉시 반영되게 한다.
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "인증이 필요합니다." });
    return;
  }
  if (!(await isUserAdmin(req.user.userId))) {
    res.status(403).json({ error: "관리자 권한이 필요합니다." });
    return;
  }
  next();
}
