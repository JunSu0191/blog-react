export const CURATION_STORAGE_KEY = "blog-pause:admin-curation-slots";

export function readCurationPostIds() {
  if (typeof window === "undefined") return [] as number[];

  try {
    const raw = window.localStorage.getItem(CURATION_STORAGE_KEY);
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

export function writeCurationPostIds(postIds: number[]) {
  if (typeof window === "undefined") return;
  const normalized = [...new Set(postIds)].filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );
  window.localStorage.setItem(CURATION_STORAGE_KEY, JSON.stringify(normalized));
}
