import { MIMO_API_KEY, MIMO_BASE_URL, DEFAULT_PARAMS, ERROR_CODES } from "./config.js";

class AppError extends Error {
  constructor(code, message, status = 400, providerStatus = null) {
    super(message);
    this.code = code;
    this.status = status;
    this.providerStatus = providerStatus;
  }
}

export { AppError };

export async function chatCompletion({ model, messages, params = {} }) {
  if (!MIMO_API_KEY) {
    throw new AppError(ERROR_CODES.MISSING_API_KEY, "MIMO_API_KEY is not configured", 500);
  }

  const body = {
    model,
    messages,
    stream: false,
    ...DEFAULT_PARAMS,
    ...params,
  };

  const url = `${MIMO_BASE_URL}/chat/completions`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": MIMO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message || `MiMo API returned ${res.status}`;
    throw new AppError(ERROR_CODES.MIMO_REQUEST_FAILED, msg, 502, res.status);
  }

  return data;
}

export async function chatCompletionStream({ model, messages, params = {} }) {
  if (!MIMO_API_KEY) {
    throw new AppError(ERROR_CODES.MISSING_API_KEY, "MIMO_API_KEY is not configured", 500);
  }

  const body = {
    model,
    messages,
    stream: true,
    ...DEFAULT_PARAMS,
    ...params,
  };

  const url = `${MIMO_BASE_URL}/chat/completions`;
  console.log(`[mimo-stream] model=${model}, messages=${messages.length}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": MIMO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg;
    try {
      const json = JSON.parse(text);
      msg = json?.error?.message || `MiMo API returned ${res.status}`;
    } catch {
      msg = `MiMo API returned ${res.status}`;
    }
    throw new AppError(ERROR_CODES.MIMO_REQUEST_FAILED, msg, 502, res.status);
  }

  return res.body;
}
