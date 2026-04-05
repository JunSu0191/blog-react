import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input, Button, ThemeToggle } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { parseApiError } from "@/lib/apiError";
import { resolveAuthErrorMessage } from "../constants/errorMessages";
import { checkNicknameAvailability } from "../api/authApi";
import { AvailabilityCheckStatus } from "../types/auth.form";
import {
  hasCompletedNicknameOnboarding,
  markNicknameOnboardingCompleted,
} from "@/shared/lib/nicknameOnboarding";
import {
  needsNicknameOnboarding,
  resolveDisplayName,
} from "@/shared/lib/displayName";
import { useMyPage } from "@/features/social/hooks/useMyPage";

type AvailabilityState = {
  status: AvailabilityCheckStatus;
  message?: string;
  checkedValue?: string;
};

const IDLE_STATE: AvailabilityState = {
  status: AvailabilityCheckStatus.IDLE,
};

function getRedirectPath(locationState: unknown) {
  if (!locationState || typeof locationState !== "object") return "/home";
  const redirectTo = (locationState as Record<string, unknown>).redirectTo;
  if (typeof redirectTo !== "string") return "/home";
  return redirectTo.trim() || "/home";
}

export default function NicknameOnboardingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const { success, error: showError } = useToast();
  const { summary, updateProfile, isUpdatingProfile } = useMyPage();
  const redirectPath = getRedirectPath(location.state);
  const initialValue = useMemo(() => {
    const preferredName =
      (typeof user?.name === "string" ? user.name.trim() : "") ||
      (typeof summary?.name === "string" ? summary.name.trim() : "");
    if (preferredName) return preferredName;

    return resolveDisplayName(
      {
        displayName: summary?.profile.displayName,
        nickname: user?.nickname,
        name: user?.name,
        username: user?.username,
      },
      "",
    );
  }, [
    summary?.name,
    summary?.profile.displayName,
    user?.name,
    user?.nickname,
    user?.username,
  ]);

  const [nickname, setNickname] = useState(initialValue);
  const [availability, setAvailability] = useState<AvailabilityState>(IDLE_STATE);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setNickname(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (!user) return;
    if (hasCompletedNicknameOnboarding(user.id)) {
      navigate(redirectPath, { replace: true });
      return;
    }

    if (!needsNicknameOnboarding(user)) {
      markNicknameOnboardingCompleted(user.id);
      navigate(redirectPath, { replace: true });
    }
  }, [navigate, redirectPath, user]);

  const handleCheckAvailability = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setAvailability({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: "닉네임을 입력해 주세요.",
        checkedValue: undefined,
      });
      return;
    }

    setAvailability({
      status: AvailabilityCheckStatus.CHECKING,
      message: "닉네임 사용 가능 여부를 확인 중입니다.",
      checkedValue: trimmed,
    });

    try {
      const result = await checkNicknameAvailability({ nickname: trimmed });
      setAvailability({
        status: result.available
          ? AvailabilityCheckStatus.AVAILABLE
          : AvailabilityCheckStatus.UNAVAILABLE,
        message: result.available
          ? "사용 가능한 닉네임입니다."
          : "이미 사용 중인 닉네임입니다.",
        checkedValue: trimmed,
      });
    } catch (error) {
      const parsed = parseApiError(error);
      setAvailability({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: resolveAuthErrorMessage(parsed.code, parsed.message),
        checkedValue: trimmed,
      });
    }
  };

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setSubmitError("닉네임을 입력해 주세요.");
      return;
    }

    if (
      availability.status !== AvailabilityCheckStatus.AVAILABLE ||
      availability.checkedValue !== trimmed
    ) {
      setSubmitError("닉네임 중복확인을 완료해 주세요.");
      return;
    }

    if (!summary) {
      setSubmitError("사용자 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    try {
      await updateProfile({
        name: summary.name,
        displayName: trimmed,
        bio: summary.profile.bio,
        avatarUrl: summary.profile.avatarUrl,
        websiteUrl: summary.profile.websiteUrl,
        location: summary.profile.location,
      });

      markNicknameOnboardingCompleted(user?.id);
      success("표시 이름을 저장했습니다.");
      navigate(redirectPath, { replace: true });
    } catch (error) {
      const parsed = parseApiError(error);
      const message = resolveAuthErrorMessage(parsed.code, parsed.message);
      setSubmitError(message);
      showError(message);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-lg dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600 dark:text-blue-300">
          PROFILE SETUP
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          표시 이름을 설정해 주세요
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          소셜 로그인으로 생성된 아이디는 내부 식별자입니다. 서비스에서는 사람이
          읽을 수 있는 닉네임을 표시합니다.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          <p>아이디/핸들: @{user?.username || "-"}</p>
          <p className="mt-1">
            현재 표시 예정 이름: {resolveDisplayName(user || {}, "미설정")}
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Input
            label="닉네임"
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setSubmitError(null);
              setAvailability((previous) =>
                previous.checkedValue === event.target.value.trim()
                  ? previous
                  : IDLE_STATE,
              );
            }}
            maxLength={30}
            placeholder="서비스에서 보여질 이름"
            disabled={isUpdatingProfile}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void handleCheckAvailability();
            }}
            isLoading={availability.status === AvailabilityCheckStatus.CHECKING}
            disabled={isUpdatingProfile || nickname.trim().length === 0}
          >
            닉네임 중복확인
          </Button>

          {availability.message ? (
            <p
              className={[
                "text-sm",
                availability.status === AvailabilityCheckStatus.AVAILABLE
                  ? "text-emerald-600 dark:text-emerald-300"
                  : availability.status === AvailabilityCheckStatus.UNAVAILABLE
                    ? "text-rose-600 dark:text-rose-300"
                    : "text-slate-500 dark:text-slate-400",
              ].join(" ")}
            >
              {availability.message}
            </p>
          ) : null}

          {submitError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {submitError}
            </div>
          ) : null}
        </div>

        <Button
          type="button"
          size="lg"
          className="mt-6 w-full"
          onClick={() => {
            void handleSubmit();
          }}
          isLoading={isUpdatingProfile}
        >
          표시 이름 저장
        </Button>
      </div>
    </div>
  );
}
