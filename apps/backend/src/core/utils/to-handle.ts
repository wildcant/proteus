/**
 * What `toHandle` writes: lowercase letters and digits in hyphen-separated runs. A handle is a
 * storefront path segment, so anything that matches this is safe to put in a URL as is.
 */
export const HANDLE_PATTERN = /^[\p{Ll}\p{Lo}\p{N}]+(?:-[\p{Ll}\p{Lo}\p{N}]+)*$/u

export const toHandle = (value: string): string => {
  let handle = value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!handle) {
    handle = `product-${Math.random().toString(36).substring(2, 8)}`
  }

  return handle
}
