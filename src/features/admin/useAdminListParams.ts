import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { normalizeDeletedFilter } from "./api";
import type {
  AdminDeletedFilter,
  AdminListParams,
  AdminListParamsWithDeleted,
  AdminListSortDirection,
} from "./types";

type UseAdminListParamsOptions = {
  defaultSize?: number;
  defaultSort?: string;
  includeDeleted?: boolean;
};

type AdminListParamsResult = {
  params: AdminListParamsWithDeleted;
  page: number;
  size: number;
  sort: string;
  keyword: string;
  deleted: AdminDeletedFilter;
  sortField: string;
  sortDirection: AdminListSortDirection;
  setPage: (page: number) => void;
  setSize: (size: number) => void;
  setKeyword: (keyword: string) => void;
  setDeleted: (deleted: AdminDeletedFilter) => void;
  setSort: (sort: string) => void;
  toggleSort: (field: string) => void;
};

function toSafePage(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function toSafeSize(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function normalizeSort(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.includes(",")) return fallback;
  const [field, direction] = trimmed.split(",");
  if (!field || !direction) return fallback;
  const normalizedDirection = direction.toLowerCase() === "asc" ? "asc" : "desc";
  return `${field},${normalizedDirection}`;
}

function splitSort(sort: string): {
  field: string;
  direction: AdminListSortDirection;
} {
  const [field = "createdAt", direction = "desc"] = sort.split(",");
  return {
    field,
    direction: direction.toLowerCase() === "asc" ? "asc" : "desc",
  };
}

export function useAdminListParams({
  defaultSize = 20,
  defaultSort = "createdAt,desc",
  includeDeleted = false,
}: UseAdminListParamsOptions = {}): AdminListParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = toSafePage(searchParams.get("page"));
  const size = toSafeSize(searchParams.get("size"), defaultSize);
  const sort = normalizeSort(searchParams.get("sort"), defaultSort);
  const keyword = (searchParams.get("keyword") || "").trim();
  const deleted = includeDeleted
    ? normalizeDeletedFilter(searchParams.get("deleted"))
    : "all";
  const { field: sortField, direction: sortDirection } = splitSort(sort);

  const params = useMemo<AdminListParamsWithDeleted>(() => {
    const base: AdminListParams = {
      page,
      size,
      sort,
      keyword: keyword || undefined,
    };
    if (!includeDeleted) {
      return base;
    }
    return {
      ...base,
      deleted,
    };
  }, [deleted, includeDeleted, keyword, page, size, sort]);

  const updateParams = useCallback(
    (patch: Partial<AdminListParamsWithDeleted>) => {
      const next = new URLSearchParams(searchParams);

      const nextPage = patch.page ?? page;
      const nextSize = patch.size ?? size;
      const nextSort = patch.sort ?? sort;
      const nextKeyword = patch.keyword ?? keyword;
      const nextDeleted =
        typeof patch.deleted !== "undefined" ? patch.deleted : deleted;

      next.set("page", String(Math.max(0, nextPage)));
      next.set("size", String(Math.max(1, nextSize)));
      next.set("sort", nextSort || defaultSort);

      const normalizedKeyword = (nextKeyword || "").trim();
      if (normalizedKeyword) next.set("keyword", normalizedKeyword);
      else next.delete("keyword");

      if (includeDeleted) {
        if (!nextDeleted || nextDeleted === "all") {
          next.delete("deleted");
        } else {
          next.set("deleted", nextDeleted);
        }
      } else {
        next.delete("deleted");
      }

      setSearchParams(next, { replace: true });
    },
    [
      defaultSort,
      deleted,
      includeDeleted,
      keyword,
      page,
      searchParams,
      setSearchParams,
      size,
      sort,
    ],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      updateParams({ page: Math.max(0, Math.floor(nextPage)) });
    },
    [updateParams],
  );

  const setSize = useCallback(
    (nextSize: number) => {
      updateParams({
        page: 0,
        size: Math.max(1, Math.floor(nextSize)),
      });
    },
    [updateParams],
  );

  const setKeyword = useCallback(
    (nextKeyword: string) => {
      updateParams({
        page: 0,
        keyword: nextKeyword || undefined,
      });
    },
    [updateParams],
  );

  const setDeleted = useCallback(
    (nextDeleted: AdminDeletedFilter) => {
      updateParams({
        page: 0,
        deleted: nextDeleted,
      });
    },
    [updateParams],
  );

  const setSort = useCallback(
    (nextSort: string) => {
      updateParams({
        page: 0,
        sort: normalizeSort(nextSort, defaultSort),
      });
    },
    [defaultSort, updateParams],
  );

  const toggleSort = useCallback(
    (field: string) => {
      const nextDirection: AdminListSortDirection =
        sortField === field && sortDirection === "desc" ? "asc" : "desc";
      setSort(`${field},${nextDirection}`);
    },
    [setSort, sortDirection, sortField],
  );

  return {
    params,
    page,
    size,
    sort,
    keyword,
    deleted,
    sortField,
    sortDirection,
    setPage,
    setSize,
    setKeyword,
    setDeleted,
    setSort,
    toggleSort,
  };
}
