# MiMo Chat UX + API Fix Plan

## 1. Goal

Виправити незручності поточного MiMo Chat після першої реалізації:

- автоперемикання на image-capable model при додаванні зображення;
- зручніше редагування system prompt;
- сильніший, інформативний header;
- компактніший текст повідомлень;
- нормальний focus/hover контур composer;
- вертикально центрована `Send` при багаторядковому input;
- optimistic user message + assistant loading + SSE streaming;
- перевірена відповідність офіційній MiMo OpenAI-compatible документації;
- header status для API, active request і response latency.

## 2. Scope

Змінювати тільки локальний `client/` і `server/`.

Primary files:

- `client/src/components/composer/Composer.tsx`
- `client/src/components/chat/ChatArea.tsx`
- `client/src/components/chat/MessageBubble.tsx`
- `client/src/components/layout/TopBar.tsx`
- `client/src/components/layout/Inspector.tsx`
- `client/src/components/prompts/PromptModal.tsx`
- `client/src/context/AppContext.tsx`
- `client/src/hooks/useChat.ts`
- `client/src/api/client.ts`
- `client/src/types/index.ts`
- `client/src/index.css`
- `server/src/routes/chat.js`
- `server/src/mimoClient.js`
- `server/src/config.js`

Optional new files only if they reduce clutter:

- `client/src/components/layout/ApiStatusBadge.tsx`
- `server/src/routes/health.js`

## 3. Current Findings

- `Composer.tsx` always sends `model: activeSession.model`; backend auto-default works only when no model is passed. Result: image upload with session model `mimo-v2.5-pro` returns `MODEL_DOES_NOT_SUPPORT_IMAGES` instead of switching.
- `server/src/routes/chat.js` currently validates image model but does not auto-switch when requested model is text-only.
- `mimoClient.js` hardcodes `stream: false`; no streaming endpoint exists.
- User message appears only after backend returns full session; UI waits for assistant response before showing user's own message.
- `App.tsx` creates one `useChat()` for `ChatArea` loading and `Composer.tsx` creates another `useChat()` instance. Loading state is local to each hook instance, so `ChatArea` may not reliably show loading for sends started in `Composer`.
- `PromptModal.tsx` uses a small fixed modal textarea (`rows={6}`), with no wide/full-height editor mode.
- `MessageBubble.tsx` uses `text-body`, `p-4/p-5`, `space-y-6`, `max-w-[80%]/[90%]`; visually too large for dense chat reading.
- Composer panel uses generic `focus:ring-0` on textarea and no explicit `focus-within` styling on the outer panel.
- Composer row uses `items-end`; `Send` aligns to textarea bottom when the input grows.
- `TopBar.tsx` only shows title + version; no API health, current model, active work, or latency.
- Docs check: MiMo OpenAI-compatible endpoint, `api-key` auth, `messages[].content[]` image parts, `stream` chunks, usage fields and image-token details are supported by official docs.

## 4. Assumptions

- For text-only sessions, default model remains `mimo-v2.5-pro`.
- For any message with image attachments, app should use `mimo-v2.5` automatically and visibly, even if the session was previously on `mimo-v2.5-pro`.
- Auto-switch should update current session model so the UI and next request do not disagree.
- Streaming should be v1.1-simple: SSE from local backend to browser, no WebSocket.
- Keep JSON storage. No database.
- Do not add a new UI library; current React + Tailwind is enough.

## 5. Success Criteria

- Attaching an image changes the active session model to `mimo-v2.5` before send or at send time.
- Image send never fails because `mimo-v2.5-pro` was still selected.
- System prompt editor opens as a comfortable large modal or editor panel with textarea height near `50-65vh`, save/cancel/delete states, and readable preview/list.
- Header shows app identity, current session/model, API status, active request indicator and last response latency.
- Chat message typography is compact and readable: target body `13-14px`, line-height `1.55-1.65`, less padding.
- Composer focus has a clean `focus-within` border/shadow, no harsh default outline.
- `Send` stays vertically centered relative to composer height while textarea grows.
- User message appears in chat immediately after pressing send.
- Assistant placeholder appears immediately, then streamed tokens update it.
- On stream failure, assistant placeholder becomes an error message and user message remains.
- Build passes: `npm run build` in `client/`.
- Backend starts and non-stream chat still works or is intentionally replaced by stream flow.

## 6. Official MiMo Docs Alignment

Verified against official docs on 2026-04-30:

- Docs index: `https://platform.xiaomimimo.com/llms.txt`
- OpenAI compatibility: `https://platform.xiaomimimo.com/static/docs/api/chat/openai-api.md`
- Image understanding: `https://platform.xiaomimimo.com/static/docs/usage-guide/multimodal-understanding/image-understanding.md`
- Hyperparameters: `https://platform.xiaomimimo.com/static/docs/quick-start/model-hyperparameters.md`
- Pricing/rate limits/model details: `https://platform.xiaomimimo.com/static/docs/pricing.md`
- Error codes: `https://platform.xiaomimimo.com/static/docs/quick-start/error-codes.md`

