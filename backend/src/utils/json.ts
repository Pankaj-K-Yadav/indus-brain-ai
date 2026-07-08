/**
 * Parsing helpers for LLM responses.
 */

/**
 * Parse a JSON payload returned by an LLM, tolerating ```json fenced output.
 * Throws if the cleaned string is not valid JSON (callers handle the error).
 */
export function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  return JSON.parse(cleaned);
}
