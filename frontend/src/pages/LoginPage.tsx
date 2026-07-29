import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoginError, resendVerification, signup } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type Mode = "login" | "signup";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const verified = searchParams.get("verified"); // "1" 성공 / "0" 실패

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 이메일 인증 대기 화면 상태(가입 직후 or 미인증 로그인 시도 시).
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 8 || password.length > 64) {
          setError("비밀번호는 8자 이상 64자 이하여야 합니다.");
          return;
        }
        const { devLink } = await signup(email, password);
        setPendingEmail(email);
        setDevLink(devLink ?? null);
        return;
      }
      const me = await login(email, password);
      navigate(me.hasProfile ? "/" : "/profile/setup", { replace: true });
    } catch (err) {
      if (err instanceof LoginError && err.needsVerification) {
        // 미인증 계정 로그인 시도 → 인증 대기 화면으로.
        setPendingEmail(email);
        setDevLink(null);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "요청에 실패했습니다.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!pendingEmail) return;
    setResendMsg(null);
    setBusy(true);
    try {
      const { devLink } = await resendVerification(pendingEmail);
      setDevLink(devLink ?? null);
      setResendMsg("인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.");
    } finally {
      setBusy(false);
    }
  }

  // ─── 이메일 인증 대기 화면 ───────────────────────────────────────────────
  if (pendingEmail) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">이메일 인증</h1>
          <p className="auth-subtitle">
            <b>{pendingEmail}</b> 로 인증 메일을 보냈습니다.
            <br />
            메일의 링크를 클릭하면 인증이 완료됩니다.
          </p>

          {devLink && (
            <p className="auth-devlink">
              (개발용) SMTP 미설정 상태입니다. 아래 링크로 바로 인증하세요:
              <br />
              <a href={devLink}>인증 링크 열기</a>
            </p>
          )}

          {resendMsg && <p className="auth-notice">{resendMsg}</p>}

          <button type="button" className="auth-submit" onClick={handleResend} disabled={busy}>
            {busy ? "발송 중..." : "인증 메일 다시 보내기"}
          </button>
          <button
            type="button"
            className="auth-toggle"
            onClick={() => {
              setPendingEmail(null);
              setMode("login");
              setResendMsg(null);
            }}
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // ─── 로그인 / 회원가입 폼 ────────────────────────────────────────────────
  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">
          curry<span className="wordmark-up">UP</span>
        </h1>
        <p className="auth-subtitle">{mode === "login" ? "이메일로 로그인" : "이메일로 회원가입"}</p>

        {verified === "1" && <p className="auth-notice">이메일 인증이 완료되었습니다. 로그인해주세요.</p>}
        {verified === "0" && <p className="auth-error">인증 링크가 유효하지 않거나 만료되었습니다. 다시 시도해주세요.</p>}

        <label className="auth-label">
          이메일
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="auth-label">
          비밀번호
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={64}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>

        <button
          type="button"
          className="auth-toggle"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
        >
          {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
        </button>
      </form>
    </div>
  );
}
