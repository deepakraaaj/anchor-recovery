/** Browser media helpers: text-to-speech, microphone recording and image downscaling. */

export function speak(text, lang) {
  if (!('speechSynthesis' in window) || !text) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith(lang.slice(0, 2)));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export const stopSpeaking = () => window.speechSynthesis?.cancel();

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4'];

/** Records from the microphone until stop() is called or maxMs elapses. */
export async function startRecording({ maxMs = 60_000 } = {}) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    throw new Error('Voice recording is not supported in this browser.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = AUDIO_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 32_000 } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      resolve(new Blob(chunks, { type }));
    };
  });
  const timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), maxMs);
  recorder.start();

  return {
    stop() {
      clearTimeout(timer);
      if (recorder.state === 'recording') recorder.stop();
      return done;
    },
    done,
  };
}

/** Downscales a photo to keep uploads small and fast. Returns a JPEG blob. */
export async function downscaleImage(file, maxSide = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
