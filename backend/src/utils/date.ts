// "오늘 수집분" 판정 기준을 한 곳에 모아둔다.
//
// Date#toISOString()은 UTC라 KST(UTC+9)에서는 로컬 00:00~09:00 사이에 수집한 공고가
// 전날 날짜로 찍힌다. 그 결과 "오늘 수집분" 필터가 하루 종일 그 공고들을 놓쳤다.
//   예) 2026-07-24 08:55(KST) 수집 → collectedAt "2026-07-23T23:55:05Z"
//       09:00(KST)에 이어 실행된 매칭률 조회 배치의 todayKey는 "2026-07-24"
//       → 앞 10자가 "2026-07-23"인 신규 14건이 전부 대상에서 빠져 배치가 건너뛰어졌고,
//         추천 공고 팝업도 같은 이유로 0건이 되어 뜨지 않았다.
//
// 날짜 판정은 항상 로컬 시간대 기준으로 한다. 이 규칙을 쓰는 곳(매칭률 조회 배치·문서 작성 배치·
// 추천 공고 팝업·오늘 수집분 삭제·runLog의 실행 일자)은 모두 아래 함수를 공유한다.

// Date 또는 ISO 문자열을 로컬 시간대의 "YYYY-MM-DD"로 바꾼다.
export function localDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 오늘(로컬) 날짜키.
export function todayLocalKey(): string {
  return localDateKey(new Date());
}

// collectedAt(ISO 문자열)이 오늘(로컬) 수집분인지 판정한다.
export function isCollectedToday(collectedAt: string): boolean {
  return localDateKey(collectedAt) === todayLocalKey();
}
