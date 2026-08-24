import { Button } from "@heroui/react";
import { IoCalendarOutline, IoLocationOutline } from "react-icons/io5";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { BlogPostSummary } from "../models/blog";
import { fetchBlogPosts, isCanceledBlogRequest } from "../services/blog";
import { formatShortDate } from "../utils/date";

export default function BlogIndex() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(false);

    fetchBlogPosts(controller.signal)
      .then((result) => setPosts(result.items))
      .catch((requestError) => {
        if (!isCanceledBlogRequest(requestError)) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [requestVersion]);

  return (
    <div className="atogaki-content atogaki-page-enter px-4 pb-20 pt-8 md:px-6 md:pt-12">
      {isLoading ? (
        <div className="space-y-8 border-y border-default-200 px-1 py-8 md:px-4">
          {["w-2/3", "w-1/2", "w-3/5"].map((width) => (
            <div key={width} className="animate-pulse space-y-3">
              <div className="h-2 w-32 rounded-full bg-default-200" />
              <div className={`h-4 ${width} rounded-full bg-default-200`} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="border-y border-default-200 px-2 py-14 text-center">
          <p className="text-sm text-default-500">暂时无法读取後書き。</p>
          <Button className="mt-4" size="sm" variant="light" onPress={() => setRequestVersion((value) => value + 1)}>
            重试
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="border-y border-default-200 px-2 py-14 text-center text-sm text-default-400">
          还没有公开的文章。
        </div>
      ) : (
        <section className="border-b border-default-200">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="group cursor-pointer border-t border-default-200 px-1 py-6 transition-colors hover:bg-default-50 md:px-4 md:py-8"
            onClick={() => navigate(`/blog/${post.slug}`)}
          >
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-default-400">
                <span className="flex items-center gap-1.5">
                  <IoCalendarOutline size={16} />
                  {post.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <IoLocationOutline size={16} />
                  {post.location}
                </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-5">
              <h2 className="atogaki-post-title min-w-0 text-base leading-snug transition-colors group-hover:text-default-600 md:text-lg">
                {post.title}
              </h2>
              <time
                dateTime={post.date}
                className="momo-date momo-lettering shrink-0 text-base text-default-400 md:text-lg"
              >
                {formatShortDate(post.date)}
              </time>
            </div>
          </article>
        ))}
        </section>
      )}
    </div>
  );
}
