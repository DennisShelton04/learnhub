const palette = ["#5865f2", "#3ba55c", "#eb459e", "#faa61a", "#ed4245", "#9b59b6", "#1abc9c", "#e67e22"];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizes = { xs: "h-4 w-4 text-[8px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm" };

export function Avatar({ name, seed, size = "md" }: { name: string; seed: string; size?: keyof typeof sizes }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${sizes[size]}`}
      style={{ backgroundColor: colorFor(seed) }}
    >
      {initials(name)}
    </span>
  );
}
