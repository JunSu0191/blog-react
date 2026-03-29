import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeToggle, Button } from "@/shared/ui";
import { useToast } from "@/shared/ui/ToastProvider";
import {
  confirmFindId,
  requestFindIdVerification,
} from "../api/authApi";
import OtpVerificationPanel from "../components/OtpVerificationPanel";
import { resolveAuthErrorMessage } from "../constants/errorMessages";
import { useOtpFlow } from "../hooks/useOtpFlow";
import { VerificationChannel, VerificationPurpose } from "../types/auth.enums";
import type { FindIdFormValues } from "../types/auth.form";
import { isValidPhoneNumber, normalizePhoneNumber } from "../utils/phone";
import { validateEmailFormat, validateRequiredText } from "../utils/validators";

const INITIAL_FORM_VALUES: FindIdFormValues = {
  channel: VerificationChannel.SMS,
  target: "",
  code: "",
};

type FindIdFormErrors = {
  target?: string;
  code?: string;
};

export default function FindIdPage() {
  const { success, error: showError } = useToast();
  const [form, setForm] = useState<FindIdFormValues>(INITIAL_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<FindIdFormErrors>({});
  const [maskedUsername, setMaskedUsername] = useState<string | null>(null);

  const otpFlow = useOtpFlow<{ maskedUsername: string }>({
    purpose: VerificationPurpose.FIND_ID,
    initialChannel: VerificationChannel.SMS,
    sendHandler: (request) =>
      requestFindIdVerification({
        channel: request.channel,
        target: request.target,
      }),
    confirmHandler: (request) =>
      confirmFindId({
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
    setForm({ channel: nextChannel, target: "", code: "" });
    setFormErrors({});
    setMaskedUsername(null);
    otpFlow.reset();
  };

  const handleTargetChange = (value: string) => {
    setForm((previous) => ({ ...previous, target: value }));
    setFormErrors((previous) => ({ ...previous, target: undefined }));
    setMaskedUsername(null);
    otpFlow.invalidateByTarget(value, form.channel);
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
    setFormErrors({});

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
    if (!result?.maskedUsername) {
      showError("아이디 조회 결과를 확인할 수 없습니다.");
      return;
    }

    setMaskedUsername(result.maskedUsername);
    success("아이디 조회가 완료되었습니다.");
  };

  const handleRetry = () => {
    void otpFlow.retryLastAction();
  };

  const handleReset = () => {
    setMaskedUsername(null);
    setForm({ ...INITIAL_FORM_VALUES, channel: form.channel });
    setFormErrors({});
    otpFlow.reset();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <ThemeToggle className="absolute right-4 top-4" />

      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
          아이디 찾기
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          등록한 이메일 또는 휴대폰으로 인증 후 아이디를 확인할 수 있습니다.
        </p>

        <div className="mt-6">
          <OtpVerificationPanel
            title="아이디 찾기 인증"
            description="원하는 채널을 선택하고 인증번호를 확인해 주세요."
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
            onRetry={otpFlow.error?.retriable ? handleRetry : undefined}
            canResend={otpFlow.canResend}
            debugCode={otpFlow.debugCode}
          />
        </div>

        {maskedUsername ? (
          <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              조회 결과
            </p>
            <p className="mt-2 text-xl font-black text-emerald-700 dark:text-emerald-200">
              {maskedUsername}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/login" className="w-full sm:w-auto">
                <Button type="button" className="w-full sm:w-auto">
                  로그인으로 이동
                </Button>
              </Link>
              <Button type="button" variant="outline" onClick={handleReset}>
                다시 찾기
              </Button>
            </div>
          </section>
        ) : null}

        <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          비밀번호가 기억나지 않나요?{" "}
          <Link
            to="/reset-password"
            className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            비밀번호 재설정
          </Link>
        </div>
      </div>
    </div>
  );
}
