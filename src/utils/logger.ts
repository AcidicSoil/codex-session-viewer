export function logError(context: string, error: unknown, extra?: unknown) {
  try {
    // eslint-disable-next-line no-console
    console.error(`[${context}]`, error, extra)
    const w = window as any
    if (w) {
      w.__csvErrors = w.__csvErrors || []
      w.__csvErrors.push({ at: new Date().toISOString(), context, error: String((error as any)?.message ?? error), extra })
    }
  } catch {
    // ignore
  }
}

