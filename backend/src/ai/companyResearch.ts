import { generate } from "./ollamaClient.js";
import { webSearch } from "./webSearch.js";

const NO_RESEARCH_FALLBACK = "조사된 회사 정보 없음 (검색 결과를 가져오지 못했습니다)";

export async function researchCompany(companyName: string): Promise<string> {
  let results: { title: string; snippet: string }[] = [];
  try {
    results = await webSearch(`${companyName} 최근 뉴스 투자 유치 경영 전략`);
  } catch (error) {
    console.warn(`Web search failed for "${companyName}":`, error);
  }

  if (results.length === 0) return NO_RESEARCH_FALLBACK;

  const rawSnippets = results.map((r) => `- ${r.title}: ${r.snippet}`).join("\n");

  return generate(
    "너는 채용 지원자를 위해 회사 정보를 간단히 요약해주는 리서치 보조원이다.",
    `아래 검색 결과를 보고 "${companyName}"의 최근 뉴스, 투자 유치 현황, 경영 전략과 관련된 핵심 내용만 3~5줄로 요약해줘. 관련 없는 내용은 무시해.\n\n${rawSnippets}`
  );
}
