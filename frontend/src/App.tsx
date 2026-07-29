import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminBatchPage } from "./pages/AdminBatchPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { ProfileViewPage } from "./pages/ProfileViewPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./hooks/useTheme";
import "./App.css";

// 워드마크: curry는 본문색, UP은 accent색(라이트/다크 공통).
function Wordmark() {
  return (
    <span className="wordmark">
      curry<span className="wordmark-up">UP</span>
    </span>
  );
}

// 로그인 이후의 앱 셸(네비 + 보호 라우트).
// 프로필 미작성이면 온보딩(/profile/setup)으로 강제 이동시켜 대시보드 접근을 막는다.
function AuthedApp({ theme, toggle }: { theme: string; toggle: () => void }) {
  const { me, logout } = useAuth();
  const location = useLocation();

  const needsSetup = me !== null && !me.hasProfile;
  if (needsSetup && location.pathname !== "/profile/setup") {
    return <Navigate to="/profile/setup" replace />;
  }

  return (
    <div>
      <header className="topbar">
        <Wordmark />
        <nav className="topbar-tabs">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            대시보드
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? "active" : "")}>
            프로필
          </NavLink>
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>
            관리자
          </NavLink>
        </nav>
        <span className="topbar-spacer" />
        <button
          type="button"
          className="theme-toggle"
          onClick={toggle}
          title={theme === "dark" ? "라이트 모드" : "다크 모드"}
          aria-label="테마 전환"
        >
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <span className="topbar-email">{me?.email}</span>
        <button type="button" className="topbar-logout" onClick={logout}>
          로그아웃
        </button>
      </header>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/profile" element={<ProfileViewPage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/setup" element={<ProfileEditPage />} />
        <Route path="/admin" element={<AdminBatchPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  const { me, loading } = useAuth();
  // 테마는 App 최상위에서 관리해 로그인 화면에도 적용되게 한다(documentElement에 data-theme 반영).
  const { theme, toggle } = useTheme();

  if (loading) {
    return <div className="app-loading">불러오는 중...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={me ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/*"
        element={me ? <AuthedApp theme={theme} toggle={toggle} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

export default App;
