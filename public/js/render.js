import { el, list } from './dom.js';

/** Renderers turn API JSON into DOM plus a plain-text version for read-aloud. */

export function urgencyBanner(urgency, helplines) {
  if (urgency !== 'emergency' && urgency !== 'urgent') return null;
  const emergency = urgency === 'emergency';
  return el('div', { class: `banner ${urgency}`, role: 'alert' }, [
    el('p', { text: emergency ? 'This may be a medical emergency. Call now, then follow the steps.' : 'Please reach out to someone today.' }),
    el('a', { class: 'call', href: `tel:${helplines.emergency}`, text: `Call ${helplines.emergency}` }),
  ]);
}

export function intervention(data) {
  const node = el('div', {}, [
    urgencyBanner(data.urgency, data.helplines),
    el('h2', { text: data.headline }),
    list('ol', data.steps),
    el('h3', { text: 'Say this' }),
    el('p', { class: 'say', text: data.sayThis }),
    el('h3', { text: data.grounding.name }),
    list('ol', data.grounding.instructions),
    el('h3', { text: 'For now, avoid' }),
    list('ul', data.avoid),
  ]);
  const speech = [data.headline, ...data.steps, data.sayThis].join('. ');
  return { node, speech };
}

export function script(data) {
  const node = el('div', {}, [
    el('h2', { text: 'Read this aloud' }),
    el('p', { class: 'script-line say', text: data.opening }),
    ...data.lines.map((line) => el('p', { class: 'script-line', text: line })),
    data.keyFacts.length > 0 && el('h3', { text: 'If they ask' }),
    data.keyFacts.length > 0 && el('dl', {}, data.keyFacts.flatMap((f) => [el('dt', { text: f.label }), el('dd', { text: f.value })])),
    data.whileWaiting.length > 0 && el('h3', { text: 'While you wait' }),
    data.whileWaiting.length > 0 && list('ol', data.whileWaiting),
    data.missingInfo.length > 0 && el('p', { class: 'meta', text: `Add to your profile for a better script: ${data.missingInfo.join(', ')}` }),
  ]);
  return { node, speech: [data.opening, ...data.lines].join(' ') };
}

export function learnCard(data) {
  const node = el('div', {}, [
    el('h2', { text: data.title }),
    el('p', { text: data.summary }),
    list('ul', data.keyPoints),
    el('h3', { text: 'Myth vs fact' }),
    ...data.mythsVsFacts.map((m) => el('p', {}, [el('s', { text: m.myth }), el('br'), el('strong', { text: m.fact })])),
    el('h3', { text: 'Try this today' }),
    el('p', { class: 'say', text: data.tryThisToday }),
    el('h3', { text: 'When to get help' }),
    el('p', { text: data.whenToGetHelp }),
    el('p', { class: 'meta', text: `Learn more from: ${data.trustedSources.join(', ')}` }),
  ]);
  return { node, speech: [data.title, data.summary, ...data.keyPoints].join('. ') };
}

const RISK_TO_URGENCY = { crisis: 'emergency', high: 'urgent' };

export function voiceResult(data, onNextTool) {
  const node = el('div', {}, [
    urgencyBanner(RISK_TO_URGENCY[data.riskLevel], data.helplines),
    el('p', { class: 'meta', text: `You said: “${data.transcript}”` }),
    el('p', { class: 'meta', text: `Feeling: ${data.feeling}` }),
    el('p', { class: 'say', text: data.reply }),
    el('p', { text: data.nextToolReason }),
    el('button', { class: 'primary', onClick: () => onNextTool(data.nextTool), text: NEXT_TOOL_LABELS[data.nextTool] }),
  ]);
  return { node, speech: data.reply };
}

const NEXT_TOOL_LABELS = {
  breathe: 'Start guided breathing',
  intervene: 'Open one-tap help',
  script: 'Open emergency scripts',
  learn: 'Learn more',
  call_helpline: 'Call a helpline now',
};

export function scanResult(data) {
  const node = el('div', {}, [
    el('h2', { text: 'What Anchor sees' }),
    el('p', { text: data.whatISee }),
    data.risks.length > 0 && el('h3', { text: 'Risks' }),
    data.risks.length > 0 && el('ul', {}, data.risks.map((r) => el('li', {}, [
      el('strong', { text: `${r.risk} (${r.severity}): ` }), r.why,
    ]))),
    el('h3', { text: 'Safer steps' }),
    list('ol', data.saferActions),
    el('p', { class: 'meta', text: data.uncertainty }),
  ]);
  const speech = [data.whatISee, ...data.risks.map((r) => r.risk), ...data.saferActions].join('. ');
  return { node, speech };
}

export function helplineList(helplines) {
  return helplines.lines.map((line) => el('li', {}, [
    el('span', { text: line.name }),
    el('a', { href: `tel:${line.number}`, text: line.number, 'aria-label': `Call ${line.name}, ${line.number}` }),
  ]));
}
