interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  retryableErrorCodes?: string[];
}

const DEFAULT_RETRYABLE_CODES = [
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "ECONNRESET",
  "ETIMEDOUT",
];

function isRetryable(error: any, retryableCodes: string[]): boolean {
  // undici wraps the real error in error.cause
  const code = error?.code ?? error?.cause?.code;
  return retryableCodes.includes(code);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    retryableErrorCodes = DEFAULT_RETRYABLE_CODES,
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const retryable = isRetryable(error, retryableErrorCodes);
      const isLastAttempt = attempt === maxAttempts;

      if (!retryable || isLastAttempt) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** (attempt - 1); // 500ms, 1000ms, 2000ms...
      console.warn(
        `[withRetry] Attempt ${attempt} failed (${error?.cause?.code ?? error?.code}), retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
