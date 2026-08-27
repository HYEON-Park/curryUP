import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteJob,
  fetchJobDetail,
  fetchJobDocStatus,
  generateJobDocument,
  toggleFavorite,
} from "../api/client";
import { MatchReport } from "../components/MatchReport";
import type { JobPosting } from "../types";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// 탭 버튼 순서. 문서 탭 4개를 항상 노출하고(내용이 없어도 유지 — 사용자가 직접 생성할 수 있게),
// 크롤링한 모집공고 원문을 보는 공고 탭을 맨 뒤에 둔다.
const AVAILABLE_TABS: Tab[] = [...DOC_TABS, "posting"];

// 진입 시 기본으로 열 탭: 내용이 있는 첫 문서 탭, 없으면 공고 탭(항상 볼 내용이 있음).
function initialTab(job: JobPosting): Tab {
  return DOC_TABS.find((tab) => job.documents?.[tab]) ?? "posting";
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
  const location = useLocation();
  const [job, setJob] = useState<JobPosting | null>(null);

  // 목록으로 복귀한다. 대시보드 카드(Link)에서 같은 탭으로 들어오면 앱 내 히스토리가 있어
  // navigate(-1)로 카드가 있던 목록(필터·페이지 상태 유지)으로 되돌아간다. 추천 팝업은 상세를
  // 새 탭(target=_blank)으로 여는데, 새 탭은 앱 내 히스토리가 없어(location.key === "default")
  // navigate(-1)이 무동작이므로 대시보드로 직접 이동한다.
  function goToList() {
    if (location.key === "default") navigate("/");
    else navigate(-1);
  }
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  // 탭별 직접 생성 상태: 현재 생성 중인 탭(문서 종류)과 마지막 에러 문구.
  const [generating, setGenerating] = useState<DocTab | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // 언마운트·공고 전환 시 진행 중인 폴링을 무력화하기 위한 참조.
  const mountedRef = useRef(true);
  const idRef = useRef<string | undefined>(id);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    idRef.current = id;
    if (!id) return;
    // 공고가 바뀌면 이전 공고의 생성 상태·에러를 초기화한다(진행 중 폴링은 idRef 비교로 자동 중단).
    setGenerating(null);
    setGenError(null);
    fetchJobDetail(id).then((j) => {
      setJob(j);
      setActiveTab(initialTab(j));
    });
  }, [id]);

  // 상태 폴링: 완료(hasContent)면 공고를 재조회해 렌더, 실패(running=false·내용 없음)면 에러 표시.
  async function pollGeneration(jobId: string, docType: DocTab) {
    const deadline = Date.now() + 10 * 60 * 1000;
    while (Date.now() < deadline) {
      await sleep(3000);
      if (!mountedRef.current || idRef.current !== jobId) return;
      let status: { running: boolean; hasContent: boolean };
      try {
        status = await fetchJobDocStatus(jobId, docType);
      } catch {
        continue; // 일시 오류는 다음 폴링에서 재시도
      }
      if (!mountedRef.current || idRef.current !== jobId) return;
      if (status.hasContent) {
        const fresh = await fetchJobDetail(jobId);
        if (!mountedRef.current || idRef.current !== jobId) return;
        setJob(fresh);
        setActiveTab(docType);
        setGenerating(null);
        return;
      }
      if (!status.running) {
        setGenerating(null);
        setGenError("생성에 실패했습니다. 다시 시도해주세요.");
        return;
      }
    }
    setGenerating(null);
    setGenError("생성 시간이 초과됐습니다. 다시 시도해주세요.");
  }

  // 중앙 '○○ 생성' 버튼 클릭: 생성 시작 요청 후 상태 폴링을 건다.
  async function handleGenerate(docType: DocTab) {
    if (!job) return;
    setGenError(null);
    try {
      await generateJobDocument(job.id, docType);
    } catch (error) {
      setGenError(
        error instanceof Error && error.message === "BUSY"
          ? "다른 문서 생성이 진행 중입니다. 잠시 후 다시 시도해주세요."
          : "문서 생성 요청에 실패했습니다."
      );
      return;
    }
    setGenerating(docType);
    void pollGeneration(job.id, docType);
  }

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
    goToList();
  }

  if (!job) return <p>불러오는 중...</p>;

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
        <button className="back-to-list" onClick={goToList}>
          목록으로
        </button>
      </div>
      <h2>
        {job.company} — {job.title} <span className="job-rating">({job.rating ?? "—"})</span>
      </h2>
      <div className="job-detail-meta">
        <p>{job.location}</p>
        <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="source-link">
          원본 공고 보기
        </a>
      </div>

      {activeTab ? (
        <>
          <div className="tabs">
            {AVAILABLE_TABS.map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? "active" : ""}
                onClick={() => {
                  setGenError(null);
                  setActiveTab(tab);
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          {activeTab === "posting" ? (
            job.postingBody ? (
              <pre className="doc-content">{job.postingBody}</pre>
            ) : (
              <PostingSummary job={job} />
            )
          ) : job.documents?.[activeTab] ? (
            activeTab === "matchReport" ? (
              <MatchReport text={job.documents?.matchReport ?? ""} />
            ) : (
              <pre className="doc-content">{job.documents?.[activeTab]}</pre>
            )
          ) : (
            // 내용이 없는 문서 탭: 사용자가 직접 즉시 생성한다.
            <div className="doc-generate">
              {generating === activeTab ? (
                <>
                  <button className="doc-generate-btn" disabled>
                    생성 중...
                  </button>
                  <p className="doc-generate-note">
                    Claude가 {TAB_LABELS[activeTab]}을(를) 작성하고 있습니다. 잠시만 기다려주세요.
                  </p>
                </>
              ) : (
                <>
                  <button
                    className="doc-generate-btn"
                    disabled={generating !== null}
                    onClick={() => handleGenerate(activeTab)}
                  >
                    {TAB_LABELS[activeTab]} 생성
                  </button>
                  {genError && <p className="doc-generate-error" role="alert">{genError}</p>}
                </>
              )}
            </div>
          )}
        </>
      ) : (
        <p>표시할 내용이 없습니다.</p>
      )}
    </div>
  );
}
