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

export async function fetchBlogPosts(signal?: AbortSignal) {
  const response = await blogApi.get<ApiSuccess<BlogPostList>>("/api/blog/posts", {
    params: { page: 1, page_size: 50 },
    signal,
  });
  return response.data.payload;
}

export async function fetchBlogPost(slug: string, signal?: AbortSignal) {
  const response = await blogApi.get<ApiSuccess<BlogPost>>(
    `/api/blog/posts/${encodeURIComponent(slug)}`,
    { signal },
  );
  return response.data.payload;
}

export function isCanceledBlogRequest(error: unknown) {
  return axios.isCancel(error);
}

export function isBlogPostNotFound(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}
