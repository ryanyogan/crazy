import { ClerkProvider } from '@clerk/tanstack-react-start'
import { PRELOAD_FONTS } from '@crazy/ui'
import fontsCss from '@crazy/ui/styles/fonts.css?url'
import industryCss from '@crazy/ui/styles/industry.css?url'
import primitivesCss from '@crazy/ui/styles/primitives.css?url'
import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { clerkEnabled } from '#/lib/auth'
import appCss from '#/styles/app.css?url'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'theme-color', content: '#f2f2f3' },
      { title: 'Crazy' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ...PRELOAD_FONTS.map((href) => ({
        rel: 'preload',
        as: 'font',
        type: 'font/woff2',
        href,
        crossOrigin: 'anonymous' as const,
      })),
      { rel: 'stylesheet', href: fontsCss },
      { rel: 'stylesheet', href: industryCss },
      { rel: 'stylesheet', href: primitivesCss },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
})

/** Clerk's own surfaces (the profile modal) dressed in Industry. */
const clerkAppearance = {
  variables: {
    colorPrimary: '#5980a6',
    colorBackground: '#f2f2f3',
    colorForeground: '#1d1f20',
    colorMutedForeground: '#5d5d60',
    colorInput: '#e9e9ea',
    colorInputForeground: '#1d1f20',
    borderRadius: '0px',
    fontFamily: 'Barlow, system-ui, sans-serif',
  },
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {clerkEnabled ? (
          <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
        ) : (
          children
        )}
        <Scripts />
      </body>
    </html>
  )
}
