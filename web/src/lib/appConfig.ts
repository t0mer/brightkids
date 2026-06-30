// Runtime config fetched once from GET /api/v1/config: the storage mode and
// whether text-to-speech is enabled. A module snapshot lets non-React code
// (speak()) gate synchronously; React components mirror the flag via the store.

export type AppMode = "public" | "private";

export interface AppConfig {
  mode: AppMode;
  tts: boolean;
}

let snapshot: AppConfig = { mode: "private", tts: false };
let promise: Promise<AppConfig> | null = null;

/** loadConfig fetches (and caches) the runtime config, defaulting safely. */
export function loadConfig(): Promise<AppConfig> {
  if (!promise) {
    promise = fetch("/api/v1/config")
      .then((r): Promise<{ mode?: string; tts?: boolean }> => (r.ok ? r.json() : Promise.resolve({})))
      .then((c) => {
        snapshot = { mode: c.mode === "public" ? "public" : "private", tts: !!c.tts };
        return snapshot;
      })
      .catch(() => snapshot);
  }
  return promise;
}

/** ttsEnabled reports the cached TTS flag (false until config resolves, so
 *  narration stays off by default). */
export function ttsEnabled(): boolean {
  return snapshot.tts;
}
