import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

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
