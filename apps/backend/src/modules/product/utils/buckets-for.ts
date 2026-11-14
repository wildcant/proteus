/** The words of an option value, lower-cased and split at anything not a letter or a digit. */
function valueWords(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  )
}

/**
 * The bucket a value belongs in: the first of `buckets` (in rank order) listing one of its words, so
 * "Black / Red" is in Black when Black ranks above Red. `null` when none lists any.
 */
export function bucketFor(value: string, buckets: Array<{ id: string; words: string[] }>): string | null {
  const words = valueWords(value)
  return buckets.find((bucket) => bucket.words.some((word) => words.has(word)))?.id ?? null
}
