# Sorting of Discovered Sessions

The All Sessions list supports two sort orders:

- Newest (default): uses `parseTimestampFromPath` to extract a timestamp from the path (YYYY-MM-DD / YYYYMMDD / epoch). Falls back to name when none is found.
- Name: ascending path name (A → Z).

Implementation details
- A `sortKey` is computed in `useAutoDiscovery()` using `parseTimestampFromPath` from `src/utils/timestamp.ts` and exposed on each asset.
- `SessionsList` also calls this utility locally for robustness.

Limitations
- If no timestamp can be parsed, items may group under the fallback.
- When multiple timestamps exist, the first match wins.
