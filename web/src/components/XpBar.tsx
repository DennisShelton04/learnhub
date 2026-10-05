export function XpBar({ level, progress, toNext }: { level: number; progress: number; toNext: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-subtle">
        <span>Level {level}</span>
        <span>{toNext} XP to level {level + 1}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-selected"
        role="progressbar"
        aria-label={`Progress to level ${level + 1}`}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, progress * 100)}%` }} />
      </div>
    </div>
  );
}
