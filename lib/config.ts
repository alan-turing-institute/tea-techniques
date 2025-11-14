// Get base path from environment or default to empty string
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * Get the correct asset path with base path prefix when needed.
 * This ensures assets work correctly in both local dev and GitHub Pages.
 *
 * @param path - The asset path starting with /
 * @returns The full path including base path if configured
 */
export function getAssetPath(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // In production with base path, prepend it
  if (BASE_PATH) {
    return `${BASE_PATH}${normalizedPath}`;
  }

  return normalizedPath;
}
