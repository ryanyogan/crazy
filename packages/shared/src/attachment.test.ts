import { describe, expect, test } from 'vite-plus/test'
import {
  ATTACHMENT_LIMITS,
  ATTACHMENT_REFUSALS,
  attachmentKey,
  declaredType,
  isAttachmentType,
  keyBelongsTo,
  sniffImageType,
} from './attachment'
import { type CommandState, type TodoFacts, command, decide } from './command'

const NOW = new Date('2025-09-17T13:41:00.000Z')

const todo = (id: string): TodoFacts => ({
  id,
  state: 'today',
  source: null,
  projectId: null,
  snoozedUntil: null,
  swappedOnDay: null,
  slotHours: [],
  touchedAt: '2025-09-17T09:00:00.000Z',
  carryCount: 0,
})

/** The user's own rows, and only their own: that is what `loadCommandState` loads. */
const state = (over: Partial<CommandState> = {}): CommandState => ({
  day: '2025-09-17',
  todos: [todo('todo_receipt')],
  signals: [],
  events: [],
  ...over,
})

const add = (over: Record<string, unknown> = {}) => ({
  type: 'attachment.add' as const,
  id: 'att_1',
  todoId: 'todo_receipt',
  contentType: 'image/png',
  size: 2048,
  ...over,
})

describe('attaching a file to a Todo', () => {
  test("a picture on the user's own Todo is recorded, and the moment is the command's", () => {
    expect(decide(state(), add(), NOW)).toEqual({
      ok: true,
      ops: [
        {
          type: 'attachment.insert',
          attachment: {
            id: 'att_1',
            todoId: 'todo_receipt',
            contentType: 'image/png',
            size: 2048,
            createdAt: '2025-09-17T13:41:00.000Z',
          },
        },
      ],
    })
  })

  test('every type a photo of a receipt or a screenshot arrives as is allowed', () => {
    for (const contentType of ATTACHMENT_LIMITS.contentTypes) {
      expect(decide(state(), add({ contentType }), NOW)).toMatchObject({ ok: true })
    }
  })

  test("a Todo that is not the user's is refused, and is not told apart from one that is gone", () => {
    // Only the user's own Todos are ever loaded, so another user's is absent.
    expect(decide(state({ todos: [] }), add(), NOW)).toEqual({
      ok: false,
      reason: ATTACHMENT_REFUSALS.notYourTodo,
    })
    expect(decide(state(), add({ todoId: 'todo_theirs' }), NOW)).toEqual({
      ok: false,
      reason: ATTACHMENT_REFUSALS.notYourTodo,
    })
  })

  test('anything that is not one of the few pictures is refused', () => {
    for (const contentType of [
      'text/plain',
      'text/html',
      'application/pdf',
      // A drawing can carry script, and an Attachment is served from our origin.
      'image/svg+xml',
      'application/octet-stream',
    ]) {
      expect(decide(state(), add({ contentType }), NOW)).toEqual({
        ok: false,
        reason: ATTACHMENT_REFUSALS.type,
      })
    }
  })

  test('a file over the cap is refused, and one exactly at it is not', () => {
    expect(decide(state(), add({ size: ATTACHMENT_LIMITS.maxBytes + 1 }), NOW)).toEqual({
      ok: false,
      reason: ATTACHMENT_REFUSALS.size,
    })
    expect(decide(state(), add({ size: ATTACHMENT_LIMITS.maxBytes }), NOW)).toMatchObject({
      ok: true,
    })
  })

  test('an empty file is refused: there is nothing to attach', () => {
    expect(decide(state(), add({ size: 0 }), NOW)).toEqual({
      ok: false,
      reason: ATTACHMENT_REFUSALS.empty,
    })
  })

  test('a browser may not say a file exists: both Attachment commands are the server’s', () => {
    expect(command.parse(add())).toMatchObject({ type: 'attachment.add' })
    // What keeps them out of the browser is SERVER_ONLY, checked in `sendCommand`.
    expect(command.parse({ type: 'attachment.remove', attachmentId: 'att_1' })).toMatchObject({
      type: 'attachment.remove',
    })
  })
})

describe('taking an Attachment out again', () => {
  test("only the user's own can be removed", () => {
    const mine = state({ attachments: [{ id: 'att_1', todoId: 'todo_receipt' }] })
    expect(decide(mine, { type: 'attachment.remove', attachmentId: 'att_1' }, NOW)).toEqual({
      ok: true,
      ops: [{ type: 'attachment.delete', id: 'att_1' }],
    })
    expect(decide(state(), { type: 'attachment.remove', attachmentId: 'att_1' }, NOW)).toEqual({
      ok: false,
      reason: ATTACHMENT_REFUSALS.notYours,
    })
  })
})

describe('where the bytes go', () => {
  test('a key is derived from the owner, the Todo and the Attachment', () => {
    expect(attachmentKey('user_a', 'todo_1', 'att_1')).toBe('users/user_a/todos/todo_1/att_1')
    expect(keyBelongsTo(attachmentKey('user_a', 'todo_1', 'att_1'), 'user_a')).toBe(true)
    expect(keyBelongsTo(attachmentKey('user_a', 'todo_1', 'att_1'), 'user_b')).toBe(false)
  })

  test('an id full of slashes still lands under its owner, because a key is a flat string', () => {
    const key = attachmentKey('user_a', '../user_b/todos/x', 'att_1')
    expect(keyBelongsTo(key, 'user_a')).toBe(true)
    expect(keyBelongsTo(key, 'user_b')).toBe(false)
  })
})

describe('what the file itself says it is', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])
  const gif = new Uint8Array([...'GIF89a'].map((each) => each.charCodeAt(0)))
  const webp = new Uint8Array([
    ...[...'RIFF'].map((each) => each.charCodeAt(0)),
    0x1a,
    0,
    0,
    0,
    ...[...'WEBP'].map((each) => each.charCodeAt(0)),
  ])

  test('each picture is recognised by its first bytes', () => {
    expect(sniffImageType(png)).toBe('image/png')
    expect(sniffImageType(jpeg)).toBe('image/jpeg')
    expect(sniffImageType(gif)).toBe('image/gif')
    expect(sniffImageType(webp)).toBe('image/webp')
  })

  const bytesOf = (text: string) => new Uint8Array([...text].map((each) => each.charCodeAt(0)))

  test('anything else is nothing', () => {
    expect(sniffImageType(bytesOf('<svg onload=alert(1)>'))).toBe(null)
    expect(sniffImageType(bytesOf('<!doctype html>'))).toBe(null)
    expect(sniffImageType(new Uint8Array([]))).toBe(null)
    // A GIF one byte short is not a GIF.
    expect(sniffImageType(gif.slice(0, 5))).toBe(null)
  })

  test('a content type is compared as its type, never as the header it arrived in', () => {
    expect(declaredType('IMAGE/PNG; charset=binary')).toBe('image/png')
    expect(declaredType(null)).toBe('')
    expect(isAttachmentType(declaredType('image/png'))).toBe(true)
    expect(isAttachmentType(declaredType('image/svg+xml'))).toBe(false)
  })
})
