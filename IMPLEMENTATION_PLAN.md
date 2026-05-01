# MiMo Chat Implementation Plan

## Status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend structure | ✅ Done | `server/` with Express, ESM |
| Config + models | ✅ Done | `config.js`, `.env` |
| Storage (JSON) | ✅ Done | `storage.js` — prompts, sessions |
| MiMo client | ✅ Done | `mimoClient.js` — OpenAI-compatible |
| Route: models | ✅ Done | `GET /api/models` |
| Route: prompts | ✅ Done | CRUD + default seed |
| Route: sessions | ✅ Done | CRUD |
| Route: chat | ✅ Done | System prompt injection, model routing |
| Route: uploads | ✅ Done | Multer, MIME/size validation |
| Frontend | ✅ Done | Steps 1-11 built, 12-13 pending |
| Smoke test | ✅ Done | Server starts, endpoints respond |

---

## 1. Goal

Build a local MiMo chat application from the current frontend-only design mockup.

The app must support:

- Text chat with Xiaomi MiMo models.
- Image + text chat.
- OpenAI API Compatibility mode.
- Node.js backend.
- Local sessions.
- Local reusable system prompts.
- Initial models: `mimo-v2.5-pro` and `mimo-v2.5`.

Primary rule: keep v1 simple and local. No database unless JSON storage becomes painful.

## 2. Current State

Repo currently contains only a design mockup:

- `design/code.html` - static Tailwind HTML mockup.
- `design/DESIGN.md` - design system notes.
- `design/screen.png` - screenshot of current UI.
- `Project_Report.md` - compact project memory.

Current design is a dark AI console:

- Top bar.
- Left session sidebar.
- Center chat area.
- Right inspector panel.
- Bottom composer.

The structure can be changed to fit backend integration.

## 3. Xiaomi MiMo Documentation Sources

Use official Xiaomi MiMo docs as source of truth:

- Documentation index / LLM manifest: `https://platform.xiaomimimo.com/llms.txt`
- First API Call: `https://platform.xiaomimimo.com/static/docs/quick-start/first-api-call.md`
- OpenAI API Compatibility: `https://platform.xiaomimimo.com/static/docs/api/chat/openai-api.md`
- Image Understanding: `https://platform.xiaomimimo.com/static/docs/usage-guide/multimodal-understanding/image-understanding.md`
- MiMo-V2.5 news / model capabilities: `https://platform.xiaomimimo.com/static/docs/news/v2.5-open-sourced.md`
- Model hyperparameters: `https://platform.xiaomimimo.com/static/docs/quick-start/model-hyperparameters.md`
- Error codes: `https://platform.xiaomimimo.com/static/docs/quick-start/error-codes.md`
- Pricing and rate limits / context windows: `https://platform.xiaomimimo.com/static/docs/pricing.md`

Known facts from docs:

- OpenAI-compatible chat endpoint: `https://api.xiaomimimo.com/v1/chat/completions`
- API base URL for SDK usage: `https://api.xiaomimimo.com/v1`
- Auth supports `api-key: $MIMO_API_KEY` and `Authorization: Bearer $MIMO_API_KEY`.
- Text chat uses OpenAI-style `messages`.
- Image understanding uses `messages[].content[]` parts.
- Image parts use `{ "type": "image_url", "image_url": { "url": "..." } }`.
- Image URL and Base64 `data:{MIME_TYPE};base64,...` are supported.
- Supported image formats: JPEG, PNG, GIF, WebP, BMP.
- Single image URL file size limit: 50 MB.
- Single Base64 image string limit: 50 MB.
- `mimo-v2.5-pro` is intended for complex tasks, agents, and coding.
- `mimo-v2.5` is full-modal and supports text, image, video, and audio understanding.
- Both MiMo-V2.5 series models support a 1-million-token context window per release note.

## 4. Architecture

Use a local Node.js backend as the only caller of MiMo API.

Frontend never stores or sends `MIMO_API_KEY` to browser-accessible code.

Recommended v1 layout:

```text
server/
  package.json
  .env.example
  src/
    index.js
    config.js
    mimoClient.js
    storage.js
    routes/
      chat.js
      models.js
      prompts.js
      sessions.js
      uploads.js
  data/
    prompts.json
    sessions.json
    uploads/
```

Use Node.js 20+ and Express.

Use JSON files for local persistence:

- `server/data/prompts.json`
- `server/data/sessions.json`
- `server/data/uploads/`

Do not add SQLite/Postgres in v1.

## 5. Backend Details

### Config

Environment variables:

```env
PORT=3001
MIMO_API_KEY=replace_me
MIMO_BASE_URL=https://api.xiaomimimo.com/v1
```

Backend must fail fast on chat requests when `MIMO_API_KEY` is missing.

### MiMo Client

`mimoClient.js` wraps all provider calls.

Request:

```http
POST https://api.xiaomimimo.com/v1/chat/completions
api-key: $MIMO_API_KEY
Content-Type: application/json
```

Default request body for text:

```json
{
  "model": "mimo-v2.5-pro",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Hello" }
  ],
  "max_completion_tokens": 1024,
  "temperature": 1,
  "top_p": 0.95,
  "stream": false
}
```

