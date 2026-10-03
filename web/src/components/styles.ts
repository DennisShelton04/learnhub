const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60";

export const buttonStyles = {
  primary: `${base} bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300`,
  secondary: `${base} border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900`,
  danger: `${base} border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950`,
  small: "rounded px-2 py-1 text-xs font-medium border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900",
};

export const inputStyles =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
