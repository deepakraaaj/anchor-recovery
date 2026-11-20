import { $ } from './dom.js';

const PHASES = [
  { label: 'Breathe in', seconds: 4, expand: true },
  { label: 'Hold', seconds: 4, expand: true },
  { label: 'Breathe out', seconds: 6, expand: false },
];
const TOTAL_SECONDS = 10 * 60;

/** Guided urge-surfing breathing dialog with a 10-minute countdown. */
export function createBreathing() {
  const dialog = $('#breathe');
  const circle = dialog.querySelector('.breath-circle');
  let timers = [];

  // Timeouts and intervals share one ID pool in browsers, so clearTimeout clears both.
  const clear = () => { timers.forEach(clearTimeout); timers = []; };

  function runPhase(index) {
    const phase = PHASES[index % PHASES.length];
    $('#breath-phase').textContent = phase.label;
    circle.classList.toggle('in', phase.expand);
    if (index % PHASES.length === 0) $('#breath-live').textContent = phase.label;
    timers.push(setTimeout(() => runPhase(index + 1), phase.seconds * 1000));
  }

  function open() {
    clear();
    let left = TOTAL_SECONDS;
    const show = () => {
      $('#breath-timer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    };
    show();
    timers.push(setInterval(() => {
      left -= 1;
      show();
      if (left <= 0) close();
    }, 1000));
    runPhase(0);
    dialog.showModal();
  }

  function close() {
    clear();
    if (dialog.open) dialog.close();
  }

  $('#close-breathe').addEventListener('click', close);
  dialog.addEventListener('close', clear);
  return { open };
}
