import { DIGITALOCEAN_API_KEY, DIGITALOCEAN_BASE_URL, ERROR_CODES } from "./config.js";
import { AppError } from "./mimoClient.js";

const MAX_COMPLETION_TOKENS = 16_384;

function assertApiKey() {
  if (!DIGITALOCEAN_API_KEY) {
    throw new AppError(ERROR_CODES.MISSING_API_KEY, "DIGITALOCEAN_API_KEY is not configured", 500);
  }
}

function buildBody({ model, messages, stream, params = {} }) {
  const body = { model, messages, stream };
  Object.assign(body, params);
  const requestedMax = body.max_completion_tokens ?? body.max_tokens;
  if (requestedMax > MAX_COMPLETION_TOKENS) {
    body.max_completion_tokens = MAX_COMPLETION_TOKENS;
    delete body.max_tokens;
  }
  return body;
}

function parseError(text, status) {
  try {
    const json = JSON.parse(text);
    return json?.error?.message || json?.message || `DigitalOcean API returned ${status}`;
  } catch {
    return text || `DigitalOcean API returned ${status}`;
  }
}

export async function chatCompletion({ model, messages, params = {} }) {
  assertApiKey();

  const body = buildBody({ model, messages, stream: false, params });
  const url = `${DIGITALOCEAN_BASE_URL}/v1/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIGITALOCEAN_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new AppError(
      ERROR_CODES.DIGITALOCEAN_REQUEST_FAILED,
      parseError(text, res.status),
      502,
      res.status
    );
  }

  return text ? JSON.parse(text) : null;
}

export async function chatCompletionStream({ model, messages, params = {} }) {
  assertApiKey();

  const body = buildBody({ model, messages, stream: true, params });
  const url = `${DIGITALOCEAN_BASE_URL}/v1/chat/completions`;

  console.log(`[digitalocean-stream] model=${model}, messages=${messages.length}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DIGITALOCEAN_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new AppError(
      ERROR_CODES.DIGITALOCEAN_REQUEST_FAILED,
      parseError(text, res.status),
      502,
      res.status
    );
  }

  return res.body;
}
