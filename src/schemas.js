import { z } from 'zod';
import {
  ROLES, SITUATIONS, OVERDOSE_SIGNS, SUBSTANCES, SCRIPT_SCENARIOS, LEARN_TOPICS, LANGUAGES, HELPLINES, keysOf,
} from './catalog.js';

const enumOf = (obj) => z.enum(/** @type {[string, ...string[]]} */ (keysOf(obj)));

// ~4.5 MB of binary data once base64-encoded.
const MAX_BASE64_CHARS = 6_000_000;
const base64 = z.string().min(16).max(MAX_BASE64_CHARS).regex(/^[A-Za-z0-9+/]+={0,2}$/, 'must be base64');
const shortText = (max) => z.string().trim().max(max);

const common = {
  role: enumOf(ROLES).default('self'),
  language: enumOf(LANGUAGES).default('en'),
  country: enumOf(HELPLINES).default('IN'),
};

export const interveneSchema = z.object({
  ...common,
  situation: enumOf(SITUATIONS),
  intensity: z.number().int().min(1).max(5).default(3),
  substance: enumOf(SUBSTANCES).default('unspecified'),
  signs: z.array(enumOf(OVERDOSE_SIGNS)).max(keysOf(OVERDOSE_SIGNS).length).default([]),
}).strict().refine((d) => SITUATIONS[d.situation].roles.includes(d.role), {
  message: 'situation is not available for this role', path: ['situation'],
});

export const profileSchema = z.object({
  name: shortText(60).optional(),
  age: z.number().int().min(10).max(120).optional(),
  substances: z.array(enumOf(SUBSTANCES)).max(8).optional(),
  medications: shortText(200).optional(),
  conditions: shortText(200).optional(),
  location: shortText(200).optional(),
  emergencyContact: shortText(80).optional(),
}).strict();

export const scriptSchema = z.object({
  ...common,
  scenario: enumOf(SCRIPT_SCENARIOS),
  profile: profileSchema.default({}),
}).strict();

export const learnSchema = z.object({
  ...common,
  topic: enumOf(LEARN_TOPICS),
}).strict();

export const voiceSchema = z.object({
  ...common,
  audio: base64,
  mimeType: z.enum(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/aac']),
}).strict();

export const scanSchema = z.object({
  ...common,
  image: base64,
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
}).strict();
