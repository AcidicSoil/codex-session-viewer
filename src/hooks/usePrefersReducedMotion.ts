import * as React from 'react'

export function usePrefersReducedMotion() {
  const [prefers, setPrefers] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (event: MediaQueryListEvent) => setPrefers(event.matches)
    setPrefers(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return prefers
}

export default usePrefersReducedMotion
