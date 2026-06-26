import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJobDetail } from "../api/client";
import type { JobPosting } from "../types";

const TABS = ["coverLetter", "intro", "workExperience"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  coverLetter: "자기소개서",
  intro: "소개",
  workExperience: "경력사항",
};

export function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("coverLetter");

  useEffect(() => {
    if (id) fetchJobDetail(id).then(setJob);
  }, [id]);

  if (!job) return <p>불러오는 중...</p>;

  return (
    <div className="job-detail">
      <button className="back-to-list" onClick={() => navigate(-1)}>
        목록으로
      </button>
      <h2>
        {job.company} — {job.title}
      </h2>
      <p>{job.location}</p>
      <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="source-link">
        원본 공고 보기
      </a>

      {job.documents ? (
        <>
          <div className="tabs">
            {TABS.map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <pre className="doc-content">{job.documents[activeTab]}</pre>
        </>
      ) : (
        <p>아직 생성된 문서가 없습니다.</p>
      )}
    </div>
  );
}
