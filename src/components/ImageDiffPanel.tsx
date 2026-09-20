import { useEffect, useState } from "react";
import { imageBlob, imagePair, type ImageRequest } from "../lib/bridge/diff";
import { useDiffStore } from "../lib/stores/diff";

type Sides = { before: string | null; after: string | null };

function changeLabel(before: string | null, after: string | null): string {
  if (before === null && after !== null) {
    return "New binary file";
  }
  if (after === null && before !== null) {
    return "Deleted binary file";
  }
  return "Modified binary file";
}

/**
 * Preview of an image change, SourceTree style: Before/After side by side in
 * "Side by side" mode and only the resulting image in "Unified" mode.
 */
export function ImageDiffPanel() {
  const root = useDiffStore((state) => state.root);
  const target = useDiffStore((state) => state.target);
  const selected = useDiffStore((state) => state.selected);
  const mode = useDiffStore((state) => state.mode);
  const [images, setImages] = useState<Sides | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root || !target || !selected) {
      return;
    }
    let cancelled = false;
    const urls: string[] = [];
    const request: ImageRequest = {
      path: root,
      file: selected.path,
      rev: target.kind === "commit" ? target.rev : null,
      staged: selected.staged,
    };
    setImages(null);
    setError(null);

    void (async () => {
      try {
        const pair = await imagePair(request);
        const next: Sides = { before: null, after: null };
        for (const side of ["before", "after"] as const) {
          const mime = pair[side];
          if (mime === null) {
            continue;
          }
          const bytes = await imageBlob({ ...request, side });
          const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
          urls.push(url);
          next[side] = url;
        }
        if (!cancelled) {
          setImages(next);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [root, target, selected]);

  const before = images?.before ?? null;
  const after = images?.after ?? null;
  const sideBySide = mode === "side" && before !== null && after !== null;
  const single = after ?? before;

  return (
    <div className="image-diff">
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {!images && !error && <p className="muted status-empty">Loading…</p>}
      {images && before === null && after === null && (
        <p className="muted status-empty">No image content in this change.</p>
      )}
      {images && (before !== null || after !== null) && (
        <>
          <p className="image-diff-note muted">{changeLabel(before, after)}</p>
          {sideBySide ? (
            <div className="image-compare">
              <figure className="image-side">
                <figcaption className="image-label before">Before</figcaption>
                <div className="image-frame">
                  <img src={before} alt="Before" />
                </div>
              </figure>
              <figure className="image-side">
                <figcaption className="image-label after">After</figcaption>
                <div className="image-frame">
                  <img src={after} alt="After" />
                </div>
              </figure>
            </div>
          ) : (
            <figure className="image-side">
              <figcaption className={`image-label ${after !== null ? "after" : "before"}`}>
                {after !== null ? "After" : "Before"}
              </figcaption>
              <div className="image-frame">
                <img src={single ?? ""} alt={after !== null ? "After" : "Before"} />
              </div>
            </figure>
          )}
        </>
      )}
    </div>
  );
}
