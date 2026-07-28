import { fetchProfile } from "../api/client";
import type { UserProfile } from "../types";

// 배치 실행에 필요한 필수값(희망 직무 카테고리 ≥1, 경력 년차)이 채워졌는지 판정한다.
// 백엔드 store.isProfileConfigured와 동일 규칙.
export function isProfileConfigured(profile: UserProfile): boolean {
  return (
    profile.yearsOfExperience !== null &&
    Array.isArray(profile.desiredRoleCategories) &&
    profile.desiredRoleCategories.length > 0
  );
}

// 프로필 필수값 미작성 시 배치 실행을 막는다.
// 미작성이면 "프로필을 먼저 작성해주세요." alert 후 확인 시 프로필 화면으로 이동한다.
export async function ensureProfileOrRedirect(
  navigate: (path: string) => void
): Promise<boolean> {
  const profile = await fetchProfile();
  if (isProfileConfigured(profile)) return true;
  window.alert("프로필을 먼저 작성해주세요.");
  navigate("/profile");
  return false;
}
