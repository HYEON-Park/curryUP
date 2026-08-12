import type { JobPosting, UserProfile } from "../types.js";

type MatchableFields = Pick<JobPosting, "requiredYears" | "skills" | "roleCategory" | "location">;

function careerMatches(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.yearsOfExperience === null) return true;
  if (posting.requiredYears === null) return true;
  const { min, max } = posting.requiredYears;
  return profile.yearsOfExperience >= min - 2 && profile.yearsOfExperience <= max + 2;
}

function skillsMatch(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.skills.length === 0) return true;
  if (posting.skills.length === 0) return true;
  const postingSkills = new Set(posting.skills.map((s) => s.toLowerCase()));
  const overlap = profile.skills.filter((s) => postingSkills.has(s.toLowerCase()));
  return overlap.length / profile.skills.length >= 0.5;
}

// 직무만 맞고 겹치는 스킬이 하나도 없으면(완전히 다른 기술스택) 관련 없는 공고로 본다.
// 태그가 비어 있어 판단할 데이터가 없는 경우는 배제하지 않는다.
function hasAnySkillOverlap(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.skills.length === 0) return true;
  if (posting.skills.length === 0) return true;
  const postingSkills = new Set(posting.skills.map((s) => s.toLowerCase()));
  return profile.skills.some((s) => postingSkills.has(s.toLowerCase()));
}

// 사람인 등 사이트의 카테고리 표기("백엔드/서버개발")가 프로필 택소노미("백엔드 개발")와
// 정확히 일치하지 않으므로, "/" 또는 공백 앞의 첫 키워드만 비교한다.
function rootKeyword(category: string): string {
  return category.split(/[/\s]/)[0];
}

function roleMatches(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.desiredRoleCategories.length === 0) return true;
  if (!posting.roleCategory) return true;
  const postingRoot = rootKeyword(posting.roleCategory);
  return profile.desiredRoleCategories.some((category) => rootKeyword(category) === postingRoot);
}

function locationMatches(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.locations.length === 0) return true;
  if (!posting.location) return true;
  return profile.locations.some((location) => posting.location.includes(location));
}

export function isMatch(profile: UserProfile, posting: MatchableFields): boolean {
  // 경력/지역은 필수 조건으로 AND. 스킬/직무는 사람인처럼 태그가 거칠게 섞여 있어도
  // 둘 중 하나만 맞아도 충분히 관련 있는 공고로 보고 OR로 비교하되, 겹치는 스킬이
  // 하나도 없으면(기술스택이 완전히 다르면) 직무만 맞아도 제외한다.
  // 단, 프로필에 스킬이 아예 없으면(비IT 직군) skillsMatch가 무조건 통과해 직무를
  // 건너뛰므로, 이 경우 사용자가 고른 대표 직무(roleMatches)를 필수 조건으로 세운다.
  const skillOrRole =
    profile.skills.length === 0
      ? roleMatches(profile, posting)
      : skillsMatch(profile, posting) || roleMatches(profile, posting);
  return (
    careerMatches(profile, posting) &&
    locationMatches(profile, posting) &&
    hasAnySkillOverlap(profile, posting) &&
    skillOrRole
  );
}

export function filterMatches<T extends MatchableFields>(profile: UserProfile, postings: T[]): T[] {
  return postings.filter((posting) => isMatch(profile, posting));
}
