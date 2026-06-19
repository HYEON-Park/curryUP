import { useEffect, useState } from "react";
import { fetchProfile, saveProfile } from "../api/client";
import { ROLE_CATEGORIES, ROLE_QUESTIONS, type UserProfile } from "../types";

const EMPTY_PROFILE: UserProfile = {
  yearsOfExperience: null,
  skills: [],
  careerHistory: "",
  certifications: [],
  locations: [],
  desiredRoleCategories: [],
  roleAnswers: {},
  lastProfileUpdate: null,
};

function listToText(list: string[]): string {
  return list.join(", ");
}

function textToList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function ProfileEditPage() {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile().then(setProfile);
  }, []);

  function toggleRoleCategory(category: string) {
    setProfile((prev) => ({
      ...prev,
      desiredRoleCategories: prev.desiredRoleCategories.includes(category)
        ? prev.desiredRoleCategories.filter((c) => c !== category)
        : [...prev.desiredRoleCategories, category],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updated = await saveProfile(profile);
    setProfile(updated);
    setSaved(true);
  }

  const activeQuestions = profile.desiredRoleCategories.flatMap(
    (category) => ROLE_QUESTIONS[category] ?? []
  );

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
      <h2>내 프로필</h2>

      <label>
        경력 (년차)
        <input
          type="number"
          min={0}
          value={profile.yearsOfExperience ?? ""}
          onChange={(e) =>
            setProfile({ ...profile, yearsOfExperience: e.target.value ? Number(e.target.value) : null })
          }
        />
      </label>

      <label>
        기술 스택 (쉼표로 구분)
        <input
          value={listToText(profile.skills)}
          onChange={(e) => setProfile({ ...profile, skills: textToList(e.target.value) })}
        />
      </label>

      <label>
        경력 사항
        <textarea
          rows={4}
          value={profile.careerHistory}
          onChange={(e) => setProfile({ ...profile, careerHistory: e.target.value })}
        />
      </label>

      <label>
        보유 자격증 (쉼표로 구분)
        <input
          value={listToText(profile.certifications)}
          onChange={(e) => setProfile({ ...profile, certifications: textToList(e.target.value) })}
        />
      </label>

      <label>
        근무지 (쉼표로 구분, 예: 서울 강남구)
        <input
          value={listToText(profile.locations)}
          onChange={(e) => setProfile({ ...profile, locations: textToList(e.target.value) })}
        />
      </label>

      <fieldset>
        <legend>희망 직무 카테고리</legend>
        {ROLE_CATEGORIES.map((category) => (
          <label key={category} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={profile.desiredRoleCategories.includes(category)}
              onChange={() => toggleRoleCategory(category)}
            />
            {category}
          </label>
        ))}
      </fieldset>

      {activeQuestions.length > 0 && (
        <fieldset>
          <legend>직무별 추가 질문</legend>
          {activeQuestions.map((question) => (
            <label key={question}>
              {question}
              <input
                value={profile.roleAnswers[question] ?? ""}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    roleAnswers: { ...profile.roleAnswers, [question]: e.target.value },
                  })
                }
              />
            </label>
          ))}
        </fieldset>
      )}

      <button type="submit">저장</button>
      {saved && <span style={{ marginLeft: 8 }}>저장됨</span>}
    </form>
  );
}
