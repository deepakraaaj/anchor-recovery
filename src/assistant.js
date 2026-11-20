import {
  SITUATIONS, OVERDOSE_SIGNS, SUBSTANCES, SCRIPT_SCENARIOS, LEARN_TOPICS, LANGUAGES, ROLES,
} from './catalog.js';
import {
  BASE_SYSTEM, languageRule, INTERVENTION_SCHEMA, SCRIPT_SCHEMA, LEARN_SCHEMA, VOICE_SCHEMA, SCAN_SCHEMA,
  SCAN_INSTRUCTION,
} from './prompts.js';
import { requiredUrgency, maxUrgency, maxRisk, hasCrisisLanguage, helplinesFor } from './safety.js';
import { createLruCache } from './cache.js';

const systemFor = (language) => `${BASE_SYSTEM}\n${languageRule(LANGUAGES[language].name)}`;
const text = (value) => ({ text: value });
const userData = (obj) => `<user_data>${JSON.stringify(obj)}</user_data>`;

/**
 * Domain logic for every feature. Each method builds a prompt, calls Gemini
 * for structured output, then applies deterministic safety rules and attaches
 * verified helplines (never model-generated).
 *
 * @param {{ ai: { generateJson: Function }, cache?: ReturnType<typeof createLruCache> }} deps
 */
export function createAssistant({ ai, cache = createLruCache() }) {
  return {
    async intervene({ role, language, country, situation, intensity, substance, signs }) {
      const facts = {
        role: ROLES[role],
        situation: SITUATIONS[situation].label,
        intensityOutOf5: intensity,
        substance: SUBSTANCES[substance],
        observedSigns: signs.map((s) => OVERDOSE_SIGNS[s]),
      };
      const result = await ai.generateJson({
        system: systemFor(language),
        schema: INTERVENTION_SCHEMA,
        temperature: 0.3,
        parts: [text(`Give an immediate, step-by-step intervention for this moment. The reader tapped one button and cannot type.\n${userData(facts)}`)],
      });
      result.urgency = maxUrgency(result.urgency, requiredUrgency({ situation, signs }));
      return { ...result, helplines: helplinesFor(country) };
    },

    async emergencyScript({ role, language, country, scenario, profile }) {
      const helplines = helplinesFor(country);
      const result = await ai.generateJson({
        system: systemFor(language),
        schema: SCRIPT_SCHEMA,
        temperature: 0.2,
        parts: [text(
          `Write a phone script the reader can read aloud word for word for: "${SCRIPT_SCENARIOS[scenario]}".`
          + ` Caller role: ${ROLES[role]}. Country: ${helplines.name}.`
          + ' Use only facts from the profile below. Where a fact is missing, write a short blank like "[your address]".'
          + `\n${userData({ ...profile, substances: profile.substances?.map((s) => SUBSTANCES[s]) })}`,
        )],
      });
      return { ...result, helplines };
    },

    async learn({ role, language, country, topic }) {
      const key = `learn:${topic}:${role}:${language}`;
      let card = cache.get(key);
      const cached = Boolean(card);
      if (!card) {
        card = await ai.generateJson({
          system: systemFor(language),
          schema: LEARN_SCHEMA,
          temperature: 0.3,
          parts: [text(`Write a short, evidence-based explainer on "${LEARN_TOPICS[topic]}" for someone who says: "${ROLES[role]}".`)],
        });
        cache.set(key, card);
      }
      return { ...card, cached, helplines: helplinesFor(country) };
    },

    async voiceCheckIn({ role, language, country, audio, mimeType }) {
      const result = await ai.generateJson({
        system: systemFor(language),
        schema: VOICE_SCHEMA,
        temperature: 0.3,
        parts: [
          { inlineData: { mimeType, data: audio } },
          text(`This is a spoken check-in from someone who says: "${ROLES[role]}". Transcribe it, notice how they feel, assess risk, reply supportively, and pick the best next tool. If the audio is silent or unclear, say so kindly and set riskLevel to low.`),
        ],
      });
      if (hasCrisisLanguage(result.transcript)) {
        result.riskLevel = maxRisk(result.riskLevel, 'high');
        result.nextTool = 'call_helpline';
      }
      if (result.riskLevel === 'crisis') result.nextTool = 'call_helpline';
      return { ...result, helplines: helplinesFor(country) };
    },

    async safetyScan({ role, language, country, image, mimeType }) {
      const result = await ai.generateJson({
        system: systemFor(language),
        schema: SCAN_SCHEMA,
        temperature: 0.2,
        parts: [
          { inlineData: { mimeType, data: image } },
          text(`${SCAN_INSTRUCTION}\nThe person sharing this photo says: "${ROLES[role]}".`),
        ],
      });
      return { ...result, helplines: helplinesFor(country) };
    },
  };
}
