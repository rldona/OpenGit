const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".avif",
  ".heic",
  ".heif",
  ".tif",
  ".tiff",
];

/**
 * Whether a binary entry should get the image preview. SVG is text and keeps
 * the text diff; unknown extensions fall back to the binary notice.
 */
export function isImagePath(path: string): boolean {
  const lower = path.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}
