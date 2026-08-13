import express, { Router } from "express";
import { authMiddleware } from "../auth/jwt.js";
import { getProfile, isProfileConfigured, saveProfile } from "../data/store.js";
import { parseResumePdf } from "../services/resumeParser.js";

export const profileRouter = Router();
profileRouter.use(authMiddleware);

// PDF 이력서 업로드 → CLI 파싱 → 폼 주입용 JSON 반환(저장은 사용자가 검토 후 별도 PUT).
// PDF는 application/pdf 원본 바이너리로 받는다(전역 express.json은 content-type 불일치라
// 건드리지 않음). base64 없이 raw 파서로 Buffer를 얻어 임시 파일→CLI로 넘긴다.
profileRouter.post(
  "/parse-pdf",
  express.raw({ type: "application/pdf", limit: "20mb" }),
  async (req, res) => {
    const buffer = req.body as Buffer;
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      res.status(400).json({ error: "PDF 파일이 필요합니다." });
      return;
    }
    try {
      const parsed = await parseResumePdf(buffer);
      res.json(parsed);
    } catch (error) {
      console.error("[parse-pdf] 실패:", error);
      res.status(500).json({ error: "PDF 파싱에 실패했습니다. 다시 시도해주세요." });
    }
  }
);

profileRouter.get("/", async (req, res) => {
  res.json(await getProfile(req.user!.userId));
});

profileRouter.put("/", async (req, res) => {
  // 필수값(희망 직무 카테고리 ≥1, 경력 년차) 방어 — 프런트 검증을 우회한 저장도 막는다.
  if (!isProfileConfigured(req.body)) {
    res.status(400).json({ error: "필수 항목(희망 직무 카테고리, 경력 년차)을 입력해주세요." });
    return;
  }
  const updated = await saveProfile(req.user!.userId, req.body);
  res.json(updated);
});
