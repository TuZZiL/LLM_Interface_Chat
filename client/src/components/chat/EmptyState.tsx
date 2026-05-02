export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 space-y-4">
      <div className="w-14 h-14 rounded-full border border-cyan/20 flex items-center justify-center cyan-bloom bg-black">
        <span className="text-cyan text-2xl">✦</span>
      </div>
      <div className="text-center">
        <h2 className="text-headline font-headline text-white mb-1">
          MiMo Chat
        </h2>
        <p className="text-outline text-label font-mono uppercase">
          Write below to start
        </p>
      </div>
    </div>
  );
}
