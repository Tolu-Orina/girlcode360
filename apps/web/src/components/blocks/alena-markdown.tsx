import type { Components } from "react-markdown";
import Markdown from "react-markdown";

const components: Components = {
  p: ({ children }) => (
    <p className="m-0 mb-2 text-[length:var(--text-body)] leading-normal last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal last:mb-0">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-[length:var(--text-body)] leading-normal">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-inherit">{children}</strong>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2"
      rel="noreferrer"
      target={href?.startsWith("http") ? "_blank" : undefined}
    >
      {children}
    </a>
  ),
};

function safeUrl(url: string): string {
  if (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("/")
  ) {
    return url;
  }
  return "";
}

export function AlenaMarkdown({ text }: { text: string }) {
  return (
    <Markdown components={components} urlTransform={safeUrl}>
      {text}
    </Markdown>
  );
}
