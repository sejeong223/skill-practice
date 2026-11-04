export interface TabSession { sessionId: string; release(): void }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function claimTabSession(playerId: string, storage: Storage | null = window.sessionStorage,
  locks: LockManager | undefined = navigator.locks): Promise<TabSession> {
  const key = "legendary-rib-corgi:tab:" + playerId;
  let previous: string | null = null;
  try { previous = storage?.getItem(key) ?? null; } catch { /* A fresh ID is safe without session storage. */ }
  let sessionId = locks && previous && uuid.test(previous) ? previous : crypto.randomUUID();
  let release = () => {};
  if (locks) {
    for (;;) {
      const claimed = await new Promise<boolean>((resolve, reject) => {
        void locks.request(key + ":" + sessionId, { ifAvailable: true }, lock => {
          if (!lock) { resolve(false); return; }
          return new Promise<void>(unlock => { release = unlock; resolve(true); });
        }).catch(reject);
      });
      if (claimed) break;
      sessionId = crypto.randomUUID();
    }
  }
  try { storage?.setItem(key, sessionId); } catch { /* Still fenced by the server and the lock. */ }
  return { sessionId, release };
}
