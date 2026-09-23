/**
 * A marker, not a translator: `i18n.t('…')` tags the English text for `lingui extract`, which
 * matches the call by name, and returns that text unchanged — the English sentence is the catalog
 * id. Translation happens later, where a response is written, against the request's language.
 *
 * The brand is what makes the marker enforceable. `AppError` takes `message: Msgid`, so a message
 * that skipped the marker, and so never reached a catalog, is a `tsc` error rather than English
 * that ships untranslated. It is still a string, so Zod and logs take it unchanged.
 *
 * Only the backend and the shared schemas use it. The store translates through `useLingui()`,
 * whose `i18n.t()` translates on the spot; two things named `i18n.t` in one file would read the
 * same and do different things.
 */
declare const brand: unique symbol

export type Msgid = string & { [brand]: true }

export const i18n = { t: (id: string) => id as Msgid }
