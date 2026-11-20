export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || ApiError.messageFor(status));
    this.status = status;
    this.body = body;
  }

  static messageFor(status) {
    if (status === 429) return 'Too many requests. Please wait a minute and try again.';
    if (status === 413) return 'That file is too large. Try a shorter recording or a smaller photo.';
    if (status === 400) return 'Something in the request was not valid. Please try again.';
    return 'Something went wrong. If you are in danger, call a helpline now.';
  }
}

export async function getOptions() {
  const res = await fetch('/api/options');
  if (!res.ok) throw new ApiError(res.status);
  return res.json();
}

export async function post(path, body) {
  let res;
  try {
    res = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, { message: 'You seem to be offline. Helplines still work: tap SOS or see Me.' });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
