import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ThemeToggle, Input, Button } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { useAuthContext } from "@/shared/context/useAuthContext";
import { parseApiError } from "@/lib/apiError";
import {
  checkNicknameAvailability,
  checkUsernameAvailability,
  completeSocialSignup,
  getPendingSocialSignup,
  registerAccount,
} from "../api/authApi";
import {
  AuthErrorCode,
  VerificationChannel,
  VerificationPurpose,
  VerificationStepStatus,
} from "../types/auth.enums";
import {
  AvailabilityCheckStatus,
  type RegisterFormErrors,
  type RegisterFormValues,
} from "../types/auth.form";
import { resolveAuthErrorMessage } from "../constants/errorMessages";
import UsernameCheckField from "../components/UsernameCheckField";
import NicknameCheckField from "../components/NicknameCheckField";
import OtpVerificationPanel from "../components/OtpVerificationPanel";
import { useOtpFlow } from "../hooks/useOtpFlow";
import {
  hasAvailabilityCheckPassed,
  resetAvailabilityIfValueChanged,
  toIdleAvailabilityState,
  validateEmailFormat,
  validatePasswordConfirm,
  validatePasswordPolicy,
  validateRequiredText,
} from "../utils/validators";
import { isValidPhoneNumber, normalizePhoneNumber } from "../utils/phone";
import {
  suggestUsernameCandidate,
  validateUsernamePolicy,
} from "@/shared/lib/socialSignup";

const INITIAL_FORM_VALUES: RegisterFormValues = {
  username: "",
  nickname: "",
  name: "",
  email: "",
  phoneNumber: "",
  password: "",
  passwordConfirm: "",
};

function stripError<K extends keyof RegisterFormErrors>(
  errors: RegisterFormErrors,
  keys: K[],
) {
  const next = { ...errors };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
}

