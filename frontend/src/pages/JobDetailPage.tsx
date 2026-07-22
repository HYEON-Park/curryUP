import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJobDetail } from "../api/client";
import { MatchReport } from "../components/MatchReport";
import type { JobPosting } from "../types";
import { resolveMatchReport } from "../utils/matchReport";

const DOC_TABS = ["matchReport", "coverLetter", "intro", "workExperience"] as const;
type DocTab = (typeof DOC_TABS)[number];
// 문서 탭(documents 기반)에 더해, 크롤링한 모집공고 원문을 보는 'posting' 탭을 맨 뒤에 둔다.
type Tab = DocTab | "posting";

const TAB_LABELS: Record<Tab, string> = {
  matchReport: "매칭표",
  coverLetter: "자기소개서",
  intro: "소개",
  workExperience: "경력사항",
  posting: "공고",
};

// 진입 시 열 탭 + 탭 버튼 순서. 문서 탭 우선(매칭표가 먼저), 공고는 맨 뒤.
function getAvailableTabs(job: JobPosting): Tab[] {
  // 매칭표는 매칭률 조회 배치가 채운 top-level matchReport만 있어도 노출한다(전체 문서 작성 전 미리보기).
  const docTabs = DOC_TABS.filter((tab) =>
    tab === "matchReport" ? Boolean(resolveMatchReport(job)) : job.documents?.[tab]
  );
  return [...docTabs, ...(job.postingBody ? (["posting"] as const) : [])];
}

export function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<JobPosting | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchJobDetail(id).then((j) => {
      setJob(j);
      // 내용이 있는 첫 번째 탭을 기본으로 연다. 문서 탭 우선이라 매칭표가 있으면 매칭표가 열린다.
      setActiveTab(getAvailableTabs(j)[0] ?? null);
    });
  }, [id]);

  if (!job) return <p>불러오는 중...</p>;

  const availableTabs = getAvailableTabs(job);

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

      {activeTab ? (
        <>
          <div className="tabs">
            {availableTabs.map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? "active" : ""}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          {activeTab === "matchReport" ? (
            <MatchReport text={resolveMatchReport(job) ?? ""} />
          ) : activeTab === "posting" ? (
            <pre className="doc-content">{job.postingBody}</pre>
          ) : (
            <pre className="doc-content">{job.documents?.[activeTab]}</pre>
          )}
        </>
      ) : (
        <p>표시할 내용이 없습니다.</p>
      )}
    </div>
  );
}