Default request body for image:

```json
{
  "model": "mimo-v2.5",
  "messages": [
    { "role": "system", "content": "..." },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,..."
          }
        },
        {
          "type": "text",
          "text": "Describe this image"
        }
      ]
    }
  ],
  "max_completion_tokens": 1024,
  "temperature": 1,
  "top_p": 0.95,
  "stream": false
}
```

### Models

Supported models in v1:

```json
[
  {
    "id": "mimo-v2.5-pro",
    "label": "MiMo-V2.5-Pro",
    "supportsText": true,
    "supportsImages": false,
    "defaultFor": "text"
  },
  {
    "id": "mimo-v2.5",
    "label": "MiMo-V2.5",
    "supportsText": true,
    "supportsImages": true,
    "defaultFor": "image"
  }
]
```

Rule:

- Text-only chat defaults to `mimo-v2.5-pro`.
- Chat with image defaults to `mimo-v2.5`.
- If request contains image and selected model is `mimo-v2.5-pro`, backend returns validation error instead of silently switching.

### System Prompts

System prompts are first-class local entities.

Prompt shape:

```json
{
  "id": "uuid",
  "title": "Default MiMo",
  "content": "You are MiMo, an AI assistant developed by Xiaomi...",
  "isDefault": true,
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

Rules:

- Create default prompt on first backend startup if `prompts.json` is empty/missing.
- `POST /api/chat` accepts either `systemPromptId` or inline `systemPrompt`.
- If both are provided, `systemPromptId` wins.
- Selected system prompt is always inserted as `messages[0]` with role `system`.
- Frontend must expose prompt select and edit flow.
- Prompts are stored locally and survive server restart.

### Sessions

Session shape:

```json
{
  "id": "uuid",
  "title": "New chat",
  "model": "mimo-v2.5-pro",
  "systemPromptId": "uuid",
  "messages": [],
  "createdAt": "ISO datetime",
  "updatedAt": "ISO datetime"
}
```

Message shape:

```json
{
  "id": "uuid",
  "role": "user",
  "content": "Text or normalized content parts",
  "attachments": [],
  "usage": null,
  "error": null,
  "createdAt": "ISO datetime"
}
```

Store assistant usage from MiMo response when available:

- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- `prompt_tokens_details.image_tokens` if available.

### Uploads

`POST /api/uploads` accepts image files only.

Validation:

- MIME allowlist: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/bmp`.
- Max size: 50 MB.

Return attachment descriptor:

```json
{
  "id": "uuid",
  "mimeType": "image/png",
  "size": 12345,
  "fileName": "image.png",
  "dataUrl": "data:image/png;base64,..."
}
```

For v1, simplest path is to return `dataUrl` and optionally persist file under `server/data/uploads/`.

### Error Shape

Normalize backend errors:

```json
{
  "error": {
    "code": "MIMO_REQUEST_FAILED",
    "message": "Readable message",
    "providerStatus": 500
  }
}
```

Use stable local codes:

- `MISSING_API_KEY`
- `INVALID_MODEL`
- `MODEL_DOES_NOT_SUPPORT_IMAGES`
- `PROMPT_NOT_FOUND`
- `SESSION_NOT_FOUND`
- `INVALID_IMAGE_TYPE`
- `IMAGE_TOO_LARGE`
- `MIMO_REQUEST_FAILED`

## 6. Backend API

### Models

`GET /api/models`

Returns supported local model config.

### Prompts

`GET /api/prompts`

Returns all local system prompts.

`POST /api/prompts`

Body:

```json
{
  "title": "Strict Ukrainian assistant",
  "content": "Always answer in Ukrainian...",
  "isDefault": false
}
```

`PUT /api/prompts/:id`

Updates title/content/default flag.

`DELETE /api/prompts/:id`

Deletes prompt. Do not allow deleting the only prompt.

### Sessions

`GET /api/sessions`

Returns compact session list.

`POST /api/sessions`

Body:

```json
{
  "title": "New chat",
  "model": "mimo-v2.5-pro",
  "systemPromptId": "uuid"
}
```

`GET /api/sessions/:id`

Returns full session with messages.

`DELETE /api/sessions/:id`

Deletes session.

### Chat

`POST /api/chat`

Body:

```json
{
  "sessionId": "uuid",
  "model": "mimo-v2.5-pro",
  "systemPromptId": "uuid",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "params": {
    "temperature": 1,
    "top_p": 0.95,
    "max_completion_tokens": 1024
  },
  "attachments": []
}
```

Response:

```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Assistant answer",
    "usage": {}
  },
  "session": {}
}
```

### Uploads

`POST /api/uploads`

Multipart image upload. Returns attachment descriptor.

## 7. Frontend Plan

Tech: React 19 + Vite 6 + TypeScript 5 + Tailwind CSS 4.

State: React Context + useReducer.

### Project Structure

