import { Button } from "@heroui/react";
import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown, { type Components } from "react-markdown";
import { HiArrowLongLeft } from "react-icons/hi2";
import { IoCalendarOutline, IoLocationOutline } from "react-icons/io5";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import type { BlogPost as BlogPostData } from "../models/blog";
import {
  fetchBlogPost,
  isBlogPostNotFound,
  isCanceledBlogRequest,
} from "../services/blog";
import { formatShortDate } from "../utils/date";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-5 mt-12 text-2xl font-semibold leading-snug md:mt-16 md:text-3xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-5 mt-12 text-xl font-semibold leading-snug md:mt-16 md:text-2xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-4 mt-10 text-lg font-semibold leading-snug md:text-xl">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-3 mt-8 text-base font-semibold leading-snug md:text-lg">
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p className="my-6 text-sm leading-8 text-default-700 md:text-[15px] md:leading-9">
      {children}
    </p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="text-default-500">{children}</em>,
  del: ({ children }) => <del className="text-default-400">{children}</del>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="border-b border-current text-[#765c45] transition-opacity hover:opacity-60"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-6 list-disc space-y-2 pl-6 text-sm leading-8 md:text-[15px]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-6 list-decimal space-y-2 pl-6 text-sm leading-8 md:text-[15px]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1 text-default-700">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-10 border-l-2 border-foreground py-1 pl-5 text-base font-medium leading-8 md:my-12 md:pl-7 md:text-lg">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-12 border-default-200" />,
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      className="my-9 w-full rounded-xl object-cover md:my-12"
    />
  ),
  pre: ({ children }) => (
    <pre className="my-8 overflow-x-auto rounded-xl bg-[#2f2925] p-5 text-xs leading-7 text-[#f5efe7] md:text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-");

    return (
      <code className={isBlock ? className : "rounded bg-black/5 px-1.5 py-0.5 text-[0.9em]"}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="my-9 overflow-x-auto md:my-12">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-default-300">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-3 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-default-200 px-2 py-3 align-top">{children}</td>,
  input: (props) => <input {...props} className="mr-2 accent-[#765c45]" disabled />,
};

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<BlogPostData>();
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(!slug);
  const [error, setError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!slug) {
      setIsLoading(false);
      setNotFound(true);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setNotFound(false);
    setError(false);
    setPost(undefined);

    fetchBlogPost(slug, controller.signal)
      .then(setPost)
      .catch((requestError) => {
        if (isCanceledBlogRequest(requestError)) return;
        if (isBlogPostNotFound(requestError)) setNotFound(true);
        else setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [slug, requestVersion]);

  if (isLoading) {
    return (
      <div className="atogaki-content atogaki-page-enter mx-auto max-w-[680px] px-5 py-16 md:px-8">
        <div className="animate-pulse space-y-5">
          <div className="h-2 w-40 rounded-full bg-default-200" />
          <div className="h-7 w-4/5 rounded-full bg-default-200" />
          <div className="mt-12 h-px bg-default-200" />
          <div className="h-3 w-full rounded-full bg-default-200" />
          <div className="h-3 w-5/6 rounded-full bg-default-200" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="atogaki-content flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <p className="text-tiny tracking-[0.2em] text-default-400">404 / NOT FOUND</p>
        <h1 className="mt-3 text-xl font-semibold">没有找到这篇文章</h1>
        <Button className="mt-6" variant="flat" onPress={() => navigate("/blog")}>
          返回後書き
        </Button>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="atogaki-content flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
        <p className="text-sm text-default-500">文章暂时无法读取。</p>
        <div className="mt-5 flex gap-2">
          <Button variant="light" onPress={() => navigate("/blog")}>返回後書き</Button>
          <Button variant="flat" onPress={() => setRequestVersion((value) => value + 1)}>重试</Button>
        </div>
      </div>
    );
  }

  return (
    <article className="atogaki-content atogaki-page-enter pb-20">
      <div className="px-4 pt-5 md:px-6 md:pt-7">
        <Button
          size="sm"
          variant="light"
          startContent={<HiArrowLongLeft size={20} />}
          className="px-0 text-default-500"
          onPress={() => navigate("/blog")}
        >
          返回後書き
        </Button>
      </div>

      <header className="px-5 pb-10 pt-7 md:px-8 md:pb-14 md:pt-10">
        <div className="flex flex-wrap gap-x-5 gap-y-3 text-xs text-default-400">
          <span className="flex items-center gap-1.5">
            <IoCalendarOutline size={17} />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <IoLocationOutline size={17} />
            {post.location}
          </span>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-6">
          <h1 className="atogaki-post-title min-w-0 max-w-3xl text-xl leading-tight md:text-3xl md:leading-[1.2]">
            {post.title}
          </h1>
          <time
            dateTime={post.date}
            className="momo-date momo-lettering shrink-0 text-base text-default-400 md:text-lg"
            style={{ marginRight: "2rem", transform: "scale(1.875)" }}
          >
            {formatShortDate(post.date)}
          </time>
        </div>
      </header>

      <div className="mx-auto max-w-[680px] border-t border-default-200 px-5 pt-10 md:px-8 md:pt-14">
        {post.lead ? (
          <p className="border-b border-default-200 pb-9 text-base font-medium leading-9 md:pb-12 md:text-lg md:leading-10">
            {post.lead}
          </p>
        ) : null}

        <div className="atogaki-markdown">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={markdownComponents}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <div className="mt-14 border-t border-default-200 pt-7">
          <div className="text-center">
            <p className="text-tiny tracking-[0.2em] text-default-400">END OF STORY</p>
            <Button
              className="mt-4"
              variant="light"
              startContent={<HiArrowLongLeft size={20} />}
              onPress={() => navigate("/blog")}
            >
              返回後書き
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
