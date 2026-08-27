import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "../api/client";

// 메일의 재설정 링크(/reset-password?token=...)로 진입한다.
// 로그인 없이 접근 가능해야 하므로 App의 인증 가드 밖(비로그인 라우트)에 둔다.
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8 || password.length > 64) {
      setError("비밀번호는 8자 이상 64자 이하여야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      // 성공하면 로그인 화면으로 보내며 안내 문구를 띄운다(?reset=1).
      navigate("/login?reset=1", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호 재설정에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  // 토큰 없이 직접 들어온 경우.
  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">비밀번호 재설정</h1>
          <p className="auth-error">유효하지 않은 접근입니다. 재설정 메일의 링크로 다시 들어와주세요.</p>
          <button type="button" className="auth-toggle" onClick={() => navigate("/login", { replace: true })}>
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">
          curry<span className="wordmark-up">UP</span>
        </h1>
        <p className="auth-subtitle">새 비밀번호를 설정하세요</p>

        <label className="auth-label">
          새 비밀번호
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={64}
            required
          />
        </label>

        <label className="auth-label">
          새 비밀번호 확인
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            maxLength={64}
            required
          />
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? "변경 중..." : "비밀번호 변경"}
        </button>

        <button type="button" className="auth-toggle" onClick={() => navigate("/login", { replace: true })}>
          로그인으로 돌아가기
        </button>
      </form>
    </div>
  );
}
