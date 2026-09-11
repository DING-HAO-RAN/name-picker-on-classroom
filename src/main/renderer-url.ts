const localHostnames = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function getDevelopmentRendererUrl(
  isPackaged: boolean,
  rendererUrl: string | undefined,
): string | undefined {
  if (isPackaged !== false || rendererUrl === undefined) {
    return undefined;
  }

  try {
    const url = new URL(rendererUrl);
    if (url.protocol !== 'http:' || !localHostnames.has(url.hostname.toLowerCase())) {
      return undefined;
    }

    return rendererUrl;
  } catch {
    return undefined;
  }
}
