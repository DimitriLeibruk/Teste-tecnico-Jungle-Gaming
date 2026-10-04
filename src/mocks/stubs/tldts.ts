/**
 * Substituto mínimo do `tldts` (lista pública de sufixos, ~185 KB) usado apenas
 * pelo `tough-cookie`, dependência interna do MSW para cookies. A aplicação não
 * usa cookies nos mocks (sessão via header Authorization), então basta uma
 * resolução simples de domínio. Aplicado via alias no vite.config.ts.
 */
function labels(hostname: string) {
  return hostname.replace(/\.$/, '').toLowerCase().split('.').filter(Boolean)
}

export function getPublicSuffix(hostname: string): string | null {
  const parts = labels(hostname)
  return parts.length ? parts[parts.length - 1]! : null
}

export function getDomain(hostname: string): string | null {
  const parts = labels(hostname)
  if (parts.length === 0) return null
  return parts.length === 1 ? parts[0]! : parts.slice(-2).join('.')
}

export function getHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return url || null
  }
}

export function parse(url: string) {
  const hostname = getHostname(url)
  return { hostname, domain: hostname ? getDomain(hostname) : null, publicSuffix: hostname ? getPublicSuffix(hostname) : null }
}

export default { getPublicSuffix, getDomain, getHostname, parse }
