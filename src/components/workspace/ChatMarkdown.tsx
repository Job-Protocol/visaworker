import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

// Editorial markdown renderer for the chat pane. No Tailwind Typography plugin
// needed — we style each element explicitly so the output matches the
// visaworker.ai aesthetic (serif headings, restrained rules, mono code).
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="chat-md text-[13.5px] leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url?.startsWith("vw:") ? url : defaultUrlTransform(url ?? ""))}
        components={{
          h1: (props) => (
            <h3 className="mb-2 mt-4 font-serif text-lg font-semibold text-navy first:mt-0" {...props} />
          ),
          h2: (props) => (
            <h4 className="mb-1.5 mt-4 font-serif text-base font-semibold text-navy first:mt-0" {...props} />
          ),
          h3: (props) => (
            <h5
              className="mb-1 mt-3 font-mono text-[10px] font-semibold uppercase tracking-widest text-crimson first:mt-0"
              {...props}
            />
          ),
          h4: (props) => (
            <h6
              className="mb-1 mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground first:mt-0"
              {...props}
            />
          ),
          p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
          hr: () => (
            <div className="my-3 flex items-center gap-2">
              <span className="h-px flex-1 bg-border" />
              <span className="h-1 w-1 rounded-full bg-navy" />
              <span className="h-px flex-1 bg-border" />
            </div>
          ),
          ul: (props) => <ul className="my-2 ml-4 list-disc space-y-1 marker:text-navy" {...props} />,
          ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1 marker:font-mono marker:text-crimson" {...props} />,
          li: (props) => <li className="pl-1" {...props} />,
          strong: (props) => <strong className="font-semibold text-navy" {...props} />,
          em: (props) => <em className="italic text-foreground/90" {...props} />,
          a: ({ href, children, ...props }) => {
            // Custom in-app scheme: [Strategy](vw:strategy) opens the workspace pane.
            const paneMatch = typeof href === "string" && href.match(/^vw:(strategy|exhibits|sections|preview)$/i);
            if (paneMatch) {
              const pane = paneMatch[1].toLowerCase() as "strategy" | "exhibits" | "sections" | "preview";
              return (
                <button
                  type="button"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("visaworker:open-pane", { detail: { pane } }),
                    )
                  }
                  className="font-medium text-crimson underline decoration-navy/50 underline-offset-2 hover:decoration-crimson"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                {...props}
                target="_blank"
                rel="noreferrer"
                className="text-crimson underline decoration-navy/60 underline-offset-2 hover:decoration-crimson"
              >
                {children}
              </a>
            );
          },
          blockquote: (props) => (
            <blockquote
              className="my-2 border-l-2 border-navy pl-3 font-serif italic text-muted-foreground"
              {...props}
            />
          ),
          code: ({ inline, className, children, ...rest }: ComponentProps<"code"> & { inline?: boolean }) => {
            if (inline) {
              return (
                <code
                  className="rounded border border-border bg-parchment/60 px-1 py-[1px] font-mono text-[12px] text-navy"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className ?? ""} font-mono text-[12px]`} {...rest}>
                {children}
              </code>
            );
          },
          pre: (props: ComponentProps<"pre">) => <CodeBlock {...props} />,
          table: (props) => (
            <div className="my-2 overflow-auto border border-border">
              <table className="w-full border-collapse text-left text-[12.5px]" {...props} />
            </div>
          ),
          thead: (props) => <thead className="bg-parchment/60" {...props} />,
          th: (props) => (
            <th className="border-b border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-crimson" {...props} />
          ),
          td: (props) => <td className="border-b border-border/60 px-2 py-1 align-top" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ children, className, ...rest }: ComponentProps<"pre"> & { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  return (
    <div className="group relative my-2">
      <pre
        ref={preRef}
        className={`overflow-auto rounded border border-border bg-parchment/60 p-3 font-mono text-[12px] leading-relaxed text-navy ${className ?? ""}`}
        {...rest}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={async () => {
          const text = preRef.current?.innerText ?? "";
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          } catch {
            /* ignore */
          }
        }}
        className="absolute right-1.5 top-1.5 rounded border border-border bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy code"}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