Required compatibility rules:

- Chat endpoint: `POST https://api.xiaomimimo.com/v1/chat/completions`.
- Auth can use `api-key: $MIMO_API_KEY`; current backend is valid.
- Image input for OpenAI-compatible API uses user content parts:
  - `{ "type": "image_url", "image_url": { "url": "..." } }`
  - `{ "type": "text", "text": "..." }`
- Base64 image must include `data:{MIME_TYPE};base64,...`; current upload return shape matches this.
- Supported image models: `mimo-v2.5`, `mimo-v2-omni`; current v1 should use `mimo-v2.5`.
- Supported image formats: JPEG, PNG, GIF, WebP, BMP.
- Image URL or Base64 single image limit: 50 MB.
- `mimo-v2.5-pro` and `mimo-v2.5` both support streaming output by docs.
- `temperature` range `[0, 1.5]`, default `1.0`; `top_p` range `[0.01, 1.0]`, default `0.95`; current UI ranges are aligned.
- Max output length for `mimo-v2.5-pro` and `mimo-v2.5`: 128K; current max slider `131072` is aligned.
- Usage may include `completion_tokens_details.reasoning_tokens` and `prompt_tokens_details.image_tokens`; keep rendering these when present.

## 7. Implementation Plan

### Step 1 - Centralize Chat Request State

Files:

- `client/src/context/AppContext.tsx`
- `client/src/hooks/useChat.ts`
- `client/src/types/index.ts`

Tasks:

- Move `chatStatus` into shared context: `idle | uploading | sending | streaming | error`.
- Store `lastLatencyMs`, `lastProviderStatus`, `activeRequestStartedAt`, `lastError`.
- Avoid separate `useChat()` loading instances in `App.tsx` and `Composer.tsx`.

Verify:

- `ChatArea`, `Composer`, `TopBar` read the same status.

### Step 2 - Auto-Switch Model for Images

Files:

- `client/src/components/composer/Composer.tsx`
- `client/src/hooks/useSessions.ts`
- `server/src/routes/chat.js`

Tasks:

- When first attachment is added, if active model does not support images, update session model to `mimo-v2.5`.
- Show small inline note near attachment preview: `Image mode: MiMo-V2.5`.
- At send time, derive `effectiveModel = attachments.length ? "mimo-v2.5" : activeSession.model`.
- Backend should also be defensive: if attachments exist and requested model lacks image support, switch to default image model instead of erroring, unless request explicitly sets `strictModel: true`.
- Return `modelUsed` in chat response/session metadata.

Verify:

- Start with `mimo-v2.5-pro`, attach PNG, send. Request uses `mimo-v2.5`.
- Inspector and header show `mimo-v2.5` after attach/send.

### Step 3 - Optimistic User Message

Files:

- `client/src/context/AppContext.tsx`
- `client/src/hooks/useChat.ts`
- `client/src/components/chat/ChatArea.tsx`
- `client/src/types/index.ts`

Tasks:

- Add local actions:
  - `APPEND_OPTIMISTIC_MESSAGE`
  - `APPEND_ASSISTANT_PLACEHOLDER`
  - `UPDATE_ASSISTANT_STREAM`
  - `REPLACE_ACTIVE_SESSION`
  - `MARK_MESSAGE_ERROR`
- On send:
  - immediately append user message with local id;
  - immediately append assistant placeholder with empty content and `status: "thinking"`;
  - clear input and attachments immediately after local append;
  - on backend completion, replace with canonical session from server.

Verify:

- User message appears before first network byte from MiMo.
- If provider fails, user message remains and assistant placeholder shows error.

### Step 4 - SSE Streaming

Files:

- `server/src/mimoClient.js`
- `server/src/routes/chat.js`
- `client/src/api/client.ts`
- `client/src/hooks/useChat.ts`
- `client/src/types/index.ts`

Tasks:

- Add `chatCompletionStream({ model, messages, params })`.
- Send provider body with `stream: true`.
- Parse provider SSE chunks from `res.body`.
- Add local endpoint `POST /api/chat/stream`.
- Backend emits SSE events:
  - `event: start` with `{ requestId, modelUsed }`
  - `event: delta` with `{ contentDelta, reasoningDelta? }`
  - `event: usage` with usage when present
  - `event: done` with `{ assistantMessage, session, latencyMs }`
  - `event: error` with normalized error shape
- Use `fetch` streaming on frontend instead of `EventSource`, because request needs POST body.
- Keep non-stream `/api/chat` until stream is stable, or make `useChat` fallback to it.

Verify:

- Assistant bubble fills token-by-token.
- `done` persists both user and assistant messages in JSON storage.
- Header latency updates from server `latencyMs` or client timer.

