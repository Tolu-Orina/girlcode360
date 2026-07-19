/** Amazon Nova 2 Lite via Bedrock Converse — IAM only; stub when Bedrock unavailable. */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ConverseInput = {
  system: string;
  messages: ChatMessage[];
  modelId?: string;
  maxTokens?: number;
};

export type ConverseResult = {
  text: string;
  modelId: string;
  stub: boolean;
};

const DEFAULT_MODEL =
  process.env.ZARA_MODEL_ID ?? "eu.amazon.nova-2-lite-v1:0";

/**
 * Call Bedrock Converse when BEDROCK_ENABLED=true and AWS SDK is available.
 * Otherwise return a deterministic wellness stub (dev / offline).
 */
export async function converseNova(
  input: ConverseInput,
): Promise<ConverseResult> {
  const modelId = input.modelId ?? DEFAULT_MODEL;
  if (process.env.BEDROCK_ENABLED === "true") {
    try {
      const text = await invokeBedrock(input, modelId);
      return { text, modelId, stub: false };
    } catch (err) {
      console.error("Bedrock invoke failed; falling back to stub", err);
    }
  }
  return {
    text: stubReply(input),
    modelId,
    stub: true,
  };
}

/** Minimal shapes so we typecheck without installing the Bedrock SDK locally. */
type BedrockContentBlock = { text?: string };
type BedrockConverseResponse = {
  output?: { message?: { content?: BedrockContentBlock[] } };
};
type BedrockRuntimeModule = {
  BedrockRuntimeClient: new (cfg: { region: string }) => {
    send: (cmd: unknown) => Promise<BedrockConverseResponse>;
  };
  ConverseCommand: new (input: Record<string, unknown>) => unknown;
};

async function invokeBedrock(
  input: ConverseInput,
  modelId: string,
): Promise<string> {
  // Dynamic import keeps local builds working without AWS SDK installed.
  // Runtime package is optional; resolve via Function so tsc does not require it.
  const mod = (await (Function(
    'return import("@aws-sdk/client-bedrock-runtime")',
  )() as Promise<BedrockRuntimeModule>));
  const client = new mod.BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });
  const res = await client.send(
    new mod.ConverseCommand({
      modelId,
      system: [{ text: input.system }],
      messages: input.messages.map((m) => ({
        role: m.role,
        content: [{ text: m.content }],
      })),
      inferenceConfig: {
        maxTokens: input.maxTokens ?? 800,
        temperature: 0.4,
      },
    }),
  );
  const parts = res.output?.message?.content ?? [];
  return parts
    .map((p: BedrockContentBlock) => p.text ?? "")
    .join("")
    .trim();
}

function stubReply(input: ConverseInput): string {
  const last = [...input.messages].reverse().find((m) => m.role === "user");
  const q = last?.content ?? "";
  return [
    "Thanks for sharing that with me. Based on the wellness context I have, here are some gentle thoughts — not a diagnosis or medical assessment.",
    "",
    q
      ? `You asked about: “${q.slice(0, 160)}${q.length > 160 ? "…" : ""}”. Patterns in logs can help a clinic conversation, but only a qualified clinician can assess what is right for you.`
      : "I can help you reflect on your logs and prepare questions for a clinician.",
    "",
    "If anything feels urgent or unsafe, use your local emergency numbers and seek care straight away.",
    "",
    "This is AI-generated wellness guidance. Consider generating a Doctor Prep Card if you have an appointment coming up.",
  ].join("\n");
}

export { DEFAULT_MODEL };
