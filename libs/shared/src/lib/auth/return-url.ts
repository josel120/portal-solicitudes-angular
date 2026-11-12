import { Router, UrlTree } from '@angular/router';

/**
 * URL the user was trying to reach: the in-flight navigation target if any (guards, lazy loads),
 * otherwise the current URL. Never returns the login page itself.
 */
export function currentTargetUrl(router: Router): string {
  const navigation = router.currentNavigation();
  const url = navigation ? router.serializeUrl(navigation.extractedUrl) : router.url;
  return url.startsWith('/login') ? '/' : url;
}

export function loginUrlTree(router: Router, returnUrl: string = currentTargetUrl(router)): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: returnUrl === '/' ? {} : { returnUrl } });
}

/** Only allow in-app absolute paths as redirect targets (prevents open redirects via ?returnUrl=). */
export function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}
