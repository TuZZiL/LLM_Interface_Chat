import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useState } from "react";

interface Props {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-full rounded-lg overflow-hidden border border-white/5 my-3">
      <div className="flex items-center justify-between px-4 py-1.5 bg-surface-container-high/50 border-b border-white/5">
        <span className="text-label font-mono text-outline-variant uppercase">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="text-outline hover:text-cyan transition-colors text-label font-mono uppercase"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "rgba(0,0,0,0.4)",
          fontSize: "13px",
          lineHeight: "1.5",
          maxWidth: "100%",
          overflowX: "auto",
        }}
        wrapLongLines
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}
