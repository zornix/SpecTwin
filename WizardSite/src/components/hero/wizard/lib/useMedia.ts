import { useEffect, useState } from 'react'

/** Subscribe to a media query and re-render on change. SSR-safe-ish (defaults false). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True when the user has asked for reduced motion — drives the static fallback. */
export const usePrefersReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)')

/** Coarse mobile check: narrow viewport OR no fine pointer. Feeds the instance clamp. */
export const useIsMobile = () =>
  useMediaQuery('(max-width: 768px), (pointer: coarse)')
