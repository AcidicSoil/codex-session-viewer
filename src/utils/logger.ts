const LOG_ENDPOINT = (import.meta as any).env?.VITE_LOG_SERVER_URL || 'http://127.0.0.1:4317/log'

async function postLog(payload: any) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      // @ts-ignore
      mode: 'cors',
    })
  } catch {
    // ignore network errors
  }
}

export function logError(context: string, error: unknown, extra?: unknown) {
  try {
    // eslint-disable-next-line no-console
    console.error(`[${context}]`, error, extra)
    const w = window as any
    if (w) {
      w.__csvErrors = w.__csvErrors || []
      w.__csvErrors.push({ at: new Date().toISOString(), context, error: String((error as any)?.message ?? error), extra })
      const payload = {
        level: 'error',
        context,
        message: String((error as any)?.message ?? error),
        stack: (error as any)?.stack,
        extra,
        href: window.location?.href,
      }
      postLog(payload)
    }
  } catch {
    // ignore
  }
}

export function logInfo(context: string, message: string, extra?: unknown) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[${context}]`, message, extra)
    postLog({ level: 'info', context, message, extra, href: window.location?.href })
  } catch {}
}

