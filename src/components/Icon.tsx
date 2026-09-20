export type IconName =
  | "folder"
  | "download"
  | "upload"
  | "refresh"
  | "close"
  | "terminal"
  | "help"
  | "chevron"
  | "workspace"
  | "branch"
  | "tag"
  | "cloud"
  | "stash"
  | "submodule"
  | "commit"
  | "settings"
  | "merge";

const PATHS: Record<IconName, string> = {
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
  upload: "M12 21V9m0 0 4 4m-4-4-4 4M4 3h16",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  close: "M6 6l12 12M18 6 6 18",
  terminal: "M5 7l5 5-5 5M13 17h6",
  help: "M12 17h.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7",
  chevron: "m9 6 6 6-6 6",
  workspace: "M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM8 20h8",
  branch:
    "M6 4v12m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M6 4a2 2 0 1 0 0-.01M18 8a2 2 0 1 0 0-.01M18 10c0 4-6 2-6 6",
  tag: "M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01",
  cloud: "M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.4A3.5 3.5 0 0 1 17.5 18z",
  stash: "M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 8l2-4h14l2 4M10 12h4",
  submodule: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5",
  commit: "M3 12h6m6 0h6M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6",
  settings:
    "M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 0 1-2-2 2 2 0 0 1 2-2 1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 4.6 2 2 0 0 1 11 3a2 2 0 0 1 2 2 1.6 1.6 0 0 0 1 1.5",
  merge: "M6 4v12m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4M18 8a2 2 0 1 0 0-.01M6 8c0 4 6 2 6 6",
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
