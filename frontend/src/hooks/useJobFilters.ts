import { useMemo, useState } from "react";
import type { JobPosting } from "../types";
import { parseMatchOverall } from "../utils/matchReport";

// 매칭률 임계값(이상). 0 = 전체.
export type MatchThreshold = 0 | 50 | 60 | 70 | 80;

export interface JobFilters {
  searchTerm: string;
  region: string; // "all" | 실제 지역명(job.location)
  matchThreshold: MatchThreshold;
}

const defaultFilters: JobFilters = {
  searchTerm: "",
  region: "all",
  matchThreshold: 0,
};

// 매칭률 파싱값(없으면 -1) — 임계값이 0일 때만 미산정 공고가 통과하도록 한다.
function scoreOf(job: JobPosting): number {
  return parseMatchOverall(job.documents?.matchReport) ?? -1;
}

// 채용공고 목록에 검색어 + 지역 + 매칭률(threshold)을 AND 조합으로 적용한다.
// 지역 옵션은 로드된 목록의 job.location 고유값에서 뽑는다.
export function useJobFilters(jobs: JobPosting[]) {
  const [filters, setFilters] = useState<JobFilters>(defaultFilters);

  const regions = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort(),
    [jobs],
  );

  const filteredJobs = useMemo(() => {
    const term = filters.searchTerm.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch =
        !term ||
        job.company.toLowerCase().includes(term) ||
        job.title.toLowerCase().includes(term) ||
        job.location.toLowerCase().includes(term);
      const matchesRegion = filters.region === "all" || job.location === filters.region;
      const matchesScore = scoreOf(job) >= filters.matchThreshold;
      return matchesSearch && matchesRegion && matchesScore; // AND 조합
    });
  }, [jobs, filters]);

  const setSearchTerm = (searchTerm: string) => setFilters((f) => ({ ...f, searchTerm }));
  const setRegion = (region: string) => setFilters((f) => ({ ...f, region }));
  const setMatchThreshold = (matchThreshold: MatchThreshold) =>
    setFilters((f) => ({ ...f, matchThreshold }));
  const resetFilters = () => setFilters(defaultFilters);

  // 필터가 하나라도 걸려 있는지 — 서버 페이지네이션↔클라이언트 슬라이스 전환 판단용.
  const isFiltering =
    filters.searchTerm.trim() !== "" || filters.region !== "all" || filters.matchThreshold !== 0;

  return {
    filters,
    filteredJobs,
    regions,
    isFiltering,
    setSearchTerm,
    setRegion,
    setMatchThreshold,
    resetFilters,
  };
}
