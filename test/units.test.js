import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLruCache } from '../src/cache.js';
import { hasCrisisLanguage, requiredUrgency, maxUrgency, maxRisk } from '../src/safety.js';
import { createGeminiClient } from '../src/gemini.js';
import { AiUnavailableError } from '../src/errors.js';

describe('createLruCache', () => {
  test('evicts the least recently used entry', () => {
    const cache = createLruCache({ maxEntries: 2 });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    assert.equal(cache.get('b'), undefined);
    assert.equal(cache.get('a'), 1);
    assert.equal(cache.size, 2);
  });

  test('expires entries after the TTL', () => {
    let now = 0;
    const cache = createLruCache({ ttlMs: 100, now: () => now });
    cache.set('a', 1);
    now = 99;
    assert.equal(cache.get('a'), 1);
    now = 250;
    assert.equal(cache.get('a'), undefined);
  });
});

describe('safety rules', () => {
  test('detects crisis language', () => {
    assert.ok(hasCrisisLanguage('I want to kill myself'));
    assert.ok(hasCrisisLanguage('my friend overdosed'));
    assert.ok(hasCrisisLanguage("he won't wake up"));
    assert.ok(!hasCrisisLanguage('I had a calm day at work'));
  });

  test('requires emergency for overdose situations and critical signs only', () => {
    assert.equal(requiredUrgency({ situation: 'overdose_risk' }), 'emergency');
    assert.equal(requiredUrgency({ situation: 'withdrawal', signs: ['blue_lips'] }), 'emergency');
    assert.equal(requiredUrgency({ situation: 'withdrawal', signs: ['vomiting'] }), 'support');
    assert.equal(requiredUrgency({ situation: 'craving' }), 'support');
  });

  test('never lowers urgency or risk', () => {
    assert.equal(maxUrgency('emergency', 'support'), 'emergency');
    assert.equal(maxUrgency('support', 'urgent'), 'urgent');
    assert.equal(maxRisk('crisis', 'high'), 'crisis');
    assert.equal(maxRisk('low', 'high'), 'high');
  });
});

describe('createGeminiClient', () => {
  const schema = { type: 'object', properties: {} };
  const clientReturning = (response) => ({ models: { generateContent: async () => response } });

  test('parses JSON and sends schema, system prompt and safety settings', async () => {
    let sent;
    const client = { models: { generateContent: async (req) => { sent = req; return { text: '{"ok":true}' }; } } };
    const ai = createGeminiClient({ apiKey: 'k', model: 'test-model', timeoutMs: 1000, client });
    assert.deepEqual(await ai.generateJson({ system: 'sys', parts: [{ text: 'hi' }], schema }), { ok: true });
    assert.equal(sent.model, 'test-model');
    assert.equal(sent.config.systemInstruction, 'sys');
    assert.equal(sent.config.responseMimeType, 'application/json');
    assert.equal(sent.config.responseJsonSchema, schema);
    assert.ok(sent.config.abortSignal instanceof AbortSignal);
  });

  test('throws AiUnavailableError for malformed JSON, blocked output and network errors', async () => {
    const cases = [
      clientReturning({ text: 'not json' }),
      clientReturning({ text: '', promptFeedback: { blockReason: 'SAFETY' } }),
      { models: { generateContent: async () => { throw new Error('network'); } } },
    ];
    for (const client of cases) {
      const ai = createGeminiClient({ apiKey: 'k', model: 'm', timeoutMs: 1000, client });
      await assert.rejects(ai.generateJson({ system: '', parts: [], schema }), AiUnavailableError);
    }
  });
});
