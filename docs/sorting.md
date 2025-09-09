# Sorting of Discovered Sessions

The All Sessions list supports two sort orders:

- Newest (default): attempts to parse a timestamp from path (YYYY-MM-DD / YYYYMMDD / epoch). Falls back to name.
- Name: ascending path name (A → Z).

Implementation details
- A `sortKey` is computed in `useAutoDiscovery()` and exposed on each asset.
- The UI also includes a local parser for robustness.

Limitations
- If no timestamp can be parsed, items may group under the fallback.
- When multiple timestamps exist, the first match wins.
