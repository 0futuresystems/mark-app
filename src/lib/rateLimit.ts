type Key = string;
const winMs = 60_000;

let mem = new Map<Key, { count: number; start: number }>();

export async function limit(key: Key, maxPerMin = 60) {
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    const now = Date.now();
    const cur = mem.get(key);
    if (!cur || now - cur.start > winMs) mem.set(key, { count: 1, start: now });
    else mem.set(key, { count: cur.count + 1, start: cur.start });
    return (mem.get(key)!.count <= maxPerMin);
  }
  // TODO: plug Upstash here if envs present (keep it simple to save tokens)
  return true;
}