### Step 5 - Prompt Editor UX

Files:

- `client/src/components/prompts/PromptModal.tsx`
- `client/src/components/layout/Inspector.tsx`
- `client/src/components/ui/Modal.tsx`

Tasks:

- Make prompt modal wide: target `min(920px, calc(100vw - 32px))`.
- Textarea: `min-h-[50vh]`, `max-h-[65vh]`, scrollable, resize allowed vertical.
- Add prompt list/selection in modal if editing current prompt is unclear.
- In Inspector prompt card, show title + concise preview + clear `Edit` button.
- Keep save/delete semantics unchanged.

Verify:

- Long system prompt is comfortable to edit on desktop.
- Mobile modal uses full width and usable height.

### Step 6 - Header Upgrade

Files:

- `client/src/components/layout/TopBar.tsx`
- `client/src/components/layout/ApiStatusBadge.tsx` optional
- `client/src/context/AppContext.tsx`
- `server/src/index.js`
- `server/src/routes/health.js` optional

Tasks:

- Add compact header structure:
  - left: MiMo Chat identity + session title;
  - center: current model pill;
  - right: API health dot, status text, spinner during request, last latency.
- Add `GET /api/health` returning `{ ok, apiKeyConfigured, providerBaseUrl }`.
- Frontend checks health on load and after failed requests.
- Status labels:
  - `Ready`
  - `Uploading`
  - `Waiting`
  - `Streaming`
  - `Error`
  - `No API key`
  - `Last: 1.2s`

Verify:

- Missing API key is visible before sending.
- During generation header changes to active state.
- After response header shows latency.

### Step 7 - Chat Typography + Bubble Polish

Files:

- `client/src/components/chat/MessageBubble.tsx`
- `client/src/components/chat/ChatArea.tsx`
- `client/src/index.css`

Tasks:

- Reduce bubble body font to `text-[13px]` or `text-sm` with controlled line height.
- Reduce user bubble padding from `p-4` to `px-3 py-2.5`.
- Reduce assistant bubble padding from `p-5` to `p-4`.
- Reduce message vertical gap from `space-y-6` to `space-y-4`.
- Keep markdown headings smaller inside chat.
- Add `prose`-like local classes manually; do not add typography plugin unless needed.

Verify:

- Long answer fits more content per screen.
- Code blocks remain readable.

### Step 8 - Composer Polish

Files:

- `client/src/components/composer/Composer.tsx`
- `client/src/index.css`

Tasks:

- Outer composer container:
  - use `focus-within:border-cyan/35`
  - use subtle `focus-within:shadow-[0_0_0_1px_rgba(...)]`
  - avoid browser default outline on textarea.
- Use `items-center` on composer row, not `items-end`.
- Wrap textarea in flex container with `min-h`.
- Make attach and send controls fixed-size: `h-10 w-10` or `h-9`.
- If keeping text `Send`, use fixed `min-h` and `self-center`; better: icon button + tooltip/title.
- Ensure send button does not move when textarea grows.

Verify:

- Multi-line text keeps send vertically centered.
- Focus ring looks intentional and not harsh.

## 8. Backend Notes

Current backend is mostly aligned with docs, but streaming needs careful parsing:

- Provider stream chunks are OpenAI-style `data: {...}` lines and terminal `data: [DONE]`.
- `choices[0].delta.content` should append to visible answer.
- `choices[0].delta.reasoning_content` can be stored separately later; for now optional.
- Usage may arrive in a final chunk or not. Preserve if present.
- On network/provider errors, emit normalized local error and close SSE cleanly.

Storage rule:

- Save to JSON only once per completed stream, not on every token.
- If stream fails after partial answer, save user message and an assistant error message only if useful for session history.

## 9. Verification Plan

Manual browser checks:

- Text-only message streams with `mimo-v2.5-pro`.
- Image message auto-switches to `mimo-v2.5` and streams.
- User message appears immediately.
- Assistant placeholder appears before first token.
- Prompt editor handles a long prompt.
- Header shows API status and latency.
- Composer focus and send alignment work for 1-line and 6-line text.
- Mobile drawer still opens sessions and inspector.

CLI checks:

```bash
cd client
npm run build
```

```bash
cd server
npm run dev
```

API smoke checks:

- `GET /api/models`
- `GET /api/health`
- `POST /api/chat/stream` with text
- `POST /api/uploads` with allowed image
- `POST /api/chat/stream` with uploaded image attachment

## 10. Priority Order

1. Shared chat state + optimistic message.
2. Auto-switch image model.
3. SSE streaming.
4. Header status + latency.
5. Prompt editor UX.
6. Composer focus/alignment.
7. Chat typography polish.

Reason: streaming and optimistic UI touch the same data flow as model switching. UI polish should happen after state flow is stable.
