/** Amazon Nova 2 Lite via Bedrock Converse — IAM only; stub when Bedrock unavailable. */

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ReasoningEffort = "low" | "medium" | "high";

export type ConverseInput = {
  system: string;
  messages: ChatMessage[];
  modelId?: string;
  maxTokens?: number;
  /** Nova 2 Lite extended thinking. Default on / low. */
  reasoningEffort?: ReasoningEffort;
};

export type ConverseResult = {
  text: string;
  modelId: string;
  stub: boolean;
};

const DEFAULT_MODEL =
  process.env.ALENA_MODEL_ID ??
  process.env.ZARA_MODEL_ID ??
  "global.amazon.nova-2-lite-v1:0";

const DEFAULT_REASONING: ReasoningEffort = (() => {
  const raw = (process.env.ALENA_REASONING_EFFORT ?? "low").toLowerCase();
  if (raw === "medium" || raw === "high" || raw === "low") return raw;
  return "low";
})();

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

/** Yield assistant text deltas. Stub path chunks the canned reply so the UI still streams. */
export async function* converseNovaStream(
  input: ConverseInput,
): AsyncGenerator<{ text: string; modelId: string; stub: boolean; done?: boolean }> {
  const modelId = input.modelId ?? DEFAULT_MODEL;
  if (process.env.BEDROCK_ENABLED === "true") {
    try {
      for await (const text of invokeBedrockStream(input, modelId)) {
        if (text) yield { text, modelId, stub: false };
      }
      return;
    } catch (err) {
      console.error("Bedrock stream failed; falling back to stub", err);
    }
  }
  const full = stubReply(input);
  const parts = full.match(/.{1,80}(\s|$)/g) ?? [full];
  for (const part of parts) {
    yield { text: part, modelId, stub: true };
  }
}

/** Minimal shapes so we typecheck without installing the Bedrock SDK locally. */
type BedrockContentBlock = { text?: string };
type BedrockConverseResponse = {
  output?: { message?: { content?: BedrockContentBlock[] } };
};
type BedrockStreamEvent = {
  contentBlockDelta?: { delta?: { text?: string } };
};

type BedrockRuntimeModule = {
  BedrockRuntimeClient: new (cfg: { region: string }) => {
    send: (cmd: unknown) => Promise<
      BedrockConverseResponse & {
        stream?: AsyncIterable<BedrockStreamEvent>;
      }
    >;
  };
  ConverseCommand: new (input: Record<string, unknown>) => unknown;
  ConverseStreamCommand: new (input: Record<string, unknown>) => unknown;
};

function converseArgs(input: ConverseInput, modelId: string): Record<string, unknown> {
  const effort = input.reasoningEffort ?? DEFAULT_REASONING;
  return {
    modelId,
    system: [{ text: input.system }],
    messages: input.messages.map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    inferenceConfig: {
      // Reasoning tokens count against maxTokens. Callers still pass 220–600 for
      // short answers; floor so low thinking does not eat the whole budget.
      maxTokens: Math.max(input.maxTokens ?? 2048, 2048),
      temperature: 0.4,
    },
    additionalModelRequestFields: {
      reasoningConfig: {
        type: "enabled",
        maxReasoningEffort: effort,
      },
    },
  };
}

async function loadBedrock(): Promise<BedrockRuntimeModule> {
  // Dynamic import keeps local builds working without AWS SDK installed.
  return Function('return import("@aws-sdk/client-bedrock-runtime")')() as Promise<BedrockRuntimeModule>;
}

async function invokeBedrock(
  input: ConverseInput,
  modelId: string,
): Promise<string> {
  const mod = await loadBedrock();
  const client = new mod.BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });
  const res = await client.send(new mod.ConverseCommand(converseArgs(input, modelId)));
  const parts = res.output?.message?.content ?? [];
  return parts
    .map((p: BedrockContentBlock) => p.text ?? "")
    .join("")
    .trim();
}

async function* invokeBedrockStream(
  input: ConverseInput,
  modelId: string,
): AsyncGenerator<string> {
  const mod = await loadBedrock();
  const client = new mod.BedrockRuntimeClient({
    region: process.env.AWS_REGION ?? "eu-west-2",
  });
  const res = await client.send(
    new mod.ConverseStreamCommand(converseArgs(input, modelId)),
  );
  if (!res.stream) return;
  for await (const event of res.stream) {
    const text = event.contentBlockDelta?.delta?.text;
    if (text) yield text;
  }
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
