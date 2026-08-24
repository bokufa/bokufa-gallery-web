import axios from "axios";

import type { BlogPost, BlogPostList } from "../models/blog";

interface ApiSuccess<T> {
  success: true;
  payload: T;
}

const blogApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://api.bokufa.art"),
  timeout: 15_000,
});

const BLOG_CACHE_TTL_MS = 5 * 60 * 1_000;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

let blogPostsCache: CacheEntry<BlogPostList> | undefined;
const blogPostCache = new Map<string, CacheEntry<BlogPost>>();

function readCache<T>(entry: CacheEntry<T> | undefined) {
  if (!entry) return undefined;
  if (entry.expiresAt > Date.now()) return entry.value;
  return undefined;
}

export function getCachedBlogPosts() {
  return readCache(blogPostsCache);
}

export function getCachedBlogPost(slug: string) {
  return readCache(blogPostCache.get(slug));
}

export async function fetchBlogPosts(signal?: AbortSignal) {
  const cached = getCachedBlogPosts();
  if (cached) return cached;

  const response = await blogApi.get<ApiSuccess<BlogPostList>>("/api/blog/posts", {
    params: { page: 1, page_size: 50 },
    signal,
  });
  blogPostsCache = {
    expiresAt: Date.now() + BLOG_CACHE_TTL_MS,
    value: response.data.payload,
  };
  return blogPostsCache.value;
}

export async function fetchBlogPost(slug: string, signal?: AbortSignal) {
  const cached = getCachedBlogPost(slug);
  if (cached) return cached;

  const response = await blogApi.get<ApiSuccess<BlogPost>>(
    `/api/blog/posts/${encodeURIComponent(slug)}`,
    { signal },
  );
  blogPostCache.set(slug, {
    expiresAt: Date.now() + BLOG_CACHE_TTL_MS,
    value: response.data.payload,
  });
  return response.data.payload;
}

export function isCanceledBlogRequest(error: unknown) {
  return axios.isCancel(error);
}

export function isBlogPostNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
