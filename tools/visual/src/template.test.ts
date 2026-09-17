import { expect, it } from 'vite-plus/test'
import { canvasValues, expand } from './template.ts'

it('fills holes from the values, escaping what HTML would misread', () => {
  expect(
    expand('<b style="width:{{ bar.w }}">{{ client }}</b>', {
      client: 'Quill & Co',
      bar: { w: '73%' },
    }),
  ).toBe('<b style="width:73%">Quill &amp; Co</b>')
  expect(expand('[{{ missing }}] [{{ bar.missing.deeper }}]', { bar: {} })).toBe('[] []')
})

it('repeats a loop for each item, inside a table and inside another loop', () => {
  const source =
    '<tbody><sc-for list="{{ days }}" as="d" hint-placeholder-count="2"><tr><td>{{ d.name }}</td>' +
    '<sc-for list="{{ d.items }}" as="i"><td>{{ i }} of {{ d.name }} · {{ week }}</td></sc-for></tr></sc-for></tbody>'
  expect(
    expand(source, {
      week: 'W38',
      days: [
        { name: 'Mon', items: ['a', 'b'] },
        { name: 'Tue', items: [] },
      ],
    }),
  ).toBe(
    '<tbody><tr><td>Mon</td><td>a of Mon · W38</td><td>b of Mon · W38</td></tr>' +
      '<tr><td>Tue</td></tr></tbody>',
  )
})

it('says which loop is wrong rather than drawing a broken frame', () => {
  expect(() => expand('<sc-for list="{{ rows }}" as="r">x', { rows: [] })).toThrow(/never closed/)
  expect(() => expand('<sc-for list="{{ rows }}" as="r">x</sc-for>', {})).toThrow(/not a list/)
})

it("reads the values from the canvas's own data script", () => {
  const canvas = `<x-dc></x-dc><script type="text/x-dc" data-dc-script>
class Component extends DCLogic {
  renderVals() {
    const stack = [{ title: 'Spike' }]
    return { stack }
  }
}
</script>`
  expect(canvasValues(canvas)).toEqual({ stack: [{ title: 'Spike' }] })
})
