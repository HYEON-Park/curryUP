import { NavLink, Route, Routes } from "react-router-dom";
import { AdminBatchPage } from "./pages/AdminBatchPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { ProfileViewPage } from "./pages/ProfileViewPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import "./App.css";

function App() {
  return (
    <div>
      <nav>
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
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/profile" element={<ProfileViewPage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/admin" element={<AdminBatchPage />} />
      </Routes>
    </div>
  );
}

export default App;
