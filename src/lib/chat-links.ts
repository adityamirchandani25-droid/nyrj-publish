/**
 * Matches Markdown-style `[label](/path)` links in assistant replies. Only
 * same-origin paths are allowed: the target must start with a single "/", so
 * protocol-relative URLs such as `//evil.example` can never be produced.
 * Returns a fresh RegExp because global patterns keep `lastIndex` state.
 */
export function chatLinkPattern(): RegExp {
  return /\[([^\]]+)\]\((\/(?!\/)[a-zA-Z0-9/_\-.$?=&#]*)\)/g;
}
