/**
 * Small text helpers shared across services.
 */

/** Truncate to `max` chars, appending an ellipsis when shortened. */
export function truncate(text: string, max = 500): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/**
 * Escape regex metacharacters so user input can be embedded in a `RegExp`
 * literally — prevents ReDoS and unintended regex behavior from search terms.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
