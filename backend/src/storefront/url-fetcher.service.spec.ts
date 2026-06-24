import { BadRequestException } from '@nestjs/common';
import { UrlFetcherService } from './url-fetcher.service';

/**
 * SSRF guard coverage. Every case here is rejected during URL parsing or host
 * validation — BEFORE any socket is opened — so the test never touches the
 * network. IP literals are checked directly (no DNS), keeping it deterministic.
 */
describe('UrlFetcherService — SSRF guard', () => {
  const svc = new UrlFetcherService();

  it.each([
    ['ftp://example.com/x', 'non-http(s) scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['http://user:pass@example.com/', 'inline credentials'],
    ['http://127.0.0.1/admin', 'IPv4 loopback'],
    ['http://10.0.0.5/', 'private 10/8'],
    ['http://192.168.1.1/', 'private 192.168/16'],
    ['http://172.16.0.1/', 'private 172.16/12'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata link-local'],
    ['http://100.64.0.1/', 'CGNAT 100.64/10'],
    ['http://[::1]/', 'IPv6 loopback'],
    ['not a url at all', 'unparseable'],
  ])('rejects %s (%s)', async (url) => {
    await expect(svc.fetchInspiration(url)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
