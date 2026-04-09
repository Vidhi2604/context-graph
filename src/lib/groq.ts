import Groq from "groq-sdk";

let groqInstance: Groq | null = null;

function getGroq(): Groq {
  if (!groqInstance) {
    groqInstance = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqInstance;
}

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const response = await getGroq().chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.1,
    max_tokens: options?.maxTokens ?? 2048,
    response_format: options?.jsonMode ? { type: "json_object" } : undefined,
  });
  return response.choices[0]?.message?.content || "";
}

export async function generateJSON<T>(
  systemPrompt: string,
  userMessage: string
): Promise<T> {
  const raw = await chatCompletion(systemPrompt, userMessage, {
    jsonMode: true,
    temperature: 0.1,
  });
  return JSON.parse(raw) as T;
}
