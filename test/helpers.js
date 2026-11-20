import { createApp } from '../src/create-app.js';
import { createAssistant } from '../src/assistant.js';

/**
 * Test double for the Gemini wrapper. Records every request and returns the
 * fixture for the schema that was asked for. Used only in tests.
 */
export function fakeAi(fixtures) {
  const calls = [];
  return {
    calls,
    async generateJson(request) {
      calls.push(request);
      const key = Object.keys(request.schema.properties).join(',');
      const fixture = fixtures[key];
      if (!fixture) throw new Error(`no fixture for schema ${key}`);
      return structuredClone(typeof fixture === 'function' ? fixture(request) : fixture);
    },
  };
}

export const silentLogger = { error() {} };

export function buildApp(ai, opts = {}) {
  return createApp({ assistant: createAssistant({ ai }), logger: silentLogger, rateLimitPerMinute: 1000, ...opts });
}

export const FIXTURES = {
  intervention: {
    urgency: 'support',
    headline: 'You are safe to slow down.',
    steps: ['Sit down.', 'Breathe slowly.', 'Call someone you trust.'],
    sayThis: 'This feeling will pass.',
    grounding: { name: '5-4-3-2-1', instructions: ['Name 5 things you see.', 'Name 4 things you hear.'] },
    avoid: ['Being alone right now.'],
  },
  script: {
    opening: 'My name is Asha, I am at Anna Nagar, my brother is not breathing.',
    lines: ['He may have taken opioids.', 'He is 24.', 'Please send an ambulance.'],
    keyFacts: [{ label: 'Address', value: 'Anna Nagar' }],
    whileWaiting: ['Put him in the recovery position.'],
    missingInfo: [],
  },
  learn: {
    title: 'Naloxone',
    summary: 'Naloxone reverses opioid overdose.',
    keyPoints: ['It is safe.', 'It works in minutes.', 'Call emergency services too.'],
    mythsVsFacts: [{ myth: 'It encourages use.', fact: 'Evidence shows it does not.' }],
    tryThisToday: 'Find out where to get naloxone.',
    whenToGetHelp: 'Any time someone will not wake up.',
    trustedSources: ['WHO'],
  },
  voice: {
    transcript: 'I feel okay today, just tired.',
    feeling: 'tired',
    riskLevel: 'low',
    reply: 'Thanks for checking in.',
    nextTool: 'learn',
    nextToolReason: 'Learn about rest and recovery.',
  },
  scan: {
    whatISee: 'A bottle of beer next to a strip of tablets.',
    risks: [{ risk: 'Alcohol with sedatives', why: 'Can slow breathing.', severity: 'high' }],
    saferActions: ['Do not mix them.'],
    uncertainty: 'The tablets cannot be identified from a photo.',
  },
};

/** Maps each fixture to the schema key fakeAi() uses for lookup. */
export function fixturesBySchema(overrides = {}) {
  const f = { ...FIXTURES, ...overrides };
  return {
    'urgency,headline,steps,sayThis,grounding,avoid': f.intervention,
    'opening,lines,keyFacts,whileWaiting,missingInfo': f.script,
    'title,summary,keyPoints,mythsVsFacts,tryThisToday,whenToGetHelp,trustedSources': f.learn,
    'transcript,feeling,riskLevel,reply,nextTool,nextToolReason': f.voice,
    'whatISee,risks,saferActions,uncertainty': f.scan,
  };
}

export const TINY_BASE64 = Buffer.alloc(64, 1).toString('base64');
