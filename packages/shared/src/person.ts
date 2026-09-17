/** The one or two letters shown in the Shell's avatar box: "Mara Okafor" → "MO". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0]!
  const last = words.length > 1 ? words[words.length - 1]! : ''
  return `${[...first][0] ?? ''}${[...last][0] ?? ''}`.toUpperCase()
}

/** The name a greeting uses: "Ryan Yogan" → "Ryan". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}
