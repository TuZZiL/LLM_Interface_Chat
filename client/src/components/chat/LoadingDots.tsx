export function LoadingDots() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-5 h-5 rounded-full bg-cyan/10 border border-cyan/30 flex items-center justify-center">
            <span className="text-[10px] text-cyan">✦</span>
          </div>
          <span className="text-label font-mono text-cyan uppercase">
            MiMo
          </span>
        </div>
        <div className="glass-panel border border-cyan/5 p-4 rounded-xl">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-cyan/60 rounded-full animate-pulse" />
            <div
              className="w-2 h-2 bg-cyan/60 rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="w-2 h-2 bg-cyan/60 rounded-full animate-pulse"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
