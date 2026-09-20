export type IconName = "folder" | "download" | "upload" | "refresh" | "close" | "terminal" | "help";

const PATHS: Record<IconName, string> = {
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
  upload: "M12 21V9m0 0 4 4m-4-4-4 4M4 3h16",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  close: "M6 6l12 12M18 6 6 18",
  terminal: "M5 7l5 5-5 5M13 17h6",
  help: "M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7",
};

export function Icon({ name, size = 14 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
