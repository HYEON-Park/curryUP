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
  // 쉼표로 구분되는 필드는 입력 중에 배열로 왕복 변환하면 트레일링 쉼표가
  // 즉시 사라져 입력이 막힌 것처럼 보인다. 입력 중엔 원본 텍스트를 그대로 두고
  // 저장 시점에만 배열로 변환한다.
  const [skillsText, setSkillsText] = useState("");
  const [certificationsText, setCertificationsText] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchProfile().then((data) => {
      setProfile(data);
      setSkillsText(listToText(data.skills));
      setCertificationsText(listToText(data.certifications));
      setLocationsText(listToText(data.locations));
    });
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
    const updated = await saveProfile({
      ...profile,
      skills: textToList(skillsText),
      certifications: textToList(certificationsText),
      locations: textToList(locationsText),
    });
    setProfile(updated);
    setSkillsText(listToText(updated.skills));
    setCertificationsText(listToText(updated.certifications));
    setLocationsText(listToText(updated.locations));
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
        <input value={skillsText} onChange={(e) => setSkillsText(e.target.value)} />
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
        <input value={certificationsText} onChange={(e) => setCertificationsText(e.target.value)} />
      </label>

      <label>
        근무지 (쉼표로 구분, 예: 서울 강남구)
        <input value={locationsText} onChange={(e) => setLocationsText(e.target.value)} />
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
