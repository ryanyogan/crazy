import { QueryClient } from '@tanstack/react-query'
import { Link, createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

function NotFound() {
  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">Not found</h1>
        <p className="text-muted">
          That page does not exist. <Link to="/">Back to the Today screen</Link>
        </p>
      </header>
    </div>
  )
}

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Loaders only warm the query cache, so freshness is React Query's call.
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  // Dehydrates the cache into the SSR stream and wraps the app in the provider.
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
