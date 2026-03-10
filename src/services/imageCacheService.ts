/**
 * Image Cache Service
 * Caches presigned S3 URLs in memory with TTL to avoid redundant API calls.
 * Also leverages React Native's built-in Image.prefetch for native disk caching.
 */

import { Image } from 'react-native';

interface CachedUrl {
  url: string;
  expiresAt: number; // timestamp
}

// Presigned URLs typically last 15 min; we cache for 12 min to be safe
const URL_CACHE_TTL_MS = 12 * 60 * 1000;

// In-memory cache: s3Key → { url, expiresAt }
const urlCache = new Map<string, CachedUrl>();

// Track which URLs we've already prefetched in this session
const prefetchedUrls = new Set<string>();

/**
 * Get a cached presigned URL for an s3Key, or null if not cached/expired
 */
export const getCachedUrl = (s3Key: string): string | null => {
  const cached = urlCache.get(s3Key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }
  // Expired or not found
  if (cached) {
    urlCache.delete(s3Key);
  }
  return null;
};

/**
 * Cache a presigned URL for an s3Key
 */
export const setCachedUrl = (s3Key: string, url: string): void => {
  urlCache.set(s3Key, {
    url,
    expiresAt: Date.now() + URL_CACHE_TTL_MS,
  });

  // Prefetch the image into RN's native cache (fire-and-forget)
  if (!prefetchedUrls.has(url)) {
    prefetchedUrls.add(url);
    Image.prefetch(url).catch(() => {
      // Silently ignore prefetch errors
      prefetchedUrls.delete(url);
    });
  }
};

/**
 * Clear all cached URLs (e.g. on logout)
 */
export const clearImageCache = (): void => {
  urlCache.clear();
  prefetchedUrls.clear();
};

/**
 * Get cache stats for debugging
 */
export const getImageCacheStats = () => ({
  urlCacheSize: urlCache.size,
  prefetchedCount: prefetchedUrls.size,
});

export default {
  getCachedUrl,
  setCachedUrl,
  clearImageCache,
  getImageCacheStats,
};
