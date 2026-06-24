import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchProfile } from "../api/client";
import type { UserProfile } from "../types";

function joinOrFallback(list: string[]): string {
  return list.length > 0 ? list.join(", ") : "미입력";
}

export function ProfileViewPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile().then(setProfile);
  }, []);

  if (!profile) {
    return <p>불러오는 중...</p>;
  }

  const isEmpty = profile.lastProfileUpdate === null;

  if (isEmpty) {
    return (
      <div className="profile-view">
        <h2>내 프로필</h2>
        <p>등록된 프로필 정보가 없습니다. 프로필을 작성해주세요.</p>
        <div className="profile-actions">
          <button onClick={() => navigate("/profile/edit")}>등록</button>
        </div>
      </div>
    );
  }

  const roleAnswerEntries = Object.entries(profile.roleAnswers);

  return (
    <div className="profile-view">
      <h2>내 프로필</h2>

      <dl className="profile-fields">
        <div className="profile-field">
          <dt>경력</dt>
          <dd>{profile.yearsOfExperience !== null ? `${profile.yearsOfExperience}년차` : "미입력"}</dd>
        </div>

        <div className="profile-field">
          <dt>기술 스택</dt>
          <dd>{joinOrFallback(profile.skills)}</dd>
        </div>

        <div className="profile-field">
          <dt>경력 사항</dt>
          <dd className="profile-text">{profile.careerHistory || "미입력"}</dd>
        </div>

        <div className="profile-field">
          <dt>보유 자격증</dt>
          <dd>{joinOrFallback(profile.certifications)}</dd>
        </div>

        <div className="profile-field">
          <dt>근무지</dt>
          <dd>{joinOrFallback(profile.locations)}</dd>
        </div>

        <div className="profile-field">
          <dt>희망 직무 카테고리</dt>
          <dd>{joinOrFallback(profile.desiredRoleCategories)}</dd>
        </div>

        {roleAnswerEntries.length > 0 && (
          <div className="profile-field">
            <dt>직무별 추가 질문</dt>
            <dd>
              {roleAnswerEntries.map(([question, answer]) => (
                <p key={question} className="profile-qa">
                  <strong>{question}</strong> {answer}
                </p>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <p className="profile-updated">
        마지막 수정: {new Date(profile.lastProfileUpdate as string).toLocaleString("ko-KR")}
      </p>

      <div className="profile-actions">
        <button onClick={() => navigate("/profile/edit")}>수정</button>
      </div>
    </div>
  );
}
