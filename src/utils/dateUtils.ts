export function parseAnyTimestamp(ts: any, fallbackTs?: any): Date {
  if (!ts && fallbackTs) {
    return parseAnyTimestamp(fallbackTs);
  }
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  if (typeof ts === 'number') {
    return new Date(ts);
  }
  // Firestore Timestamp object handling
  if (typeof ts === 'object') {
    if (typeof ts.toDate === 'function') {
      try {
        return ts.toDate();
      } catch (e) {
        // ignore
      }
    }
    if (typeof ts.seconds === 'number') {
      return new Date(ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000);
    }
    if (typeof ts._seconds === 'number') {
      return new Date(ts._seconds * 1000);
    }
  }
  return new Date();
}
