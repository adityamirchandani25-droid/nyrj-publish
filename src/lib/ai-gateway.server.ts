type AiGatewayConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

/** Server-only configuration for any OpenAI-compatible chat-completions API. */
export function getAiGatewayConfig(): AiGatewayConfig {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be configured on the server.");
  }

  return {
    endpoint: `${baseUrl}/chat/completions`,
    apiKey,
    model,
  };
}
