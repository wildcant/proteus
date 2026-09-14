import { faker } from '@faker-js/faker'

/**
 * A URL for a seeded image, on a host that cannot be reached.
 *
 * `.test` is reserved (RFC 2606), so a browser never resolves it — and the e2e suites answer this
 * host themselves (`packages/testing/fixtures/test-extend.ts`). That is the whole reason it is not
 * `faker.image.url()`: that one points at picsum.photos, so every product grid a spec opened
 * fetched real photos over the public internet, and `waitUntil: 'networkidle'` waited for them.
 * A run's outcome then depended on someone else's CDN.
 */
export function fakeImageUrl(): string {
  return `https://cdn.test/${faker.string.alphanumeric(16)}.png`
}
