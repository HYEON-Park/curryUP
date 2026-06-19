import { Router } from "express";
import { getProfile, saveProfile } from "../data/store.js";

export const profileRouter = Router();

profileRouter.get("/", async (_req, res) => {
  res.json(await getProfile());
});

profileRouter.put("/", async (req, res) => {
  const updated = await saveProfile(req.body);
  res.json(updated);
});
