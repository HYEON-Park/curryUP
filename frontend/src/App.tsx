import { Link, Route, Routes } from "react-router-dom";
import { AdminBatchPage } from "./pages/AdminBatchPage";
import { DashboardPage } from "./pages/DashboardPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { ProfileViewPage } from "./pages/ProfileViewPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import "./App.css";

function App() {
  return (
    <div>
      <nav style={{ display: "flex", gap: 16, padding: 16, alignItems: "center" }}>
        <Link to="/">대시보드</Link>
        <Link to="/profile">프로필</Link>
        <Link to="/admin">관리자</Link>
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
