export interface BlogPostSummary {
  slug: string;
  title: string;
  date: string;
  location: string;
  lead: string;
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface BlogPost extends BlogPostSummary {
  content: string;
}

export interface BlogPostList {
  items: BlogPostSummary[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}
