import { Agent, fetch } from "undici";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:14b";

// CPU-only local inference can take many minutes per response — well past
// undici's default 300s headers/body timeout — so use a generous one here.
const longRunningAgent = new Agent({
  headersTimeout: 1000 * 60 * 20,
  bodyTimeout: 1000 * 60 * 20,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  message: { role: string; content: string };
}

export async function chat(system: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    dispatcher: longRunningAgent,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  return data.message.content.trim();
}

export async function generate(system: string, prompt: string): Promise<string> {
  return chat(system, [{ role: "user", content: prompt }]);
}
