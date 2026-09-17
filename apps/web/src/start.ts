import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'
import { clerkEnabled } from './lib/auth'

export const startInstance = createStart(() => ({
  requestMiddleware: clerkEnabled ? [clerkMiddleware()] : [],
}))
