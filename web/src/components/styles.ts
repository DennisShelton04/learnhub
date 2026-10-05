const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const buttonStyles = {
  primary: `${base} bg-accent text-white hover:bg-accent-hover`,
  secondary: `${base} bg-hover text-fg hover:bg-selected`,
  danger: `${base} bg-danger text-white hover:opacity-90`,
  small: "rounded px-2 py-1 text-xs font-medium bg-hover text-fg hover:bg-selected",
};

export const inputStyles =
  "rounded-md border border-transparent bg-input px-3 py-2 text-base text-fg placeholder:text-subtle outline-none focus:border-accent";
