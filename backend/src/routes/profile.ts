import { Router } from "express";
import { getProfile, isProfileConfigured, saveProfile } from "../data/store.js";

export const profileRouter = Router();

profileRouter.get("/", async (_req, res) => {
  res.json(await getProfile());
});

profileRouter.put("/", async (req, res) => {
  // 필수값(희망 직무 카테고리 ≥1, 경력 년차) 방어 — 프런트 검증을 우회한 저장도 막는다.
  if (!isProfileConfigured(req.body)) {
    res.status(400).json({ error: "필수 항목(희망 직무 카테고리, 경력 년차)을 입력해주세요." });
    return;
  }
  const updated = await saveProfile(req.body);
  res.json(updated);
});
