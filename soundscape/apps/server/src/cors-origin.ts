const localWebOrigin = /^http:\/\/(localhost|127\.0\.0\.1):(3000|5173|5174)$/;

/** Only the request's actual Worker origin and intentional local Vite origins receive credentialed CORS. */
export function allowsBrowserOrigin(origin: string | undefined, requestOrigin: string): boolean {
  return !origin || origin === requestOrigin || localWebOrigin.test(origin);
}
