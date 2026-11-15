/**
 * One extension name, in the form each shared namespace uses.
 *
 * An extension's name (`pisos-dj`) is lowercase words joined by hyphens. Every name it adds to a
 * namespace core also writes into carries that name as a prefix, so a later core name cannot collide
 * with it: database names in snake case, runtime names (module keys, workflows, subscribers, jobs,
 * events) with a dot, and identifiers (OpenAPI components, operation ids, exported models) in camel
 * or Pascal case.
 */

export const EXTENSION_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

export function isExtensionName(name: string): boolean {
  return EXTENSION_NAME_PATTERN.test(name)
}

/** `pisos-dj` → `pisos_dj_`: tables, indexes, constraints, enums, migration tables. */
export function databasePrefix(extension: string): string {
  return `${extension.replaceAll('-', '_')}_`
}

/** `pisos-dj` → `pisos-dj.`: module keys, workflow, subscriber, job and event names. */
export function runtimePrefix(extension: string): string {
  return `${extension}.`
}

/** `pisos-dj` → `pisosDj`: operation ids, exported model identifiers. */
export function camelPrefix(extension: string): string {
  const [first = '', ...rest] = extension.split('-')
  return [first, ...rest.map((word) => word.charAt(0).toUpperCase() + word.slice(1))].join('')
}

/** `pisos-dj` → `PisosDj`: OpenAPI component names. */
export function pascalPrefix(extension: string): string {
  const camel = camelPrefix(extension)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

/**
 * Whether `name` carries the extension's prefix in `prefix`'s form and has something after it. A
 * camel or Pascal prefix must be followed by an upper-case letter or a digit, so `pisosDjx` does not
 * pass for `pisosDj`.
 */
export function hasPrefix(name: string, prefix: string): boolean {
  if (!name.startsWith(prefix) || name.length === prefix.length) return false
  if (prefix.endsWith('_') || prefix.endsWith('.')) return true
  return /[A-Z0-9]/.test(name.charAt(prefix.length))
}
