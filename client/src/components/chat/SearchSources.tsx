import { useState } from "react";
import type { SearchResult } from "../../types";

interface Props {
  results: SearchResult[];
}

export function SearchSources({ results }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (results.length === 0) return null;

  const uniqueResults = results.filter(
    (r, i, arr) => arr.findIndex((x) => x.url === r.url) === i
  );

  return (
    <div className="mt-2.5 pt-2.5 border-t border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-outline-variant uppercase tracking-widest hover:text-cyan transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {uniqueResults.length} source{uniqueResults.length !== 1 ? "s" : ""}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1.5">
          {uniqueResults.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2 group"
            >
              <span className="text-[10px] font-mono text-outline-variant mt-0.5 shrink-0">
                [{i + 1}]
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-cyan group-hover:underline truncate">
                  {r.title}
                </div>
                <div className="text-[10px] text-outline-variant truncate">
                  {r.url}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
