import { GoogleGenAI } from '@google/genai';
import { AiUnavailableError } from './errors.js';

// Recovery content must discuss drugs and overdose plainly, so only block clearly harmful output.
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

/**
 * Thin wrapper around the Gemini SDK that always returns parsed JSON that
 * matches the requested schema, or throws AiUnavailableError.
 *
 * @param {{ apiKey: string, model: string, timeoutMs: number, client?: object }} options
 */
export function createGeminiClient({ apiKey, model, timeoutMs, client }) {
  const genai = client ?? (apiKey ? new GoogleGenAI({ apiKey }) : null);

  return {
    /**
     * @param {{ system: string, parts: object[], schema: object, temperature?: number }} request
     */
    async generateJson({ system, parts, schema, temperature = 0.4 }) {
      if (!genai) throw new AiUnavailableError('GEMINI_API_KEY is not configured');

      let response;
      try {
        response = await genai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: system,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
            temperature,
            safetySettings: SAFETY_SETTINGS,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });
      } catch (err) {
        const reason = err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'request failed';
        throw new AiUnavailableError(reason, { cause: err });
      }

      const text = response?.text;
      if (!text) {
        const blocked = response?.promptFeedback?.blockReason ?? response?.candidates?.[0]?.finishReason;
        throw new AiUnavailableError(`empty response${blocked ? ` (${blocked})` : ''}`);
      }
      try {
        return JSON.parse(text);
      } catch (err) {
        throw new AiUnavailableError('malformed JSON from model', { cause: err });
      }
    },
  };
}
