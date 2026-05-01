import { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, ERROR_CODES } from "./config.js";
import { AppError } from "./mimoClient.js";

function assertApiKey() {
  if (!DEEPSEEK_API_KEY) {
    throw new AppError(ERROR_CODES.MISSING_API_KEY, "DEEPSEEK_API_KEY is not configured", 500);
  }
}

function buildBody({ model, messages, stream, params = {} }) {
  const { thinking, reasoning_effort, ...rest } = params;

  const body = { model, messages, stream };

  if (thinking) {
    body.thinking = thinking;
    if (thinking.type === "enabled") {
      body.reasoning_effort = reasoning_effort || "high";
    }
  }
  Object.assign(body, rest);

  return body;
}

export async function chatCompletion({ model, messages, params = {} }) {
  assertApiKey();

  const body = buildBody({ model, messages, stream: false, params });
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || `DeepSeek API returned ${res.status}`;
    throw new AppError(ERROR_CODES.DEEPSEEK_REQUEST_FAILED, msg, 502, res.status);
  }

  return data;
}

export async function chatCompletionStream({ model, messages, params = {} }) {
  assertApiKey();

  const body = buildBody({ model, messages, stream: true, params });
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;

  console.log(`[deepseek-stream] model=${model}, messages=${messages.length}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg;
    try {
      const json = JSON.parse(text);
      msg = json?.error?.message || `DeepSeek API returned ${res.status}`;
    } catch {
      msg = `DeepSeek API returned ${res.status}`;
    }
    throw new AppError(ERROR_CODES.DEEPSEEK_REQUEST_FAILED, msg, 502, res.status);
  }

  return res.body;
}
