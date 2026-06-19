import { generate } from "./ollamaClient.js";

// PRD 4.1: 진부한 AI 단어는 절대 쓰지 않는다.
// 로컬 모델에게 재작성을 맡기면 언어가 섞이는 등 신뢰성 문제가 있어,
// 결정론적 치환으로 확실하게 제거한다. 접미사가 붙은 형태를 먼저 치환해야
// 어색한 결과("혁신인" 등)가 남지 않는다.
const REPLACEMENTS: [RegExp, string][] = [
  [/열정적인/g, "성실한"],
  [/열정적으로/g, "성실하게"],
  [/열정/g, "노력"],
  [/혁신적인/g, "참신한"],
  [/혁신적으로/g, "참신하게"],
  [/혁신/g, "변화"],
  [/시너지/g, "협업 효과"],
];

export function stripBannedWords(text: string): string {
  return REPLACEMENTS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
}

export async function generateClean(system: string, prompt: string): Promise<string> {
  const result = await generate(system, prompt);
  return stripBannedWords(result);
}
