import type { NextFunction, Request, Response } from "express";

// 인메모리 고정 윈도우 rate limiter.
// 이 앱은 단일 node 프로세스로만 구동되므로(별도 DB·다중 인스턴스 없음) 외부 저장소 없이 Map으로 충분하다.
// 공개 터널(ngrok)로 노출되므로 로그인 무차별 대입·리셋 메일 남용을 막는 게 목적이다.
interface Bucket {
  count: number;
  resetAt: number;
}

// 클라이언트 식별키. ngrok 등 프록시는 실제 클라이언트 IP를 X-Forwarded-For에 실어 보내므로 그 값을
// 우선 쓰고, 없으면 소켓 주소로 폴백한다(로컬 직접 접속). 헤더는 위조 가능하지만, 없는 것보다 낫고
// 로컬/터널 양쪽에서 동작한다.
function clientKey(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  message?: string;
  // true를 반환하는 요청은 카운트하지 않고 통과시킨다(예: 로컬 접속 제외).
  skip?: (req: Request) => boolean;
}) {
  const { windowMs, max, skip } = opts;
  const message = opts.message ?? "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  const hits = new Map<string, Bucket>();

  // 만료된 버킷을 주기적으로 정리해 Map이 무한히 커지지 않게 한다. unref로 이 타이머가 프로세스 종료를 막지 않게 한다.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits) {
      if (bucket.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skip?.(req)) {
      next();
      return;
    }
    const now = Date.now();
    const key = clientKey(req);
    let bucket = hits.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    next();
  };
}
