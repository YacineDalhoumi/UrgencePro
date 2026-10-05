// Illustrations des photos de démonstration (aucune vraie photo n'est embarquée).
import type { Media } from '@/data/types'
import { cn } from '@/lib/utils'

const SCENES: Record<string, { bg: [string, string]; draw: JSX.Element }> = {
  porte: {
    bg: ['#8a6a4f', '#5b4636'],
    draw: (
      <g>
        <rect x="58" y="20" width="84" height="140" rx="3" fill="#a07a58" stroke="#3e2f24" strokeWidth="3" />
        <rect x="68" y="32" width="64" height="50" rx="2" fill="none" stroke="#6d533f" strokeWidth="3" />
        <rect x="68" y="92" width="64" height="56" rx="2" fill="none" stroke="#6d533f" strokeWidth="3" />
        <circle cx="128" cy="96" r="5" fill="#d9c27a" />
        <rect x="124" y="104" width="8" height="12" rx="2" fill="#2a2a2a" />
      </g>
    ),
  },
  serrure: {
    bg: ['#56606e', '#2f3640'],
    draw: (
      <g>
        <rect x="70" y="30" width="60" height="120" rx="8" fill="#c9ccd1" stroke="#1d2129" strokeWidth="3" />
        <circle cx="100" cy="70" r="10" fill="#1d2129" />
        <rect x="96" y="76" width="8" height="22" rx="2" fill="#1d2129" />
        <rect x="88" y="112" width="24" height="10" rx="3" fill="#8a8f97" />
      </g>
    ),
  },
  cylindre: {
    bg: ['#6b5d48', '#3c3328'],
    draw: (
      <g>
        <rect x="45" y="78" width="110" height="34" rx="16" fill="#d8b75c" stroke="#5a4a22" strokeWidth="3" />
        <circle cx="62" cy="95" r="10" fill="#5a4a22" />
        <path d="M62 95 h40" stroke="#5a4a22" strokeWidth="5" />
        <path d="M118 70 l12 10 -8 6 14 10" stroke="#b91c1c" strokeWidth="4" fill="none" />
      </g>
    ),
  },
  effraction: {
    bg: ['#6e4b3a', '#3a2820'],
    draw: (
      <g>
        <rect x="58" y="20" width="84" height="140" rx="3" fill="#9a7352" stroke="#2b1f17" strokeWidth="3" />
        <path d="M120 70 l10 12 -9 6 12 14 -8 7 10 12" stroke="#1a120d" strokeWidth="4" fill="none" />
        <circle cx="128" cy="96" r="7" fill="#3a3a3a" />
        <path d="M110 40 l25 8 M108 128 l26 -6" stroke="#e8d3b0" strokeWidth="3" />
      </g>
    ),
  },
  fuite: {
    bg: ['#5a7891', '#2c4153'],
    draw: (
      <g>
        <rect x="30" y="40" width="140" height="18" rx="9" fill="#b8c2cc" stroke="#33424f" strokeWidth="3" />
        <rect x="92" y="36" width="20" height="26" rx="3" fill="#8b98a5" stroke="#33424f" strokeWidth="3" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${100 + i * 3} ${78 + i * 26} c-7 10 -7 16 0 16 c7 0 7 -6 0 -16z`} fill="#7cc4f2" />
        ))}
        <ellipse cx="102" cy="160" rx="38" ry="8" fill="#7cc4f2" opacity=".7" />
      </g>
    ),
  },
  evier: {
    bg: ['#6f7f8c', '#3b4650'],
    draw: (
      <g>
        <rect x="30" y="40" width="140" height="22" rx="4" fill="#d6dbe0" stroke="#2d3740" strokeWidth="3" />
        <path d="M90 62 v40 a14 14 0 0 0 28 0 v-10" stroke="#aab4be" strokeWidth="10" fill="none" />
        <path d="M70 140 h70" stroke="#2d3740" strokeWidth="4" />
        <path d="M112 112 c-5 8 -5 12 0 12 c5 0 5 -4 0 -12z" fill="#7cc4f2" />
      </g>
    ),
  },
  wc: {
    bg: ['#7d8b8f', '#46504f'],
    draw: (
      <g>
        <rect x="64" y="26" width="72" height="44" rx="6" fill="#f2f4f5" stroke="#2f3a3d" strokeWidth="3" />
        <path d="M58 80 h84 c0 36 -20 56 -42 56 s-42 -20 -42 -56z" fill="#f2f4f5" stroke="#2f3a3d" strokeWidth="3" />
        <ellipse cx="100" cy="92" rx="30" ry="8" fill="#8fb4bf" />
        <rect x="84" y="136" width="32" height="20" fill="#f2f4f5" stroke="#2f3a3d" strokeWidth="3" />
      </g>
    ),
  },
  ballon: {
    bg: ['#7a8a9a', '#3e4a56'],
    draw: (
      <g>
        <rect x="66" y="16" width="68" height="128" rx="30" fill="#eef1f4" stroke="#2c3640" strokeWidth="3" />
        <rect x="88" y="144" width="8" height="22" fill="#9aa5b1" />
        <rect x="104" y="144" width="8" height="22" fill="#9aa5b1" />
        <rect x="84" y="60" width="32" height="16" rx="3" fill="#cfd6dd" />
      </g>
    ),
  },
  plafond: {
    bg: ['#b9b3a6', '#8a8478'],
    draw: (
      <g>
        <path d="M60 50 c20 -14 52 -10 66 6 c18 2 22 22 10 34 c4 18 -18 30 -36 22 c-20 10 -46 -4 -42 -24 c-14 -10 -10 -32 2 -38z" fill="#8f7f62" opacity=".75" />
        <path d="M70 62 c16 -8 36 -6 46 6" stroke="#6f6046" strokeWidth="3" fill="none" />
      </g>
    ),
  },
  chaudiere: {
    bg: ['#6d7681', '#363d46'],
    draw: (
      <g>
        <rect x="56" y="18" width="88" height="136" rx="6" fill="#f4f5f6" stroke="#262c33" strokeWidth="3" />
        <rect x="72" y="40" width="56" height="26" rx="3" fill="#13212e" />
        <text x="100" y="59" textAnchor="middle" fontFamily="monospace" fontSize="16" fontWeight="700" fill="#ff5a3c">F28</text>
        <circle cx="82" cy="92" r="7" fill="#cbd2d9" />
        <circle cx="118" cy="92" r="7" fill="#cbd2d9" />
      </g>
    ),
  },
}

export function MediaArt({ media, className }: { media: Media; className?: string }) {
  if (media.src) return <img src={media.src} alt={media.caption} className={cn('h-full w-full object-cover', className)} />
  const scene = SCENES[media.art ?? 'porte'] ?? SCENES.porte
  const gid = `g-${media.id}`
  return (
    <svg viewBox="0 0 200 180" className={cn('h-full w-full', className)} role="img" aria-label={media.caption} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={scene.bg[0]} />
          <stop offset="1" stopColor={scene.bg[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="180" fill={`url(#${gid})`} />
      {scene.draw}
    </svg>
  )
}
