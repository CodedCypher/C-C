import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

import { fieldError } from '../common/structured-error';

/** Hard caps for the URL door — keep a hostile page from hanging or flooding us. */
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024; // 2MB of HTML is plenty for a parts list
const MAX_REDIRECTS = 4;
const MAX_TEXT_CHARS = 8000; // matches ResolveBuildDto's text cap

/** Structured 400 on the `url` field so the FE maps it back onto the input. */
function urlError(message: string): BadRequestException {
  return new BadRequestException(fieldError('url', message, 400, 'BadRequest'));
}

/**
 * Tutorial-URL door. Fetches a public web page and reduces it to plain text the
 * part matcher can read. The fetch is SSRF-hardened: only http(s), no inline
 * credentials, every hop's host is DNS-resolved and rejected if it points at a
 * private / loopback / link-local address, redirects are followed manually with
 * the same checks, and the response is bounded in both time and size.
 *
 * NOTE: a determined attacker could DNS-rebind between this check and the
 * socket connect (TOCTOU). For a public storefront fetching maker tutorials the
 * residual risk is acceptable; pin the resolved IP per hop if that changes.
 */
@Injectable()
export class UrlFetcherService {
  async fetchInspiration(rawUrl: string): Promise<string> {
    let current = this.parsePublicUrl(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await this.assertPublicHost(current.hostname);
      const res = await this.fetchOnce(current);

      // Manual redirect handling so we re-validate the destination host.
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location)
          throw urlError('That link redirected nowhere we could follow.');
        current = this.parsePublicUrl(new URL(location, current).toString());
        continue;
      }

      if (!res.ok) {
        throw urlError(
          `Couldn't fetch that page (the site returned ${res.status}).`,
        );
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
        throw urlError(
          "That link isn't a readable web page — paste the parts list as text instead.",
        );
      }

      const html = await this.readCapped(res);
      const text = htmlToText(html).slice(0, MAX_TEXT_CHARS);
      if (!text.trim()) {
        throw urlError(
          "Couldn't read any text from that page — paste the parts list as text instead.",
        );
      }
      return text;
    }

    throw urlError('That link redirected too many times.');
  }

  /** Validate scheme + shape; reject inline credentials. */
  private parsePublicUrl(rawUrl: string): URL {
    let u: URL;
    try {
      u = new URL(rawUrl);
    } catch {
      throw urlError("That doesn't look like a valid link.");
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw urlError('Only http(s) links are supported.');
    }
    if (u.username || u.password) {
      throw urlError('Links with embedded credentials are not allowed.');
    }
    return u;
  }

  /** Resolve the host and reject if ANY address is private/loopback/link-local. */
  private async assertPublicHost(hostname: string): Promise<void> {
    let addrs: string[];
    if (isIP(hostname)) {
      addrs = [hostname];
    } else {
      try {
        const results = await lookup(hostname, { all: true });
        addrs = results.map((r) => r.address);
      } catch {
        throw urlError("Couldn't resolve that link's host.");
      }
    }
    if (addrs.length === 0 || addrs.some(isBlockedAddress)) {
      throw urlError('That link points to a private or local address.');
    }
  }

  /** A single bounded request with no automatic redirects. */
  private async fetchOnce(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          // Identify ourselves and ask for text; some sites 403 a blank UA.
          'user-agent': 'circuit.rocks-build-bot/1.0',
          accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
        },
      });
    } catch {
      throw urlError(
        'Couldn’t fetch that page (it timed out or was unreachable).',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Stream the body, aborting once it exceeds MAX_BYTES. */
  private async readCapped(res: Response): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) return '';
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          break; // truncate — the head of the page carries the BOM anyway
        }
        chunks.push(value);
      }
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  }
}

/** Strip a tracked HTML page down to readable text for the matcher. */
function htmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6]|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * True for an IP we must never fetch from: loopback, private (RFC1918), CGNAT,
 * link-local, unique-local (IPv6), and the unspecified address. IPv4-mapped
 * IPv6 addresses are unwrapped and re-checked as IPv4.
 */
function isBlockedAddress(ip: string): boolean {
  const fam = isIP(ip);
  if (fam === 4) return isBlockedV4(ip);
  if (fam === 6) return isBlockedV6(ip);
  return true; // unparseable → block
}

function isBlockedV4(ip: string): boolean {
  const o = ip.split('.').map(Number);
  if (
    o.length !== 4 ||
    o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return true;
  }
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true; // this-net, private, loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  // IPv4-mapped (::ffff:a.b.c.d) → re-check the embedded v4 address.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true; // link-local fe80::/10
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  if (lower.startsWith('ff')) return true; // multicast
  return false;
}
