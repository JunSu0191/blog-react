const BOOKMARK_STORAGE_KEY = "blog-pause:bookmarked-posts";

export function readBookmarkedPostIds() {
  if (typeof window === "undefined") return [] as number[];

  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is number => typeof item === "number" && Number.isFinite(item),
    );
  } catch {
    return [];
  }
}

export function writeBookmarkedPostIds(postIds: number[]) {
  if (typeof window === "undefined") return;
  const normalized = [...new Set(postIds)].filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(normalized));
}

export function toggleBookmarkedPostId(postId: number) {
  const current = new Set(readBookmarkedPostIds());
  if (current.has(postId)) {
    current.delete(postId);
  } else {
    current.add(postId);
  }
  const next = [...current];
  writeBookmarkedPostIds(next);
  return next;
}