function getRedirectPath(locationState: unknown) {
  if (!locationState || typeof locationState !== "object") return "/home";
  const redirectTo = (locationState as Record<string, unknown>).redirectTo;
  if (typeof redirectTo !== "string") return "/home";
  return redirectTo.trim() || "/home";
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { success, error: showError } = useToast();
  const { token, refreshUser, loginWithToken } = useAuthContext();
  const isSocialSignupMode = location.pathname === "/register/social";
  const redirectPath = getRedirectPath(location.state);
  const signupToken = searchParams.get("signupToken")?.trim() || "";
  const isPhoneVerificationEnabled = !import.meta.env.PROD;

  const [form, setForm] = useState<RegisterFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<RegisterFormErrors>({});
  const [verificationCode, setVerificationCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingPendingProfile, setIsLoadingPendingProfile] = useState(false);
  const [pendingProvider, setPendingProvider] = useState("");
  const [pendingName, setPendingName] = useState("");

  const [usernameCheckState, setUsernameCheckState] =
    useState(toIdleAvailabilityState);
  const [nicknameCheckState, setNicknameCheckState] =
    useState(toIdleAvailabilityState);

  const otpFlow = useOtpFlow({
    purpose: VerificationPurpose.SIGNUP,
    initialChannel: VerificationChannel.SMS,
  });

  const otpErrorMessage = useMemo(() => {
    if (!otpFlow.error) return undefined;
    return resolveAuthErrorMessage(otpFlow.error.code, otpFlow.error.message);
  }, [otpFlow.error]);

  useEffect(() => {
    if (!isSocialSignupMode && token) {
      navigate("/posts", { replace: true });
    }
  }, [isSocialSignupMode, navigate, token]);

  useEffect(() => {
    if (!isSocialSignupMode || !signupToken) return;

    let cancelled = false;
    setIsLoadingPendingProfile(true);
    setFormErrors((previous) => stripError(previous, ["submit"]));

    void (async () => {
      try {
        const pending = await getPendingSocialSignup(signupToken);
        if (cancelled) return;
        setPendingProvider(pending.authProvider || "");
        setPendingName(pending.name || "");
        setForm((previous) => ({
          ...previous,
          username: previous.username || suggestUsernameCandidate(pending),
          nickname:
            previous.nickname ||
            pending.nickname?.trim() ||
            pending.name?.trim() ||
            "",
          email: pending.email || previous.email,
          name: pending.name || previous.name,
        }));
      } catch (caughtError) {
        if (cancelled) return;
        const parsed = parseApiError(caughtError);
        setFormErrors((previous) => ({
          ...previous,
          submit: resolveAuthErrorMessage(parsed.code, parsed.message),
        }));
      } finally {
        if (!cancelled) {
          setIsLoadingPendingProfile(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSocialSignupMode, signupToken]);

  const isVerificationDone =
    isSocialSignupMode ||
    !isPhoneVerificationEnabled ||
    otpFlow.status === VerificationStepStatus.VERIFIED ||
    otpFlow.status === VerificationStepStatus.COMPLETED;

  const canSubmit =
    !isSubmitting &&
    !isLoadingPendingProfile &&
    hasAvailabilityCheckPassed(usernameCheckState, form.username) &&
    hasAvailabilityCheckPassed(nicknameCheckState, form.nickname) &&
    (isSocialSignupMode || isVerificationDone);

  const handleUsernameChange = (value: string) => {
    setForm((previous) => ({ ...previous, username: value }));
    setUsernameCheckState((previous) =>
      resetAvailabilityIfValueChanged(previous, value),
    );
    setFormErrors((previous) => stripError(previous, ["username", "submit"]));
  };

  const handleNicknameChange = (value: string) => {
    setForm((previous) => ({ ...previous, nickname: value }));
    setNicknameCheckState((previous) =>
      resetAvailabilityIfValueChanged(previous, value),
    );
    setFormErrors((previous) => stripError(previous, ["nickname", "submit"]));
  };

  const handleNameChange = (value: string) => {
    setForm((previous) => ({ ...previous, name: value }));
    setFormErrors((previous) => stripError(previous, ["name", "submit"]));
  };

  const handleEmailChange = (value: string) => {
    setForm((previous) => ({ ...previous, email: value }));
    setFormErrors((previous) => stripError(previous, ["email", "submit"]));
  };

  const handlePhoneChange = (value: string) => {
    setForm((previous) => ({ ...previous, phoneNumber: value }));
    setVerificationCode("");
    otpFlow.invalidateByTarget(value, VerificationChannel.SMS);
    setFormErrors((previous) =>
      stripError(previous, ["phoneNumber", "verificationCode", "submit"]),
    );
  };

  const handlePasswordChange = (value: string) => {
    setForm((previous) => ({ ...previous, password: value }));
    setFormErrors((previous) =>
      stripError(previous, ["password", "passwordConfirm", "submit"]),
    );
  };

  const handlePasswordConfirmChange = (value: string) => {
    setForm((previous) => ({ ...previous, passwordConfirm: value }));
    setFormErrors((previous) =>
      stripError(previous, ["passwordConfirm", "submit"]),
    );
  };

  const handleUsernameCheck = async () => {
    const username = form.username.trim();
    const required = validateRequiredText(username, "아이디를 입력해 주세요.");
    if (!required.valid) {
      setUsernameCheckState({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: required.message,
        checkedValue: undefined,
      });
      return;
    }

    if (isSocialSignupMode) {
      const policyValidation = validateUsernamePolicy(username.toLowerCase());
      if (!policyValidation.valid) {
        setUsernameCheckState({
          status: AvailabilityCheckStatus.UNAVAILABLE,
          message: policyValidation.message,
          checkedValue: undefined,
        });
        return;
      }
    }

    setUsernameCheckState({
      status: AvailabilityCheckStatus.CHECKING,
      message: "아이디 사용 가능 여부를 확인 중입니다.",
      checkedValue: isSocialSignupMode ? username.toLowerCase() : username,
    });

    try {
      const normalizedUsername = isSocialSignupMode
        ? username.toLowerCase()
        : username;
      const result = await checkUsernameAvailability({
        username: normalizedUsername,
      });
      if (result.available) {
        setUsernameCheckState({
          status: AvailabilityCheckStatus.AVAILABLE,
          message: "사용 가능한 아이디입니다.",
          checkedValue: normalizedUsername,
        });
      } else {
        setUsernameCheckState({
          status: AvailabilityCheckStatus.UNAVAILABLE,
          message: resolveAuthErrorMessage(AuthErrorCode.DUPLICATE_USERNAME),
          checkedValue: normalizedUsername,
        });
      }
    } catch (caughtError) {
      const parsed = parseApiError(caughtError);
      setUsernameCheckState({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: resolveAuthErrorMessage(parsed.code, parsed.message),
        checkedValue: isSocialSignupMode ? username.toLowerCase() : username,
      });
    }
  };

  const handleNicknameCheck = async () => {
    const nickname = form.nickname.trim();
    const required = validateRequiredText(nickname, "닉네임을 입력해 주세요.");
    if (!required.valid) {
      setNicknameCheckState({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: required.message,
        checkedValue: undefined,
      });
      return;
    }

    setNicknameCheckState({
      status: AvailabilityCheckStatus.CHECKING,
      message: "닉네임 사용 가능 여부를 확인 중입니다.",
      checkedValue: nickname,
    });

    try {
      const result = await checkNicknameAvailability({ nickname });
      if (result.available) {
        setNicknameCheckState({
          status: AvailabilityCheckStatus.AVAILABLE,
          message: "사용 가능한 닉네임입니다.",
          checkedValue: nickname,
        });
      } else {
        setNicknameCheckState({
          status: AvailabilityCheckStatus.UNAVAILABLE,
          message: resolveAuthErrorMessage(AuthErrorCode.DUPLICATE_NICKNAME),
          checkedValue: nickname,
        });
      }
    } catch (caughtError) {
      const parsed = parseApiError(caughtError);
      setNicknameCheckState({
        status: AvailabilityCheckStatus.UNAVAILABLE,
        message: resolveAuthErrorMessage(parsed.code, parsed.message),
        checkedValue: nickname,
      });
    }
  };

  const handleSendVerificationCode = async () => {
    const normalizedPhone = normalizePhoneNumber(form.phoneNumber);
    if (!isValidPhoneNumber(normalizedPhone)) {
      setFormErrors((previous) => ({
        ...previous,
        phoneNumber: "휴대폰 번호 형식이 올바르지 않습니다.",
      }));
      return;
    }

    setForm((previous) => ({ ...previous, phoneNumber: normalizedPhone }));
    setFormErrors((previous) =>
      stripError(previous, ["phoneNumber", "verificationCode", "submit"]),
    );

    const sendResult = await otpFlow.sendCode({
      target: normalizedPhone,
      channel: VerificationChannel.SMS,
    });

    if (!sendResult.ok) {
      showError(
        resolveAuthErrorMessage(sendResult.error?.code, sendResult.error?.message),
      );
      return;
    }

    success("인증번호를 전송했습니다.");
  };

  const handleConfirmVerificationCode = async () => {
    if (!verificationCode.trim()) {
      setFormErrors((previous) => ({
        ...previous,
        verificationCode: "인증번호를 입력해 주세요.",
      }));
      return;
    }

    const confirmResult = await otpFlow.confirmCode(verificationCode);
    if (!confirmResult.ok) {
      showError(
        resolveAuthErrorMessage(
          confirmResult.error?.code,
          confirmResult.error?.message,
        ),
      );
      return;
    }

    setFormErrors((previous) => stripError(previous, ["verificationCode", "submit"]));
    success("휴대폰 인증이 완료되었습니다.");
  };

  const handleRetryOtp = () => {
    void otpFlow.retryLastAction();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isSocialSignupMode && !signupToken) {
      setFormErrors((previous) => ({
        ...previous,
        submit: "소셜 가입 토큰이 없습니다. 다시 로그인해 주세요.",
      }));
      return;
    }

    const nextErrors: RegisterFormErrors = {};
    const normalizedUsername = isSocialSignupMode
      ? form.username.trim().toLowerCase()
      : form.username.trim();

    const usernameValidation = validateRequiredText(
      normalizedUsername,
      "아이디를 입력해 주세요.",
    );
    if (!usernameValidation.valid) {
      nextErrors.username = usernameValidation.message;
    }

    if (isSocialSignupMode) {
      const usernamePolicy = validateUsernamePolicy(normalizedUsername);
      if (!usernamePolicy.valid) {
        nextErrors.username = usernamePolicy.message;
      }
    }

    const nicknameValidation = validateRequiredText(form.nickname, "닉네임을 입력해 주세요.");
    if (!nicknameValidation.valid) {
      nextErrors.nickname = nicknameValidation.message;
    }

    if (!isSocialSignupMode) {
      const nameValidation = validateRequiredText(form.name, "이름을 입력해 주세요.");
      if (!nameValidation.valid) {
        nextErrors.name = nameValidation.message;
      }
    }

    if (!isSocialSignupMode) {
      const emailValidation = validateEmailFormat(form.email);
      if (!emailValidation.valid) {
        nextErrors.email = emailValidation.message;
      }
    }

    const normalizedPhone = normalizePhoneNumber(form.phoneNumber);
    if (
      !isSocialSignupMode &&
      isPhoneVerificationEnabled &&
      !isValidPhoneNumber(normalizedPhone)
    ) {
      nextErrors.phoneNumber = "휴대폰 번호 형식이 올바르지 않습니다.";
    }

    if (!isSocialSignupMode) {
      const passwordValidation = validatePasswordPolicy(form.password);
      if (!passwordValidation.valid) {
        nextErrors.password = passwordValidation.message;
      }

      const passwordConfirmValidation = validatePasswordConfirm(
        form.password,
        form.passwordConfirm,
      );
      if (!passwordConfirmValidation.valid) {
        nextErrors.passwordConfirm = passwordConfirmValidation.message;
      }
    }

    if (!hasAvailabilityCheckPassed(usernameCheckState, form.username)) {
      nextErrors.username = "아이디 중복확인을 완료해 주세요.";
    }

    if (
      isSocialSignupMode &&
      !hasAvailabilityCheckPassed(usernameCheckState, normalizedUsername)
    ) {
      nextErrors.username = "아이디 중복확인을 완료해 주세요.";
    }

    if (!hasAvailabilityCheckPassed(nicknameCheckState, form.nickname)) {
      nextErrors.nickname = "닉네임 중복확인을 완료해 주세요.";
    }

    if (
      !isSocialSignupMode &&
      isPhoneVerificationEnabled &&
      (!isVerificationDone || !otpFlow.verificationId)
    ) {
      nextErrors.verificationCode = "휴대폰 인증을 완료해 주세요.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }

    const verificationId = otpFlow.verificationId;
    if (!isSocialSignupMode && isPhoneVerificationEnabled && !verificationId) {
      setFormErrors((previous) => ({
        ...previous,
        verificationCode: "휴대폰 인증을 완료해 주세요.",
      }));
      return;
    }

    setIsSubmitting(true);
    setFormErrors((previous) => stripError(previous, ["submit"]));

    try {
      if (isSocialSignupMode) {
        const completeResponse = await completeSocialSignup({
          signupToken,
          username: normalizedUsername,
          nickname: form.nickname.trim(),
        });
        const authenticatedUser = completeResponse.token
          ? await loginWithToken(completeResponse.token)
          : await refreshUser().catch(() => null);
        if (!authenticatedUser) {
          setFormErrors((previous) => ({
            ...previous,
            submit:
              "가입은 완료되었지만 로그인 정보를 받지 못했습니다. 가입 완료 응답에 JWT 토큰을 포함해 주세요.",
          }));
          return;
        }
        success("회원가입이 완료되었습니다.");
        navigate(redirectPath, { replace: true });
      } else {
        await registerAccount({
          username: normalizedUsername,
          nickname: form.nickname.trim(),
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          password: form.password,
          ...(isPhoneVerificationEnabled
            ? {
                phoneNumber: normalizedPhone,
                verificationId: verificationId ?? undefined,
              }
            : {}),
        });

        otpFlow.markCompleted();
        success("회원가입이 완료되었습니다. 로그인해 주세요.");
        navigate("/login", { replace: true });
      }
    } catch (caughtError) {
      const parsed = parseApiError(caughtError);
      const userMessage = resolveAuthErrorMessage(parsed.code, parsed.message);

      if (parsed.code === AuthErrorCode.DUPLICATE_USERNAME) {
        setUsernameCheckState({
          status: AvailabilityCheckStatus.UNAVAILABLE,
          message: userMessage,
          checkedValue: normalizedUsername,
        });
        setFormErrors((previous) => ({ ...previous, username: userMessage }));
      } else if (parsed.code === AuthErrorCode.DUPLICATE_NICKNAME) {
        setNicknameCheckState({
          status: AvailabilityCheckStatus.UNAVAILABLE,
          message: userMessage,
          checkedValue: form.nickname.trim(),
        });
        setFormErrors((previous) => ({ ...previous, nickname: userMessage }));
      } else {
        setFormErrors((previous) => ({ ...previous, submit: userMessage }));
      }

      showError(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSocialSignupMode && !signupToken && !token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-lg dark:border-rose-900/60 dark:bg-slate-900">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            소셜 가입 토큰이 없습니다. 다시 로그인해 주세요.
          </p>
        </div>
      </div>
    );
  }

  if (isSocialSignupMode && isLoadingPendingProfile) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            소셜 가입 정보를 불러오는 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />

      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          {isSocialSignupMode ? "회원가입 마무리" : "회원가입"}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {isSocialSignupMode
            ? "소셜 계정 인증은 완료되었습니다. 블로그에서 사용할 아이디와 닉네임을 입력해 주세요."
            : isPhoneVerificationEnabled
            ? "아이디/닉네임 중복확인과 휴대폰 인증을 완료해야 가입할 수 있습니다."
            : "아이디/닉네임 중복확인만 완료하면 회원가입할 수 있습니다."}
        </p>

        {formErrors.submit ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-200">
            {formErrors.submit}
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <UsernameCheckField
            value={form.username}
            onChange={handleUsernameChange}
            onCheck={() => {
              void handleUsernameCheck();
            }}
            state={usernameCheckState}
            disabled={isSubmitting}
          />

          <NicknameCheckField
            value={form.nickname}
            onChange={handleNicknameChange}
            onCheck={() => {
              void handleNicknameCheck();
            }}
            state={nicknameCheckState}
            disabled={isSubmitting}
          />

          <Input
            label={isSocialSignupMode ? "이메일" : "이메일 (선택)"}
            value={form.email}
            onChange={(event) => handleEmailChange(event.target.value)}
            placeholder="example@email.com"
            disabled={isSubmitting || isSocialSignupMode}
            error={formErrors.email}
          />

          {!isSocialSignupMode ? (
            <Input
              label="이름"
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="실명을 입력해 주세요"
              disabled={isSubmitting}
              error={formErrors.name}
            />
          ) : (
            <div className="space-y-3">
              <Input
                label="연동 계정 이름"
                value={pendingName}
                placeholder="OAuth 제공자 이름"
                disabled
              />
              <Input
                label="소셜 제공자"
                value={pendingProvider}
                placeholder="GOOGLE / NAVER / KAKAO"
                disabled
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                블로그 주소에는 입력한 아이디가 사용되고, 작성자 이름 등 일반 화면에는 닉네임이 표시됩니다.
              </div>
            </div>
          )}

          {!isSocialSignupMode && isPhoneVerificationEnabled ? (
            <OtpVerificationPanel
              title="휴대폰 인증"
              description="인증번호 전송 후 확인을 완료해 주세요."
              channel={VerificationChannel.SMS}
              targetLabel="인증 대상"
              targetPlaceholder="휴대폰 번호"
              targetValue={form.phoneNumber}
              onTargetChange={handlePhoneChange}
              targetError={formErrors.phoneNumber}
              codeValue={verificationCode}
              onCodeChange={(value) => {
                setVerificationCode(value);
                setFormErrors((previous) => stripError(previous, ["verificationCode"]));
              }}
              codeError={formErrors.verificationCode}
              onSendCode={() => {
                void handleSendVerificationCode();
              }}
              onConfirmCode={() => {
                void handleConfirmVerificationCode();
              }}
              stepStatus={otpFlow.status}
              cooldownSeconds={otpFlow.cooldownSeconds}
              expiresAt={otpFlow.expiresAt}
              isSending={otpFlow.isSending}
              isConfirming={otpFlow.isConfirming}
              errorMessage={otpErrorMessage}
              onRetry={otpFlow.error?.retriable ? handleRetryOtp : undefined}
              canResend={otpFlow.canResend}
              debugCode={otpFlow.debugCode}
              disabled={isSubmitting}
            />
          ) : !isSocialSignupMode ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
              운영 환경에서는 휴대폰 인증을 생략하고 회원가입할 수 있습니다.
            </div>
          ) : null}

          {!isSocialSignupMode ? (
            <>
              <Input
                label="비밀번호"
                type="password"
                value={form.password}
                onChange={(event) => handlePasswordChange(event.target.value)}
                placeholder="비밀번호를 입력해 주세요"
                disabled={isSubmitting}
                error={formErrors.password}
              />

              <Input
                label="비밀번호 확인"
                type="password"
                value={form.passwordConfirm}
                onChange={(event) => handlePasswordConfirmChange(event.target.value)}
                placeholder="비밀번호를 다시 입력해 주세요"
                disabled={isSubmitting}
                error={formErrors.passwordConfirm}
              />
            </>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="mt-2 w-full"
            isLoading={isSubmitting}
            disabled={!canSubmit}
          >
            {isSocialSignupMode ? "가입 완료" : "회원가입"}
          </Button>
        </form>

        {!isSocialSignupMode ? (
          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            이미 계정이 있으신가요?{" "}
            <Link
              to="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              로그인
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
