import { memo } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];
const components: Components = {
  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  h1: ({ children }) => (
    <h2 className="pt-1 text-lg font-semibold tracking-tight">{children}</h2>
  ),
  h2: ({ children }) => (
    <h3 className="pt-1 text-base font-semibold tracking-tight">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="pt-1 text-sm font-semibold">{children}</h4>
  ),
  h4: ({ children }) => <h4 className="text-sm font-semibold">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-semibold">{children}</h5>,
  h6: ({ children }) => <h6 className="text-sm font-semibold">{children}</h6>,
  ul: ({ children }) => (
    <ul className="list-disc space-y-2 pl-5 marker:text-primary/70">
      {children}
    </ul>
  ),
  ol: ({ children, start }) => (
    <ol
      start={start}
      className="list-decimal space-y-2 pl-5 marker:font-medium marker:text-muted-foreground"
    >
      {children}
    </ol>
  ),
  li: ({ children, className }) => (
    <li
      className={`pl-1 ${className?.includes("task-list-item") ? "list-none" : ""}`}
    >
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="space-y-2 rounded-r-lg border-l-2 border-primary/25 bg-primary/5 px-4 py-2 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => (
    <code
      className={`rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] ${className ?? ""}`}
    >
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre
      tabIndex={0}
      aria-label="Code block"
      className="max-w-full overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-6 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-xs"
    >
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div
      role="region"
      aria-label="Oracle answer table"
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-lg border"
    >
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y">{children}</tbody>,
  tr: ({ children }) => <tr className="even:bg-muted/20">{children}</tr>,
  th: ({ children, style }) => (
    <th
      scope="col"
      style={style}
      className="min-w-32 px-3 py-2 text-xs font-semibold"
    >
      {children}
    </th>
  ),
  td: ({ children, style }) => (
    <td style={style} className="px-3 py-2 align-top">
      {children}
    </td>
  ),
  hr: () => <hr className="border-border" />,
  a: ({ children, href }) => {
    if (!href) return <span>{children}</span>;
    const external = /^(https?:)?\/\//i.test(href);
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="rounded-sm font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {children}
        {external && <span className="sr-only"> (opens in a new tab)</span>}
      </a>
    );
  },
  // Generated Markdown never fetches remote images or creates interactive forms.
  img: ({ alt }) => (
    <span className="text-xs italic text-muted-foreground">
      {alt ? `[Image: ${alt}]` : "[Image omitted]"}
    </span>
  ),
  input: ({ checked }) => (
    <input
      type="checkbox"
      checked={!!checked}
      disabled
      readOnly
      aria-label={checked ? "Completed task" : "Incomplete task"}
      className="mr-2 size-3.5 align-middle accent-primary"
    />
  ),
};

// Raw HTML stays escaped and react-markdown's default URL filtering stays enabled.
// Memoization keeps earlier replies from being parsed again for every streamed token.
export const OracleMarkdown = memo(function OracleMarkdown({
  content,
}: {
  content: string;
}) {
  return (
    <div className="min-w-0 space-y-3 text-sm leading-7 text-foreground [overflow-wrap:anywhere]">
      <Markdown remarkPlugins={plugins} components={components}>
        {content}
      </Markdown>
    </div>
  );
});
