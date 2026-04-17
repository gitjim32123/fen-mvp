type QueuedRequest = {
  execute: () => Promise<Response>;
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  retries: number;
};

const MAX_CONCURRENT = 3;
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

let activeCount = 0;
const queue: QueuedRequest[] = [];

function jitter(ms: number): number {
  return ms * (0.5 + Math.random() * 0.5);
}

function exponentialBackoff(retry: number, retryAfterMs?: number): number {
  if (retryAfterMs) return jitter(retryAfterMs);
  return jitter(BASE_DELAY_MS * Math.pow(2, retry));
}

function logRetry(retry: number, delayMs: number, status?: number) {
  console.log(
    `[FEN request-queue] 429 throttled — retry ${retry + 1}/${MAX_RETRIES}, delay ${Math.round(delayMs)}ms, status ${status || "?"}`
  );
}

function processQueue() {
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const next = queue.shift()!;
    activeCount++;
    next.execute()
      .then(async (res) => {
        if (res.status === 429 && next.retries < MAX_RETRIES) {
          const retryAfterHeader = res.headers.get("Retry-After");
          const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : undefined;
          const delay = exponentialBackoff(next.retries, retryAfterMs);
          logRetry(next.retries, delay, res.status);
          await new Promise((r) => setTimeout(r, delay));
          next.retries++;
          queue.unshift(next);
          activeCount--;
          processQueue();
          return;
        }
        activeCount--;
        next.resolve(res);
        processQueue();
      })
      .catch((err) => {
        activeCount--;
        if (next.retries < MAX_RETRIES) {
          const delay = exponentialBackoff(next.retries);
          logRetry(next.retries, delay);
          setTimeout(() => {
            next.retries++;
            queue.unshift(next);
            processQueue();
          }, delay);
        } else {
          next.reject(err);
        }
        processQueue();
      });
  }
}

export function throttledFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((resolve, reject) => {
    const execute = () => fetch(input, init);
    queue.push({ execute, resolve, reject, retries: 0 });
    processQueue();
  });
}
