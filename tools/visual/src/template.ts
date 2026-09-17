// The mockup is a Claude Design canvas: plain HTML plus two template
// constructs, filled from a data script at the end of the file.
//
//   <sc-for list="{{ stack }}" as="t"> … {{ t.title }} … </sc-for>
//
// Its own runtime (`support.js`) is not among the frozen design files, so this
// expands the source text instead. Text, not DOM, because several loops sit
// inside <tbody>, where an HTML parser would throw an unknown element out.

type Scope = Record<string, unknown>
type Node = string | Loop
interface Loop {
  list: string
  as: string
  children: Node[]
}

const LOOP_TAG = /<sc-for\s+([^>]*)>|<\/sc-for>/g
const HOLE = /\{\{\s*([\w$.]+)\s*\}\}/g
const LIST = /^\{\{\s*([\w$.]+)\s*\}\}$/

function attribute(attributes: string, name: string): string {
  const found = new RegExp(`\\b${name}="([^"]*)"`).exec(attributes)
  if (!found) throw new Error(`<sc-for> without ${name}: ${attributes}`)
  return found[1]!
}

function parse(source: string): Node[] {
  const root: Node[] = []
  const open: Loop[] = []
  const into = () => open.at(-1)?.children ?? root
  let from = 0
  for (const tag of source.matchAll(LOOP_TAG)) {
    into().push(source.slice(from, tag.index))
    from = tag.index + tag[0].length
    if (tag[1] === undefined) {
      if (!open.pop()) throw new Error('</sc-for> with no <sc-for> open')
      continue
    }
    const list = LIST.exec(attribute(tag[1], 'list'))
    if (!list) throw new Error(`<sc-for> list is not a {{ name }}: ${tag[1]}`)
    const loop: Loop = { list: list[1]!, as: attribute(tag[1], 'as'), children: [] }
    into().push(loop)
    open.push(loop)
  }
  if (open.length > 0) throw new Error(`<sc-for list="${open.at(-1)!.list}"> is never closed`)
  root.push(source.slice(from))
  return root
}

function lookup(scope: Scope, path: string): unknown {
  let value: unknown = scope
  for (const key of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Scope)[key]
  }
  return value
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

function fill(text: string, scope: Scope): string {
  return text.replace(HOLE, (_hole, path: string) => {
    const value = lookup(scope, path)
    if (value === undefined || value === null) return ''
    return String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]!)
  })
}

function render(nodes: Node[], scope: Scope): string {
  return nodes
    .map((node) => {
      if (typeof node === 'string') return fill(node, scope)
      const list = lookup(scope, node.list)
      if (!Array.isArray(list)) throw new Error(`{{ ${node.list} }} is not a list`)
      return list.map((item) => render(node.children, { ...scope, [node.as]: item })).join('')
    })
    .join('')
}

/** Expands every loop and hole in `source` from `values`. */
export function expand(source: string, values: Scope): string {
  return render(parse(source), values)
}

const DATA_SCRIPT = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/

/**
 * The values the canvas is filled from: what its `Component.renderVals()`
 * returns. The script is the frozen design file's own, so it is simply run.
 */
export function canvasValues(canvas: string): Scope {
  const script = DATA_SCRIPT.exec(canvas)
  if (!script) throw new Error('The canvas has no data script')
  const run = new Function('DCLogic', `${script[1]}\nreturn new Component().renderVals()`)
  return run(class {}) as Scope
}
