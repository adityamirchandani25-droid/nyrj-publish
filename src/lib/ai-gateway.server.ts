type AiGatewayConfig = {
  endpoint: string;
  moderationEndpoint: string;
  apiKey: string;
  model: string;
  moderationModel: string;
};

/** Server-only configuration for any OpenAI-compatible chat-completions API. */
export function getAiGatewayConfig(): AiGatewayConfig {
  const baseUrl = (process.env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";
  const moderationModel = process.env.AI_MODERATION_MODEL?.trim() || "omni-moderation-latest";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY must be configured on the server.");
  }

  return {
    endpoint: `${baseUrl}/chat/completions`,
    moderationEndpoint: `${baseUrl}/moderations`,
    apiKey,
    model,
    moderationModel,
  };
}
