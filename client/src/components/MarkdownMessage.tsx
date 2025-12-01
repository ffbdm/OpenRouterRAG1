import { memo } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { defaultSchema } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";
import { cn } from "@/lib/utils";

const markdownSchema: Schema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [...((defaultSchema.attributes ?? {}).a ?? []), "target", "rel"],
    code: [...((defaultSchema.attributes ?? {}).code ?? []), "className"],
    pre: [...((defaultSchema.attributes ?? {}).pre ?? []), "className"],
    th: [...((defaultSchema.attributes ?? {}).th ?? []), "align"],
    td: [...((defaultSchema.attributes ?? {}).td ?? []), "align"],
  },
};

export type MarkdownMessageProps = {
  content: string;
  className?: string;
};

const components: Components = {
  a: ({ node: _node, children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
    >
      {children}
    </a>
  ),
  code: (props) => {
    const { inline, className, children } = props as typeof props & {
      inline?: boolean;
      className?: string;
    };

    if (inline) {
      return (
        <code className={cn("font-mono text-xs", className)}>{children}</code>
      );
    }

    return (
      <pre className="overflow-x-auto text-xs leading-6">
        <code className={cn("font-mono", className)}>{children}</code>
      </pre>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-border px-3 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border px-3 py-1 align-top">{children}</td>
  ),
  li: ({ children }) => <li className="my-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
};

function MarkdownMessageBase({ content, className }: MarkdownMessageProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none text-foreground",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg",
        "prose-a:text-primary prose-a:underline",
        "prose-table:w-full prose-th:text-left",
        "prose-li:marker:text-muted-foreground",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSchema]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageBase);
