/** Raised when the AI engine cannot produce a trustworthy answer (missing key, timeout, block, bad JSON). */
export class AiUnavailableError extends Error {
  constructor(reason, options) {
    super(`AI engine unavailable: ${reason}`, options);
    this.name = 'AiUnavailableError';
    this.reason = reason;
  }
}
