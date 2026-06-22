import { Link, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import "./App.css";

function App() {
  return (
    <div>
      <nav style={{ display: "flex", gap: 16, padding: 16, alignItems: "center" }}>
        <Link to="/">대시보드</Link>
        <Link to="/profile">프로필</Link>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/profile" element={<ProfileEditPage />} />
      </Routes>
    </div>
  );
}

export default App;
