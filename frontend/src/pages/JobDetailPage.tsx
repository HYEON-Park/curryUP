import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteJob, fetchJobDetail, toggleFavorite } from "../api/client";
import { MatchReport } from "../components/MatchReport";
import type { JobPosting } from "../types";

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
  // 내용이 있는 문서 탭만 노출한다. 매칭률 조회 배치가 매칭표만 채운 공고는 나머지 문서 필드가
  // 빈 문자열이라 매칭표 탭만 뜬다.
  const docTabs = DOC_TABS.filter((tab) => job.documents?.[tab]);
  // 공고 탭은 항상 노출한다. 크롤링 원문(postingBody)이 없으면 수집된 공고 정보를 대신 렌더한다.
  return [...docTabs, "posting"];
}

// postingBody 원문이 없을 때, 수집 시 확보한 실제 필드만으로 공고 정보를 구성한다(원문 창작 금지).
function PostingSummary({ job }: { job: JobPosting }) {
  const rows: [string, string][] = [];
  if (job.roleCategory) rows.push(["직무", job.roleCategory]);
  if (job.location) rows.push(["근무지", job.location]);
  if (job.deadline) rows.push(["마감", job.deadline]);
  if (job.requiredYears) {
    const { min, max } = job.requiredYears;
    rows.push(["요구 연차", min === max ? `${min}년` : `${min}~${max}년`]);
  }

  return (
    <div className="posting-summary">
      <p className="posting-summary-note">
        원문이 수집되지 않아 수집된 공고 정보를 표시합니다. 상세 요건은 원본 공고에서 확인하세요.
      </p>
      <dl className="posting-summary-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {job.skills.length > 0 && (
        <div className="posting-summary-skills">
          {job.skills.map((skill) => (
            <span key={skill} className="posting-summary-chip">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
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

  // 즐겨찾기는 대시보드 카드와 같은 필드·같은 엔드포인트(toggleFavorite)를 그대로 재사용한다.
  // 저장 위치가 동일하므로 상세에서 토글해도 목록의 즐겨찾기와 통합 관리된다.
  async function handleFavorite() {
    if (!job) return;
    const result = await toggleFavorite(job.id);
    setJob({ ...job, isFavorite: result.isFavorite });
  }

  // 삭제도 대시보드 카드와 같은 엔드포인트(deleteJob)를 재사용한다. 삭제된 공고는
  // 더 이상 볼 게 없으므로 목록으로 되돌아간다.
  async function handleDelete() {
    if (!job) return;
    await deleteJob(job.id);
    navigate(-1);
  }

  if (!job) return <p>불러오는 중...</p>;

  const availableTabs = getAvailableTabs(job);

  return (
    <div className="job-detail">
      <div className="job-detail-header">
        <button className="job-card-delete" title="삭제" onClick={handleDelete}>
          ×
        </button>
        <button
          className={`job-card-favorite${job.isFavorite ? " favorited" : ""}`}
          title={job.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
          onClick={handleFavorite}
        >
          {job.isFavorite ? "★" : "☆"}
        </button>
        <button className="back-to-list" onClick={() => navigate(-1)}>
          목록으로
        </button>
      </div>
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
            <MatchReport text={job.documents?.matchReport ?? ""} />
          ) : activeTab === "posting" ? (
            job.postingBody ? (
              <pre className="doc-content">{job.postingBody}</pre>
            ) : (
              <PostingSummary job={job} />
            )
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
