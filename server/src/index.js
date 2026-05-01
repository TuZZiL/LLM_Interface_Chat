import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORT } from "./config.js";
import { initStorage } from "./storage.js";
import modelsRouter from "./routes/models.js";
import promptsRouter from "./routes/prompts.js";
import sessionsRouter from "./routes/sessions.js";
import chatRouter from "./routes/chat.js";
import uploadsRouter from "./routes/uploads.js";
import healthRouter from "./routes/health.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "..", "..", "client", "dist");

const app = express();

app.use(cors());
app.use(express.json({ limit: "60mb" }));

app.use("/api/health", healthRouter);
app.use("/api/models", modelsRouter);
app.use("/api/prompts", promptsRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/uploads", uploadsRouter);

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  const code = err.code || "INTERNAL_ERROR";
  res.status(status).json({ error: { code, message: err.message } });
});

await initStorage();

app.listen(PORT, () => {
  console.log(`MiMo Chat server running on http://localhost:${PORT}`);
});
