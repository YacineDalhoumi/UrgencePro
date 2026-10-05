import * as React from 'react'
import { useStore } from '@/store/store'

/** Applique le thème choisi (clair / sombre / automatique) sur la racine du document. */
export function useApplyTheme() {
  const theme = useStore((s) => s.theme)
  React.useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
  }, [theme])
}

const read = () => {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => `rgb(${cs.getPropertyValue(`--${n}`).trim().split(/\s+/).join(',')})`
  return {
    c1: v('c1'), c2: v('c2'), c3: v('c3'), c4: v('c4'), c5: v('c5'), c6: v('c6'),
    grid: v('border'), muted: v('muted'), fg: v('fg'), surface: v('surface'), accent: v('accent'), ok: v('ok'), bad: v('bad'), sunken: v('sunken'),
  }
}

/** Couleurs résolues pour recharts (qui écrit des attributs SVG), recalculées au changement de thème. */
export function useChartColors() {
  const theme = useStore((s) => s.theme)
  const [colors, setColors] = React.useState(read)
  React.useEffect(() => {
    const update = () => setColors(read())
    // Laisse le thème s'appliquer avant de relire les variables
    const t = setTimeout(update, 0)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      clearTimeout(t)
      mq.removeEventListener('change', update)
      obs.disconnect()
    }
  }, [theme])
  return colors
}
