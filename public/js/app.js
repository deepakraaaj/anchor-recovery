import { el, $ } from './dom.js';
import { getOptions, post } from './api.js';
import { loadState, saveState, clearState } from './store.js';
import { speak, stopSpeaking, startRecording, blobToBase64, downscaleImage } from './media.js';
import * as render from './render.js';
import { createBreathing } from './breathe.js';

let options;
let state = loadState();
let intensity = 3;
const selectedSigns = new Set();
const breathing = createBreathing();

const settings = () => state.settings;
const helplines = () => options.helplines[settings().country];
const speechLang = () => options.languages[settings().language].speech;

/* ---------- Tabs (WAI-ARIA tabs pattern with arrow-key support) ---------- */

const tabs = [...document.querySelectorAll('[role="tab"]')];

function selectTab(tab) {
  for (const t of tabs) {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.tabIndex = selected ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
  }
  stopSpeaking();
}

function initTabs() {
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      const next = tabs[(i + step + tabs.length) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });
}

const showTab = (name) => selectTab($(`#tab-${name}`));

/* ---------- Shared request + result handling ---------- */

/**
 * Runs an API call, shows progress in the target region, renders the result
 * and offers read-aloud. Errors always surface helplines.
 */
async function runRequest({ target, button, path, body, renderer }) {
  const region = $(target);
  region.replaceChildren(el('p', { class: 'status', text: 'Anchor is thinking…' }));
  region.setAttribute('aria-busy', 'true');
  button?.setAttribute('aria-busy', 'true');
  try {
    const data = await post(path, { ...settings(), ...body });
    const { node, speech } = renderer(data);
    region.replaceChildren(node, el('div', { class: 'result-actions' }, [
      el('button', { class: 'ghost', text: 'Read aloud', onClick: () => speak(speech, speechLang()) }),
      el('button', { class: 'ghost', text: 'Stop', onClick: stopSpeaking }),
    ]));
    return data;
  } catch (err) {
    region.replaceChildren(
      el('p', { class: 'error', role: 'alert', text: err.message }),
      el('ul', { class: 'helplines' }, render.helplineList(helplines())),
    );
    return null;
  } finally {
    region.removeAttribute('aria-busy');
    button?.removeAttribute('aria-busy');
  }
}

/* ---------- Now: zero-typing interventions ---------- */

function renderNow() {
  const { role } = settings();
  $('#role-hint').textContent = `Mode: ${options.roles[role]}.`;

  $('#intensity').replaceChildren(...[1, 2, 3, 4, 5].map((n) => el('button', {
    class: 'chip', role: 'radio', 'aria-checked': String(n === intensity), text: String(n),
    'aria-label': `Intensity ${n} of 5`,
    onClick: (e) => {
      intensity = n;
      for (const c of $('#intensity').children) c.setAttribute('aria-checked', String(c === e.currentTarget));
    },
  })));

  $('#signs-box').hidden = role !== 'caregiver';
  $('#signs').replaceChildren(...Object.entries(options.overdoseSigns).map(([key, label]) => el('button', {
    class: 'chip', 'aria-pressed': String(selectedSigns.has(key)), text: label,
    onClick: (e) => {
      if (selectedSigns.has(key)) selectedSigns.delete(key); else selectedSigns.add(key);
      e.currentTarget.setAttribute('aria-pressed', String(selectedSigns.has(key)));
    },
  })));

  const situations = Object.entries(options.situations).filter(([, s]) => s.roles.includes(role));
  $('#situations').replaceChildren(...situations.map(([key, s]) => el('button', {
    class: `card-btn${key.startsWith('overdose') ? ' danger' : ''}`,
    text: s.label,
    onClick: (e) => runRequest({
      target: '#now-result',
      button: e.currentTarget,
      path: 'intervene',
      body: {
        situation: key,
        intensity,
        substance: state.profile.substances?.length === 1 ? state.profile.substances[0] : 'unspecified',
        signs: role === 'caregiver' ? [...selectedSigns] : [],
      },
      renderer: render.intervention,
    }),
  })));
}

/* ---------- Talk: voice check-in ---------- */

function initTalk() {
  const button = $('#record');
  const status = $('#record-status');
  let session = null;

  const setRecording = (on) => {
    button.setAttribute('aria-pressed', String(on));
    $('#record-label').textContent = on ? 'Stop and send' : 'Start talking';
  };

  async function send(blob) {
    setRecording(false);
    session = null;
    status.textContent = '';
    if (blob.size < 1000) {
      status.textContent = 'That was too short. Try again and speak for a few seconds.';
      return;
    }
    const data = await runRequest({
      target: '#talk-result',
      path: 'voice',
      body: { audio: await blobToBase64(blob), mimeType: blob.type },
      renderer: (d) => render.voiceResult(d, handleNextTool),
    });
    if (data) speak(data.reply, speechLang());
  }

  button.addEventListener('click', async () => {
    if (session) {
      session.stop();
      return;
    }
    try {
      session = await startRecording();
      setRecording(true);
      status.textContent = 'Listening… tap again when you are done.';
      session.done.then(send);
    } catch (err) {
      session = null;
      status.textContent = err.name === 'NotAllowedError'
        ? 'Microphone permission was denied. You can still use the one-tap buttons in Now.'
        : err.message;
    }
  });
}