```text
client/
  package.json
  vite.config.ts
  tailwind.config.ts
  index.html
  tsconfig.json
  src/
    main.tsx
    App.tsx
    index.css
    api/
      client.ts
    types/
      index.ts
    context/
      AppContext.tsx
    hooks/
      useSessions.ts
      usePrompts.ts
      useChat.ts
      useUpload.ts
    components/
      layout/
        TopBar.tsx
        Sidebar.tsx
        Inspector.tsx
        MobileDrawer.tsx
      chat/
        ChatArea.tsx
        MessageBubble.tsx
        CodeBlock.tsx
        EmptyState.tsx
        LoadingDots.tsx
      composer/
        Composer.tsx
        ImagePreview.tsx
      prompts/
        PromptSelect.tsx
        PromptModal.tsx
      ui/
        Button.tsx
        Modal.tsx
        Toast.tsx
    utils/
      format.ts
```

### Labels

Replace sci-fi labels:

- `AETHER_OS` → `MiMo Chat`
- `CONSOLE_CORE` → `Sessions`
- `INTEL_INSPECTOR` → `Inspector`
- `TERMINATE` → remove
- `Recursion Depth` → remove

### Steps

| # | Step | Files | Done |
|---|------|-------|------|
| 1 | Scaffold: Vite + React + TS + Tailwind | `client/` | ✅ |
| 2 | Types + API client | `types/`, `api/` | ✅ |
| 3 | Context + reducer | `context/` | ✅ |
| 4 | Layout shells | `components/layout/` | ✅ |
| 5 | Sessions CRUD | `Sidebar.tsx`, hooks | ✅ |
| 6 | Composer | `components/composer/` | ✅ |
| 7 | Chat flow | `ChatArea.tsx`, `MessageBubble.tsx` | ✅ |
| 8 | Prompts: select + modal | `components/prompts/` | ✅ |
| 9 | Image upload | `ImagePreview.tsx`, `useUpload.ts` | ✅ |
| 10 | Inspector: model, params, usage | `Inspector.tsx` | ✅ |
| 11 | Empty states, errors, loading | `EmptyState.tsx`, `Toast.tsx` | ✅ |
| 12 | Mobile: drawer, responsive | `MobileDrawer.tsx` | ✅ |
| 13 | Polish: markdown, code blocks | `MessageBubble.tsx`, `CodeBlock.tsx` | ✅ |

## 8. Data Flow

Text-only flow:

1. User selects session, model, system prompt.
2. User writes text.
3. Frontend sends `POST /api/chat`.
4. Backend loads selected prompt.
5. Backend builds MiMo messages with system prompt first.
6. Backend calls MiMo using `mimo-v2.5-pro` unless user selected another valid text model.
7. Backend stores user and assistant messages.
8. Frontend renders assistant answer and usage.

Image flow:

1. User attaches image.
2. Frontend sends image to `POST /api/uploads`.
3. Backend validates MIME and size.
4. Backend returns attachment descriptor with `dataUrl`.
5. User sends prompt.
6. Backend builds content parts with `image_url` and `text`.
7. Backend calls MiMo using `mimo-v2.5`.
8. Frontend renders image thumbnail and assistant answer.

System prompt flow:

1. User creates or edits prompt in inspector.
2. Frontend calls prompts API.
3. Prompt is saved in `server/data/prompts.json`.
4. Session stores selected `systemPromptId`.
5. Every chat request injects selected prompt as first system message.

## 9. Verification

Backend checks:

- [x] Server starts with missing data files and creates defaults.
- [x] `GET /api/models` returns both supported models.
- [x] `POST /api/prompts` creates local prompt.
- [x] `PUT /api/prompts/:id` updates prompt.
- [x] `DELETE /api/prompts/:id` prevents deleting only prompt.
- [x] `POST /api/sessions` creates session with model and prompt.
- [x] `POST /api/chat` inserts system prompt as first message.
- [x] Text-only chat uses `mimo-v2.5-pro` by default.
- [x] Image chat uses `mimo-v2.5` by default.
- [x] Image + `mimo-v2.5-pro` returns validation error.
- [x] Missing `MIMO_API_KEY` returns `MISSING_API_KEY`.
- [x] Unsupported image MIME returns `INVALID_IMAGE_TYPE`.
- [x] Image over 50 MB returns `IMAGE_TOO_LARGE`.

Frontend checks:

- Empty state renders before first message.
- Session list updates after new chat.
- Prompt select changes active system prompt.
- Prompt modal can create/edit prompt.
- Text message sends and renders response.
- Image upload previews thumbnail before send.
- Loading state disables send button.
- Backend/provider error renders readable error.
- Mobile layout keeps chat usable.

Security check:

- `MIMO_API_KEY` exists only in backend `.env`.
- No frontend source contains `MIMO_API_KEY`.
- Browser network calls only local backend endpoints.

## 10. Future Extensions

Do not implement in v1 unless explicitly requested:

- Streaming/SSE.
- SQLite/Postgres.
- User auth.
- Cloud sync.
- Tool calling.
- Audio/video support.
- Prompt marketplace.
- Multi-provider support.

Good v1.1 additions:

- SSE streaming for assistant responses.
- SQLite storage if JSON writes become limiting.
- Token usage charts in inspector.
- Prompt export/import.
- Web search tool calling if needed.
