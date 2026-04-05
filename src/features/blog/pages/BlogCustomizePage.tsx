import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { Check, Palette } from "lucide-react";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { resolveDisplayName } from "@/shared/lib/displayName";
import { parseErrorMessage } from "@/shared/lib/errorParser";
import { useToast } from "@/shared/ui/ToastProvider";
import { Button, Input, Select } from "@/shared/ui";
import { useMyBlogSettings, useUpdateMyBlogSettings } from "../queries";
import type {
  BlogFontScale,
  BlogProfileLayout,
  BlogThemePreset,
  BlogThemeSettingsRequest,
} from "../types";

const THEME_OPTIONS: Array<{ value: BlogThemePreset; label: string }> = [
  { value: "minimal", label: "미니멀" },
  { value: "ocean", label: "오션" },
  { value: "sunset", label: "선셋" },
  { value: "forest", label: "포레스트" },
];

const PROFILE_LAYOUT_OPTIONS: Array<{ value: BlogProfileLayout; label: string }> = [
  { value: "default", label: "기본" },
  { value: "compact", label: "컴팩트" },
  { value: "centered", label: "중앙 정렬" },
];

const FONT_SCALE_OPTIONS: Array<{ value: BlogFontScale; label: string }> = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
];

const PREVIEW_CLASS_MAP: Record<
  BlogThemePreset,
  {
    panel: string;
    cover: string;
  }
> = {
  minimal: {
    panel: "bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-900",
    cover: "bg-gradient-to-r from-slate-200 via-slate-100 to-white dark:from-slate-800 dark:via-slate-700 dark:to-slate-900",
  },
  ocean: {
    panel: "bg-gradient-to-b from-cyan-50 via-sky-50 to-white dark:from-cyan-950/30 dark:via-slate-900 dark:to-slate-900",
    cover: "bg-gradient-to-r from-cyan-300/70 via-sky-200/70 to-indigo-100 dark:from-cyan-700/60 dark:via-sky-700/50 dark:to-slate-900",
  },
  sunset: {
    panel: "bg-gradient-to-b from-orange-50 via-rose-50 to-white dark:from-orange-950/30 dark:via-rose-950/20 dark:to-slate-900",
    cover: "bg-gradient-to-r from-orange-300/70 via-rose-300/60 to-yellow-100 dark:from-orange-700/60 dark:via-rose-700/50 dark:to-slate-900",
  },
  forest: {
    panel: "bg-gradient-to-b from-emerald-50 via-lime-50 to-white dark:from-emerald-950/30 dark:via-lime-950/20 dark:to-slate-900",
    cover: "bg-gradient-to-r from-emerald-300/70 via-lime-200/70 to-green-100 dark:from-emerald-700/60 dark:via-lime-700/40 dark:to-slate-900",
  },
};

const DEFAULT_SETTINGS: BlogThemeSettingsRequest = {
  themePreset: "minimal",
  accentColor: "#2563eb",
  coverImageUrl: "",
  profileLayout: "default",
  fontScale: "md",
  showStats: true,
};

