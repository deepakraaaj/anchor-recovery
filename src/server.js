import { createApp } from './app.js';
import { createAssistant } from './assistant.js';
import { createGeminiClient } from './gemini.js';

const env = process.env;
const port = Number(env.PORT) || 8080;

if (!env.GEMINI_API_KEY) {
  console.warn('[startup] GEMINI_API_KEY is not set: AI features will return 503 until it is configured.');
}

const ai = createGeminiClient({
  apiKey: env.GEMINI_API_KEY ?? '',
  model: env.GEMINI_MODEL || 'gemini-3.8-flash',
  timeoutMs: Number(env.AI_TIMEOUT_MS) || 25_000,
});

const app = createApp({
  assistant: createAssistant({ ai }),
  rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE) || 30,
});

const server = app.listen(port, () => console.log(`[startup] Anchor listening on :${port}`));

// Cloud Run sends SIGTERM before stopping an instance: finish in-flight requests first.
process.on('SIGTERM', () => server.close(() => process.exit(0)));
