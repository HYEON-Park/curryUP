import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_MD_PATH = path.join(__dirname, "..", "..", "..", "SKILL.md");

export async function getCrawlTargetUrls(): Promise<string[]> {
  const raw = await fs.readFile(SKILL_MD_PATH, "utf-8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- http"))
    .map((line) => line.slice(2).trim());
}
