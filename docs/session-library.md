# Session Library

UI component to list, save, load, and delete sessions persisted in IndexedDB.

- Saving requires a loaded session in memory.
- Errors are surfaced inline if operations fail.

```tsx
<SessionLibrary loader={useFileLoader()} />
```

