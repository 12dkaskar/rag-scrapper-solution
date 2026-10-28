import dns from "dns/promises";
import net from "net";
import { ValidationError } from "./errors.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice("::ffff:".length);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
  }
  return false;
}

export function assertSafeUrlString(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError("Invalid URL format");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError("URLs with credentials are not allowed");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    throw new ValidationError("Target hostname is not allowed");
  }
  return parsed;
}

export async function resolveAndValidateHost(hostname: string): Promise<void> {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) {
    throw new ValidationError("Target hostname is not allowed");
  }
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new ValidationError("Target IP address is not allowed");
    }
    return;
  }
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const { address } of results) {
      if (isPrivateOrReservedIp(address)) {
        throw new ValidationError("URL resolves to a disallowed address");
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Could not resolve hostname");
  }
}

export async function validateUrlForFetch(raw: string): Promise<URL> {
  const parsed = assertSafeUrlString(raw);
  await resolveAndValidateHost(parsed.hostname);
  return parsed;
}

export function assertSafeRedirectUrl(url: URL): void {
  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new ValidationError("Redirect target is not allowed");
  }
  if (net.isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new ValidationError("Redirect target is not allowed");
  }
}
