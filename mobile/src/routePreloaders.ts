export const dockRoutePreloaders: Record<string, () => Promise<unknown>> = {
  '/feed': () => import('./pages/FeedPage'),
  '/eeg': () => import('./pages/EegPage'),
  '/consult': () => import('./pages/ConsultPage'),
  '/health': () => import('./pages/HealthPage'),
  '/chat': () => import('./pages/ChatPage'),
  '/dashboard': () => import('./pages/ProDashboardPage'),
};

const preloaded = new Set<string>();

export function preloadDockRoute(path: string): void {
  if (preloaded.has(path)) return;
  const loader = dockRoutePreloaders[path];
  if (!loader) return;
  preloaded.add(path);
  void loader().catch(() => {
    preloaded.delete(path);
  });
}

export function preloadDockRoutes(paths: string[]): void {
  for (const path of paths) {
    preloadDockRoute(path);
  }
}
