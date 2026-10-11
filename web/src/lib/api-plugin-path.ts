/** Encode a plugin registry key for URL paths while preserving segment separators. */
export function pluginPath(name: string): string {
  return name.split('/').map(encodeURIComponent).join('/')
}
