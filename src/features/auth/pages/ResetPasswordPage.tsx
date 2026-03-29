import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle, Input, Button } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import { parseApiError } from "@/lib/apiError";
import {
  applyResetPassword,
  confirmResetPassword,
  requestResetPasswordVerification,
} from "../api/authApi";
import OtpVerificationPanel from "../components/OtpVerificationPanel";
import { resolveAuthErrorMessage } from "../constants/errorMessages";
import { useOtpFlow } from "../hooks/useOtpFlow";
import {
  authFlowStoreActions,
  useAuthFlowStore,
} from "../store/authFlowStore";
import {
  AuthErrorCode,
  VerificationChannel,
  VerificationPurpose,
} from "../types/auth.enums";
import type {
  ResetPasswordFormErrors,
  ResetPasswordFormValues,
} from "../types/auth.form";
import { isValidPhoneNumber, normalizePhoneNumber } from "../utils/phone";
import { hasResetToken, isResetTokenExpired } from "../utils/resetPassword";
import {
  validateEmailFormat,
  validatePasswordConfirm,
  validatePasswordPolicy,
  validateRequiredText,
} from "../utils/validators";

const INITIAL_FORM_VALUES: ResetPasswordFormValues = {
  channel: VerificationChannel.SMS,
  target: "",
  code: "",
  newPassword: "",
  newPasswordConfirm: "",
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const resetPasswordSession = useAuthFlowStore(
    (state) => state.resetPasswordSession,
  );

  const [form, setForm] = useState<ResetPasswordFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<ResetPasswordFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const otpFlow = useOtpFlow<{ resetToken: string; expiresAt: string }>({
    purpose: VerificationPurpose.RESET_PASSWORD,
    initialChannel: VerificationChannel.SMS,
    sendHandler: (request) =>
      requestResetPasswordVerification({
        channel: request.channel,
        target: request.target,
      }),
    confirmHandler: (request) =>
      confirmResetPassword({
        verificationId: request.verificationId,
        code: request.code,
      }),
  });

  const otpErrorMessage = useMemo(() => {
    if (!otpFlow.error) return undefined;
    return resolveAuthErrorMessage(otpFlow.error.code, otpFlow.error.message);
  }, [otpFlow.error]);

  const targetLabel =
    form.channel === VerificationChannel.SMS ? "휴대폰 번호" : "이메일";
  const targetPlaceholder =
    form.channel === VerificationChannel.SMS
      ? "01012345678"
      : "example@email.com";

  const handleChannelChange = (nextChannel: VerificationChannel) => {
    setForm({ ...INITIAL_FORM_VALUES, channel: nextChannel });
    setFormErrors({});
    otpFlow.reset();
    authFlowStoreActions.clearResetPasswordSession();
  };

  const handleTargetChange = (value: string) => {
    setForm((previous) => ({ ...previous, target: value }));
    setFormErrors((previous) => ({ ...previous, target: undefined }));
    otpFlow.invalidateByTarget(value, form.channel);
    authFlowStoreActions.clearResetPasswordSession();
  };

  const handleCodeChange = (value: string) => {
    setForm((previous) => ({ ...previous, code: value }));
    setFormErrors((previous) => ({ ...previous, code: undefined }));
  };

  const normalizeTargetByChannel = () => {
    if (form.channel === VerificationChannel.SMS) {
      return normalizePhoneNumber(form.target);
    }
    return form.target.trim();
  };

  const validateTarget = (normalizedTarget: string) => {
    if (form.channel === VerificationChannel.SMS) {
      if (!isValidPhoneNumber(normalizedTarget)) {
        return "휴대폰 번호 형식이 올바르지 않습니다.";
      }
      return null;
    }

    const required = validateRequiredText(normalizedTarget, "이메일을 입력해 주세요.");
    if (!required.valid) return required.message || "이메일을 입력해 주세요.";

    const email = validateEmailFormat(normalizedTarget);
    if (!email.valid) return email.message || "이메일 형식이 올바르지 않습니다.";

    return null;
  };

  const handleSendCode = async () => {
    const normalizedTarget = normalizeTargetByChannel();
    const targetError = validateTarget(normalizedTarget);
    if (targetError) {
      setFormErrors((previous) => ({ ...previous, target: targetError }));
      return;
    }

    setForm((previous) => ({ ...previous, target: normalizedTarget }));
    setFormErrors((previous) => ({ ...previous, target: undefined, code: undefined }));

    const sendResult = await otpFlow.sendCode({
      channel: form.channel,
      target: normalizedTarget,
    });

    if (!sendResult.ok) {
      showError(
        resolveAuthErrorMessage(sendResult.error?.code, sendResult.error?.message),
      );
      return;
    }

    success("인증번호를 전송했습니다.");
  };

  const handleConfirmCode = async () => {
    if (!form.code.trim()) {
      setFormErrors((previous) => ({
        ...previous,
        code: "인증번호를 입력해 주세요.",
      }));
      return;
    }

    const confirmResult = await otpFlow.confirmCode(form.code);
    if (!confirmResult.ok) {
      showError(
        resolveAuthErrorMessage(
          confirmResult.error?.code,
          confirmResult.error?.message,
        ),
      );
      return;
    }

    const result = confirmResult.data;
    if (!result?.resetToken || !result.expiresAt) {
      showError("재설정 토큰을 확인할 수 없습니다.");
      return;
    }

    authFlowStoreActions.setResetPasswordSession({
      resetToken: result.resetToken,
      expiresAt: result.expiresAt,
      channel: form.channel,
      target: form.target,
    });

    success("인증이 완료되었습니다. 새 비밀번호를 설정해 주세요.");
  };

  const handleRetryOtp = () => {
    void otpFlow.retryLastAction();
  };

  const handleApplyResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: ResetPasswordFormErrors = {};
    const session = resetPasswordSession;

    if (!session) {
      nextErrors.submit = "인증을 먼저 완료해 주세요.";
    } else if (isResetTokenExpired(session.expiresAt)) {
      nextErrors.submit = "재설정 토큰이 만료되었습니다. 다시 인증해 주세요.";
    }

    const passwordValidation = validatePasswordPolicy(form.newPassword);
    if (!passwordValidation.valid) {
      nextErrors.newPassword = passwordValidation.message;
    }

    const confirmValidation = validatePasswordConfirm(
      form.newPassword,
      form.newPasswordConfirm,
    );
    if (!confirmValidation.valid) {
      nextErrors.newPasswordConfirm = confirmValidation.message;
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      if (nextErrors.submit) {
        showError(nextErrors.submit);
      }
      if (session && isResetTokenExpired(session.expiresAt)) {
        authFlowStoreActions.clearResetPasswordSession();
      }
      return;
    }

    if (!session) return;

    setIsSubmitting(true);
    setFormErrors((previous) => ({ ...previous, submit: undefined }));

    try {
      await applyResetPassword({
        resetToken: session.resetToken,
        newPassword: form.newPassword,
      });

      otpFlow.markCompleted();
      authFlowStoreActions.clearResetPasswordSession();
      success("비밀번호가 변경되었습니다. 로그인해 주세요.");
      navigate("/login", { replace: true });
    } catch (caughtError) {
      const parsed = parseApiError(caughtError);
      const parsedMessage = resolveAuthErrorMessage(
        parsed.code,
        parsed.message,
      );
      setFormErrors((previous) => ({ ...previous, submit: parsedMessage }));
      showError(parsedMessage);
      if (
        parsed.code === AuthErrorCode.RESET_TOKEN_EXPIRED ||
        parsed.code === AuthErrorCode.RESET_TOKEN_INVALID
      ) {
        authFlowStoreActions.clearResetPasswordSession();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />

      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          비밀번호 재설정
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          인증번호 확인 후 새 비밀번호를 설정할 수 있습니다.
        </p>

        <div className="mt-6">
          <OtpVerificationPanel
            title="본인 인증"
            description="이메일 또는 휴대폰으로 인증번호를 확인해 주세요."
            channel={form.channel}
            onChannelChange={handleChannelChange}
            allowChannelSelection
            targetLabel={targetLabel}
            targetPlaceholder={targetPlaceholder}
            targetValue={form.target}
            onTargetChange={handleTargetChange}
            targetError={formErrors.target}
            codeValue={form.code}
            onCodeChange={handleCodeChange}
            codeError={formErrors.code}
            onSendCode={() => {
              void handleSendCode();
            }}
            onConfirmCode={() => {
              void handleConfirmCode();
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
          />
        </div>

        <form className="mt-6 space-y-3" onSubmit={handleApplyResetPassword}>
          <Input
            label="새 비밀번호"
            type="password"
            value={form.newPassword}
            onChange={(event) => {
              setForm((previous) => ({ ...previous, newPassword: event.target.value }));
              setFormErrors((previous) => ({ ...previous, newPassword: undefined }));
            }}
            placeholder="새 비밀번호"
            disabled={
              isSubmitting || !hasResetToken(resetPasswordSession?.resetToken)
            }
            error={formErrors.newPassword}
          />

          <Input
            label="새 비밀번호 확인"
            type="password"
            value={form.newPasswordConfirm}
            onChange={(event) => {
              setForm((previous) => ({ ...previous, newPasswordConfirm: event.target.value }));
              setFormErrors((previous) => ({ ...previous, newPasswordConfirm: undefined }));
            }}
            placeholder="새 비밀번호 확인"
            disabled={
              isSubmitting || !hasResetToken(resetPasswordSession?.resetToken)
            }
            error={formErrors.newPasswordConfirm}
          />

          {formErrors.submit ? (
            <p className="text-sm text-rose-600 dark:text-rose-300">{formErrors.submit}</p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
            disabled={
              isSubmitting || !hasResetToken(resetPasswordSession?.resetToken)
            }
          >
            비밀번호 변경
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          계정으로 돌아가기{" "}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
