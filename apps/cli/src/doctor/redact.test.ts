import { describe, expect, it } from 'vitest';

import { maskEmail, redactUrlCredentials, redactUrlsInMessage } from './redact';

describe('redactUrlCredentials', () => {
  it('keeps the host and drops the credential', () => {
    expect(redactUrlCredentials('https://alice:hunter2@lobe.internal:8443/x')).toBe(
      'https://***:***@lobe.internal:8443/x',
    );
  });

  it('leaves a credential-free URL untouched', () => {
    expect(redactUrlCredentials('https://app.lobehub.com')).toBe('https://app.lobehub.com');
  });

  it('passes through a value that is not a URL', () => {
    // NO_PROXY is a host list, not a URL.
    expect(redactUrlCredentials('localhost,127.0.0.1,.internal')).toBe(
      'localhost,127.0.0.1,.internal',
    );
  });
});

describe('maskEmail', () => {
  it('leaves enough to recognise the account and no more', () => {
    expect(maskEmail('arvin.xu@example.com')).toBe('a***@e***.com');
  });

  it('does not pass through something that is not an address', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('redactUrlsInMessage', () => {
  it('drops the query string a gateway error quotes', () => {
    const message =
      "WebSocket connection to 'ws://127.0.0.1:9/ws?deviceId=d1&hostname=mac&userId=user_1' failed";

    const redacted = redactUrlsInMessage(message);

    expect(redacted).toBe("WebSocket connection to 'ws://127.0.0.1:9/ws' failed");
    expect(redacted).not.toContain('user_1');
  });

  it('stays linear on input built to make it backtrack', () => {
    const hostile = `${'ws://'.repeat(20_000)}x`;

    const startedAt = Date.now();
    redactUrlsInMessage(hostile);

    expect(Date.now() - startedAt).toBeLessThan(1000);
  });
});
