import { Router } from 'express';
import {
  ROLES, SITUATIONS, OVERDOSE_SIGNS, SUBSTANCES, SCRIPT_SCENARIOS, LEARN_TOPICS, LANGUAGES, HELPLINES,
} from './catalog.js';
import { interveneSchema, scriptSchema, learnSchema, voiceSchema, scanSchema } from './schemas.js';

const OPTIONS = Object.freeze({
  roles: ROLES,
  situations: SITUATIONS,
  overdoseSigns: OVERDOSE_SIGNS,
  substances: SUBSTANCES,
  scriptScenarios: SCRIPT_SCENARIOS,
  learnTopics: LEARN_TOPICS,
  languages: LANGUAGES,
  helplines: HELPLINES,
});

/** Validates the JSON body with a zod schema, then delegates to the handler. */
const validated = (schema, handler) => async (req, res) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }
  res.json(await handler(parsed.data));
};

export function createApiRouter({ assistant }) {
  const router = Router();

  router.get('/options', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600').json(OPTIONS);
  });

  router.post('/intervene', validated(interveneSchema, (d) => assistant.intervene(d)));
  router.post('/script', validated(scriptSchema, (d) => assistant.emergencyScript(d)));
  router.post('/learn', validated(learnSchema, (d) => assistant.learn(d)));
  router.post('/voice', validated(voiceSchema, (d) => assistant.voiceCheckIn(d)));
  router.post('/scan', validated(scanSchema, (d) => assistant.safetyScan(d)));

  return router;
}
