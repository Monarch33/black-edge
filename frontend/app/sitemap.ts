import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://blackedge.ai'

  // Static pages
  const routes = [
    '',
    '/markets',
    '/sports',
    '/crypto5min',
    '/track-record',
    '/pricing',
    '/terminal',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  return routes
}
