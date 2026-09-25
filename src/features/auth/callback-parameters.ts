const callbackKeys = [
  'code', 'access_token', 'refresh_token', 'token_hash', 'type',
  'error', 'error_code', 'error_description',
] as const;

type RouteParameters = Record<string, string | string[] | undefined>;

function isAuthUrl(url: string, routePath: string) {
  const path = url.split(/[?#]/, 1)[0];
  return path.endsWith(`://${routePath}`) || path.endsWith(`/${routePath}`) ||
    path.endsWith(`://${routePath}/`) || path.endsWith(`/${routePath}/`);
}

export function readAuthLinkParameters(urls: (string | null | undefined)[], route: RouteParameters, routePath: string) {
  const routeValues = new URLSearchParams();
  const fragment = route['#'];
  if (typeof fragment === 'string') {
    new URLSearchParams(fragment.replace(/^#/, '')).forEach((value, key) => routeValues.set(key, value));
  }
  for (const key of callbackKeys) {
    const value = route[key];
    if (typeof value === 'string') routeValues.set(key, value);
  }
  for (const url of urls) {
    if (!url || !isAuthUrl(url, routePath)) continue;
    try {
      const parsed = new URL(url);
      const nativeValues = new URLSearchParams(parsed.search);
      new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => nativeValues.set(key, value));
      if (['code', 'access_token', 'refresh_token', 'token_hash', 'error']
        .some((key) => nativeValues.has(key))) return nativeValues;
    } catch {
      // A malformed native URL is ignored; route parameters may still be usable.
    }
  }
  return routeValues;
}

export function readConfirmationParameters(urls: (string | null | undefined)[], route: RouteParameters) {
  return readAuthLinkParameters(urls, route, 'auth/callback');
}
