import { expect, it } from 'vite-plus/test'
import { provisionInput } from './settings'

it('keeps a time zone the runtime knows', () => {
  expect(provisionInput.parse({ timeZone: 'America/Chicago' }).timeZone).toBe('America/Chicago')
})

it('drops a time zone it does not know rather than refusing the user', () => {
  expect(provisionInput.parse({ timeZone: 'Mars/Olympus' }).timeZone).toBeUndefined()
})