function handleNextTool(tool) {
  if (tool === 'breathe') breathing.open();
  else if (tool === 'intervene') showTab('now');
  else if (tool === 'script') showTab('script');
  else if (tool === 'learn') showTab('learn');
  else window.location.href = `tel:${helplines().emergency}`;
}

/* ---------- Scan: photo safety check ---------- */

function initScan() {
  const input = $('#scan-input');
  const preview = $('#scan-preview');
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const blob = await downscaleImage(file);
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.src = URL.createObjectURL(blob);
    preview.hidden = false;
    await runRequest({
      target: '#scan-result',
      path: 'scan',
      body: { image: await blobToBase64(blob), mimeType: 'image/jpeg' },
      renderer: render.scanResult,
    });
    input.value = '';
  });
}

/* ---------- Script and Learn ---------- */

function renderChoiceGrid(container, entries, onPick) {
  $(container).replaceChildren(...entries.map(([key, label]) => el('button', {
    class: 'card-btn', text: label, onClick: (e) => onPick(key, e.currentTarget),
  })));
}

function compactProfile() {
  return Object.fromEntries(Object.entries(state.profile).filter(([, v]) => v !== '' && v !== undefined
    && !(Array.isArray(v) && v.length === 0)));
}

function renderScriptAndLearn() {
  renderChoiceGrid('#scenarios', Object.entries(options.scriptScenarios), (scenario, button) => runRequest({
    target: '#script-result', button, path: 'script', body: { scenario, profile: compactProfile() }, renderer: render.script,
  }));
  renderChoiceGrid('#topics', Object.entries(options.learnTopics), (topic, button) => runRequest({
    target: '#learn-result', button, path: 'learn', body: { topic }, renderer: render.learnCard,
  }));
}

/* ---------- Me: settings, profile, helplines ---------- */

function fillSelect(select, entries, value) {
  select.replaceChildren(...entries.map(([key, label]) => el('option', { value: key, text: label, selected: key === value })));
}

function renderMe() {
  const s = settings();
  fillSelect($('#f-role'), Object.entries(options.roles), s.role);
  fillSelect($('#f-language'), Object.entries(options.languages).map(([k, l]) => [k, l.label]), s.language);
  fillSelect($('#f-country'), Object.entries(options.helplines).map(([k, h]) => [k, h.name]), s.country);

  const form = $('#profile-form');
  for (const field of ['name', 'age', 'location', 'medications', 'conditions', 'emergencyContact']) {
    form.elements[field].value = state.profile[field] ?? '';
  }
  const chosen = new Set(state.profile.substances ?? []);
  $('#f-substances').replaceChildren(...Object.entries(options.substances).map(([key, label]) => el('label', {}, [
    el('input', { type: 'checkbox', name: 'substances', value: key, checked: chosen.has(key) }), label,
  ])));
  renderHelplines();
}

function renderHelplines() {
  const h = helplines();
  $('#helplines').replaceChildren(...render.helplineList(h));
  $('#sos').href = `tel:${h.emergency}`;
  $('#sos').setAttribute('aria-label', `Call emergency services ${h.emergency}`);
  $('#sos-number').textContent = h.emergency;
  document.documentElement.lang = settings().language;
}

function readProfileForm(form) {
  const data = new FormData(form);
  const text = (k) => String(data.get(k) ?? '').trim();
  const age = Number.parseInt(text('age'), 10);
  return {
    settings: { role: text('role'), language: text('language'), country: text('country') },
    profile: {
      name: text('name'),
      age: Number.isFinite(age) ? age : undefined,
      location: text('location'),
      medications: text('medications'),
      conditions: text('conditions'),
      emergencyContact: text('emergencyContact'),
      substances: data.getAll('substances').map(String),
    },
  };
}

function initMe() {
  const form = $('#profile-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    state = readProfileForm(form);
    const saved = saveState(state);
    $('#profile-status').textContent = saved ? 'Saved on this device.' : 'Could not save: storage is blocked in this browser.';
    renderNow();
    renderHelplines();
  });
  $('#clear-data').addEventListener('click', () => {
    state = clearState();
    renderAll();
    $('#profile-status').textContent = 'All your data was deleted from this device.';
  });
}

/* ---------- Boot ---------- */

function renderAll() {
  renderNow();
  renderScriptAndLearn();
  renderMe();
}

async function boot() {
  initTabs();
  try {
    options = await getOptions();
  } catch {
    $('#now-result').replaceChildren(el('p', { class: 'error', role: 'alert', text: 'Anchor could not load. In an emergency, tap SOS.' }));
    return;
  }
  renderAll();
  initTalk();
  initScan();
  initMe();
  $('#open-breathe').addEventListener('click', breathing.open);
}

boot();
