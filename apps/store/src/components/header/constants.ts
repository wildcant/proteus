/**
 * Shared by the trigger, which shows it as a label, and the field, which shows it as a
 * placeholder. Same words in both places, and they have to stay that way — the trigger is
 * pretending to be the field it opens.
 */
export const SEARCH_PLACEHOLDER = 'What are you looking for today?'

/**
 * A preview, not the result set — four fills one row above `lg` and two on a phone, and the
 * "View all" link carries the shopper to the PLP for the rest.
 */
export const SEARCH_RESULTS_LIMIT = 4

/**
 * Long enough that a typed word is one query rather than six, short enough that the grid feels
 * like it is keeping up. Bypassed when the field is cleared — see `SearchResults`.
 */
export const SEARCH_DEBOUNCE_MS = 250
