import type { Message, SearchStatus } from "../../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";
import { SearchSources } from "./SearchSources";
import type { Components } from "react-markdown";

interface Props {
  message: Message;
  canRegenerate?: boolean;
  onRegenerate?: (messageId: string) => void;
  searchStatus?: SearchStatus | null;
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const isInline = !match && !className;
    if (isInline) {
      return (
        <code
          className="bg-white/5 px-1.5 py-0.5 rounded text-cyan text-[12px] font-mono whitespace-pre-wrap break-words"
          style={{ overflowWrap: "anywhere" }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <CodeBlock language={match?.[1]}>
        {String(children).replace(/\n$/, "")}
      </CodeBlock>
    );
  },
  p({ children }) {
    return <p className="mb-2 last:mb-0 break-words" style={{ overflowWrap: "anywhere" }}>{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{children}</ol>;
  },
  h1({ children }) {
    return <h1 className="text-base font-bold mb-1.5 text-white break-words" style={{ overflowWrap: "anywhere" }}>{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-sm font-bold mb-1.5 text-white break-words" style={{ overflowWrap: "anywhere" }}>{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-[13px] font-bold mb-1.5 text-white break-words" style={{ overflowWrap: "anywhere" }}>{children}</h3>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-cyan/30 pl-2 my-1.5 text-on-surface-variant italic text-[13px] break-words" style={{ overflowWrap: "anywhere" }}>
        {children}
      </blockquote>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-cyan hover:underline break-words"
        style={{ overflowWrap: "anywhere" }}
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="w-full text-[12px] border-collapse">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-white/10 px-2 py-1 text-left text-cyan font-mono text-[10px] uppercase bg-surface-container-high/30">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-white/10 px-2 py-1 break-words" style={{ overflowWrap: "anywhere" }}>{children}</td>;
  },
};

function formatError(message: string | null) {
  const text = message || "Response failed";
  if (
    /high risk|rejected|risk/i.test(text)
  ) {
    return "Provider blocked this response. Regenerate may work with a different sample.";
  }
  return text;
}

export function MessageBubble({ message, canRegenerate = false, onRegenerate, searchStatus }: Props) {
  const isUser = message.role === "user";
  const isWaiting = message.status === "thinking" && !message.content;
  const isError = message.status === "error";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] min-w-0 glass-panel border border-white/5 px-3 py-2.5 rounded-xl">
          <div className="text-[10px] font-mono text-outline-variant uppercase mb-1.5 tracking-widest">
            You
          </div>
          {message.attachments.length > 0 && (
            <div className="flex gap-1.5 mb-1.5 flex-wrap">
              {message.attachments.map((a) =>
                a.dataUrl ? (
                  <img
                    key={a.id}
                    src={a.dataUrl}
                    alt={a.fileName}
                    className="w-16 h-16 object-cover rounded-lg border border-white/10"
                  />
                ) : (
                  <div
                    key={a.id}
                    className="max-w-36 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-outline-variant"
                    title={a.fileName}
                  >
                    <div className="truncate">{a.fileName}</div>
                    <div>{Math.ceil(a.size / 1024)} KB</div>
                  </div>
                )
              )}
            </div>
          )}
          <p className="text-on-surface text-[13px] font-body whitespace-pre-wrap break-words leading-[1.6]" style={{ overflowWrap: "anywhere" }}>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] min-w-0 space-y-1.5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-4 h-4 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center">
            <span className="text-[8px] text-cyan">✦</span>
          </div>
          <span className="text-[10px] font-mono text-cyan uppercase">
            MiMo
          </span>
        </div>
        <div
          className={`glass-panel border p-4 rounded-xl ${
            isError ? "border-error/20" : "border-cyan/5"
          }`}
        >
          {isWaiting ? (
            searchStatus ? (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan/60 rounded-full animate-pulse" />
                <span className="text-[11px] text-outline-variant">
                  {searchStatus.status === "searching"
                    ? `Searching: ${searchStatus.query}...`
                    : `Reading: ${searchStatus.url}...`}
                </span>
              </div>
            ) : (
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-cyan/60 rounded-full animate-pulse" />
                <div
                  className="w-1.5 h-1.5 bg-cyan/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-cyan/60 rounded-full animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            )
          ) : isError ? (
            <div className="space-y-3">
              <p className="text-error text-[13px]">{formatError(message.error)}</p>
              {onRegenerate && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  disabled={!canRegenerate}
                  className="rounded-lg border border-cyan/30 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-cyan transition-colors hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Regenerate
                </button>
              )}
            </div>
          ) : (
            <div className="min-w-0 text-on-surface text-[13px] font-body leading-[1.6] break-words" style={{ overflowWrap: "anywhere" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
          {message.searchResults && message.searchResults.length > 0 && (
            <SearchSources results={message.searchResults} />
          )}
          {message.usage && (
            <div className="mt-2.5 pt-2.5 border-t border-white/5 flex gap-3 text-[10px] text-outline font-mono">
              <span>prompt: {message.usage.prompt_tokens}</span>
              <span>completion: {message.usage.completion_tokens}</span>
              <span>total: {message.usage.total_tokens}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