function normalizeHexColor(value: string) {
  const normalized = value.trim();
  if (!normalized) return DEFAULT_SETTINGS.accentColor;

  const withPrefix = normalized.startsWith("#") ? normalized : `#${normalized}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(withPrefix)) return DEFAULT_SETTINGS.accentColor;
  return withPrefix.toLowerCase();
}

export default function BlogCustomizePage() {
  const { user } = useAuthContext();
  const { success, error } = useToast();
  const settingsQuery = useMyBlogSettings();
  const updateSettingsMutation = useUpdateMyBlogSettings();
  const [form, setForm] = useState<BlogThemeSettingsRequest>(DEFAULT_SETTINGS);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;

    setForm({
      themePreset: settingsQuery.data.themePreset,
      accentColor: settingsQuery.data.accentColor,
      coverImageUrl: "",
      profileLayout: settingsQuery.data.profileLayout,
      fontScale: settingsQuery.data.fontScale,
      showStats: settingsQuery.data.showStats,
    });
    setHasHydrated(true);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) return;
    if (settingsQuery.isLoading) return;
    if (hasHydrated) return;
    setHasHydrated(true);
  }, [hasHydrated, settingsQuery.data, settingsQuery.isLoading]);

  const profilePath = useMemo(() => {
    const username = user?.username?.trim();
    if (!username) return null;
    return `/${encodeURIComponent(username)}`;
  }, [user?.username]);

  const previewTheme = PREVIEW_CLASS_MAP[form.themePreset];
  const previewStyle = {
    "--blog-accent": normalizeHexColor(form.accentColor),
  } as CSSProperties;
  const previewName = resolveDisplayName(user || {}, "Blog Pause");
  const previewInitial = previewName.slice(0, 1).toUpperCase() || "B";

  const saveDisabled =
    updateSettingsMutation.isPending || !hasHydrated;

  const handleFieldChange = <K extends keyof BlogThemeSettingsRequest>(
    key: K,
    value: BlogThemeSettingsRequest[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await updateSettingsMutation.mutateAsync({
        ...form,
        accentColor: normalizeHexColor(form.accentColor),
        coverImageUrl: null,
      });
      success("블로그 테마 설정을 저장했습니다.");
    } catch (caughtError) {
      error(parseErrorMessage(caughtError, "설정 저장에 실패했습니다."));
    }
  };

  if (settingsQuery.isLoading && !hasHydrated) {
    return (
      <div className="route-enter flex min-h-[44vh] flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-semibold text-slate-500">블로그 설정을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="route-enter space-y-4 pt-2 sm:pt-0">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              BLOG CUSTOMIZE
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100 sm:text-3xl">
              내 블로그 꾸미기
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              공개 블로그 페이지(`/:username`)에서 표시되는 테마를 설정합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profilePath ? (
              <Link to={profilePath}>
                <Button type="button" variant="outline" size="sm">
                  내 블로그 보기
                </Button>
              </Link>
            ) : null}
            <Link to="/mypage">
              <Button type="button" variant="outline" size="sm">
                마이페이지로
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {settingsQuery.error ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-200">
          저장된 설정을 불러오지 못해 기본값으로 표시합니다. 저장 시 새 설정이 반영됩니다.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="테마 프리셋"
              value={form.themePreset}
              options={THEME_OPTIONS}
              onValueChange={(value) =>
                handleFieldChange("themePreset", value as BlogThemePreset)
              }
            />
            <Select
              label="프로필 레이아웃"
              value={form.profileLayout}
              options={PROFILE_LAYOUT_OPTIONS}
              onValueChange={(value) =>
                handleFieldChange("profileLayout", value as BlogProfileLayout)
              }
            />
            <Select
              label="폰트 크기"
              value={form.fontScale}
              options={FONT_SCALE_OPTIONS}
              onValueChange={(value) =>
                handleFieldChange("fontScale", value as BlogFontScale)
              }
            />

            <div className="w-full">
              <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                강조 색상
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={normalizeHexColor(form.accentColor)}
                  onChange={(event) =>
                    handleFieldChange("accentColor", event.target.value)
                  }
                  className="h-11 w-14 cursor-pointer rounded-xl border border-slate-200 bg-white px-1 dark:border-slate-700 dark:bg-slate-900"
                />
                <Input
                  value={form.accentColor}
                  onChange={(event) =>
                    handleFieldChange("accentColor", event.target.value)
                  }
                  placeholder="#2563eb"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            프로필 사진은 배경 커버 없이 원형 아바타만 사용합니다.
            프로필 사진 변경은 마이페이지의 프로필 수정에서 관리합니다.
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              checked={form.showStats}
              onChange={(event) => handleFieldChange("showStats", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            통계(발행 글 수, 조회/공감 수) 공개
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              isLoading={updateSettingsMutation.isPending}
              loadingText="저장 중..."
              disabled={saveDisabled}
              className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              <Check className="h-4 w-4" />
              설정 저장
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saveDisabled}
              onClick={() => {
                if (!settingsQuery.data) {
                  setForm(DEFAULT_SETTINGS);
                  return;
                }
                setForm({
                  themePreset: settingsQuery.data.themePreset,
                  accentColor: settingsQuery.data.accentColor,
                  coverImageUrl: "",
                  profileLayout: settingsQuery.data.profileLayout,
                  fontScale: settingsQuery.data.fontScale,
                  showStats: settingsQuery.data.showStats,
                });
              }}
            >
              원래 값으로 되돌리기
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Palette className="h-4 w-4" />
            미리보기
          </div>

          <div
            className={[
              "overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700",
              previewTheme.panel,
            ].join(" ")}
            style={previewStyle}
          >
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="inline-flex h-14 w-14 items-center justify-center rounded-full text-lg font-black text-white"
                  style={{ backgroundColor: "var(--blog-accent)" }}
                >
                  {previewInitial}
                </div>
                <div className="min-w-0">
                  <h3
                    className="truncate text-lg font-black"
                    style={{ color: "var(--blog-accent)" }}
                  >
                    {previewName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    @{user?.username || "username"}
                  </p>
                </div>
              </div>
              {form.showStats ? (
                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  발행 글 수 128 · 조회 5,430 · 공감 912
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  통계 비공개
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
