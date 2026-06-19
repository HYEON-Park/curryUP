import type { JobPosting, UserProfile } from "../types.js";

type MatchableFields = Pick<JobPosting, "requiredYears" | "skills" | "roleCategory">;

function careerMatches(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.yearsOfExperience === null) return true;
  if (posting.requiredYears === null) return true;
  const { min, max } = posting.requiredYears;
  return profile.yearsOfExperience >= min - 2 && profile.yearsOfExperience <= max + 2;
}

function skillsMatch(profile: UserProfile, posting: MatchableFields): boolean {
  if (profile.skills.length === 0) return true;
  if (posting.skills.length === 0) return true;
  const profileSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const overlap = posting.skills.filter((s) => profileSkills.has(s.toLowerCase()));
  return overlap.length / posting.skills.length >= 0.5;
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

export function isMatch(profile: UserProfile, posting: MatchableFields): boolean {
  return careerMatches(profile, posting) && skillsMatch(profile, posting) && roleMatches(profile, posting);
}

export function filterMatches<T extends MatchableFields>(profile: UserProfile, postings: T[]): T[] {
  return postings.filter((posting) => isMatch(profile, posting));
}
