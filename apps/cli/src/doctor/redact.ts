/**
 * Report-boundary redaction.
 *
 * The whole report — `--json` and `-v` evidence included — exists to be pasted
 * into an issue, so anything that reaches it has to be safe to share. These
 * helpers are applied where a value enters a detail, a fix, or evidence; the
 * raw values keep flowing to the code that actually connects.
 */

/**
 * `https://user:password@host` is a normal way to point at a
 * basic-auth-protected deployment or a corporate proxy. Keep the host, drop
 * the credential.
 */
export function redactUrlCredentials(value: string): string;
export function redactUrlCredentials(value: string | undefined): string | undefined;
export function redactUrlCredentials(value: string | undefined): string | undefined {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (!url.username && !url.password) return value;
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    // Not a URL (NO_PROXY is a host list) — nothing to redact.
    return value;
  }
}

/**
 * Enough of an address to recognise which account answered, not enough to
 * hand someone else the address itself.
 */
export function maskEmail(value: string | undefined): string | undefined {
  if (!value) return value;

  const at = value.lastIndexOf('@');
  if (at <= 0) return '***';

  const [local, domain] = [value.slice(0, at), value.slice(at + 1)];
  const head = local.slice(0, 1);
  const dot = domain.lastIndexOf('.');
  const maskedDomain = dot > 0 ? `${domain.slice(0, 1)}***${domain.slice(dot)}` : '***';

  return `${head}***@${maskedDomain}`;
}

/**
 * Gateway client errors quote the full WebSocket URL, whose query string
 * carries this machine's hostname, its device id and the user id. The failure
 * is worth reporting; that query string is not.
 */
export function redactUrlsInMessage(message: string): string {
  // Tokenise first, then decide per token. A single pattern that matches the
  // URL and then *requires* a `?` backtracks across the rest of the string at
  // every starting position — quadratic, and what CodeQL flags as a ReDoS.
  // `[^\s'"]+` has nothing following it to backtrack for.
  return message.replaceAll(/[^\s'"]+/g, (token) =>
    /^wss?:\/\//i.test(token) ? token.split('?')[0]! : token,
  );
}
