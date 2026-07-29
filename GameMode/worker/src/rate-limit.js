const buckets = new Map();

export function allowRequest(key, limit, windowMs) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  if (buckets.size > 2000) {
    for (const [name, item] of buckets) if (now >= item.resetAt) buckets.delete(name);
  }
  return true;
}
