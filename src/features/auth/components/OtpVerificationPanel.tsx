import { RefreshCw } from "lucide-react";
import { Button, Input, Select } from "@/shared/ui";
import {
  VerificationChannel,
  VerificationStepStatus,
  type VerificationStepStatus as VerificationStepStatusType,
} from "../types/auth.enums";
import { formatCooldownTime } from "../utils/phone";

type OtpVerificationPanelProps = {
  title: string;
  description?: string;
  channel: VerificationChannel;
  onChannelChange?: (channel: VerificationChannel) => void;
  allowChannelSelection?: boolean;
  targetLabel: string;
  targetPlaceholder: string;
  targetValue: string;
  onTargetChange: (value: string) => void;
  targetError?: string;
  codeValue: string;
  onCodeChange: (value: string) => void;
  codeError?: string;
  onSendCode: () => void;
  onConfirmCode: () => void;
  stepStatus: VerificationStepStatusType;
  cooldownSeconds: number;
  expiresAt?: string | null;
  isSending: boolean;
  isConfirming: boolean;
  errorMessage?: string | null;
  onRetry?: () => void;
  canResend: boolean;
  debugCode?: string;
  disabled?: boolean;
};

const channelOptions = [
  { value: VerificationChannel.SMS, label: "휴대폰" },
  { value: VerificationChannel.EMAIL, label: "이메일" },
] as const;

const statusLabelMap: Record<VerificationStepStatusType, string> = {
  [VerificationStepStatus.IDLE]: "대기",
  [VerificationStepStatus.CODE_SENT]: "인증번호 전송됨",
  [VerificationStepStatus.VERIFIED]: "인증 완료",
  [VerificationStepStatus.COMPLETED]: "완료",
};

function formatExpiresAt(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("ko-KR");
}

export default function OtpVerificationPanel({
  title,
  description,
  channel,
  onChannelChange,
  allowChannelSelection = false,
  targetLabel,
  targetPlaceholder,
  targetValue,
  onTargetChange,
  targetError,
  codeValue,
  onCodeChange,
  codeError,
  onSendCode,
  onConfirmCode,
  stepStatus,
  cooldownSeconds,
  expiresAt,
  isSending,
  isConfirming,
  errorMessage,
  onRetry,
  canResend,
  debugCode,
  disabled = false,
}: OtpVerificationPanelProps) {
  const expiresAtText = formatExpiresAt(expiresAt);
  const isVerified =
    stepStatus === VerificationStepStatus.VERIFIED ||
    stepStatus === VerificationStepStatus.COMPLETED;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </p>
          {description ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            isVerified
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200",
          ].join(" ")}
        >
          {statusLabelMap[stepStatus]}
        </span>
      </div>

      {allowChannelSelection ? (
        <Select
          label="인증 채널"
          value={channel}
          onValueChange={(nextValue) =>
            onChannelChange?.(nextValue as VerificationChannel)
          }
          options={channelOptions.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          disabled={disabled || isSending || isConfirming}
        />
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
        <Input
          label={targetLabel}
          value={targetValue}
          onChange={(event) => onTargetChange(event.target.value)}
          placeholder={targetPlaceholder}
          disabled={disabled || isSending || isConfirming}
          error={targetError}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 self-end"
          onClick={onSendCode}
          isLoading={isSending}
          disabled={disabled || targetValue.trim().length === 0 || (!canResend && stepStatus !== VerificationStepStatus.IDLE)}
        >
          {cooldownSeconds > 0 ? `${formatCooldownTime(cooldownSeconds)}` : "인증번호 전송"}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
        <Input
          label="인증번호"
          value={codeValue}
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="6자리 인증번호"
          disabled={disabled || isSending || isConfirming}
          error={codeError}
        />
        <Button
          type="button"
          variant="primary"
          className="h-11 self-end"
          onClick={onConfirmCode}
          isLoading={isConfirming}
          disabled={disabled || codeValue.trim().length === 0 || stepStatus === VerificationStepStatus.IDLE}
        >
          인증번호 확인
        </Button>
      </div>

      <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400">
        {cooldownSeconds > 0 ? (
          <p>재전송 가능까지 {formatCooldownTime(cooldownSeconds)}</p>
        ) : null}
        {expiresAtText ? <p>인증 만료 시각: {expiresAtText}</p> : null}
        {import.meta.env.DEV && debugCode ? (
          <p className="font-semibold text-amber-700 dark:text-amber-300">
            DEV 인증코드: {debugCode}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/25">
          <p className="text-sm text-rose-700 dark:text-rose-200">{errorMessage}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-8"
              onClick={onRetry}
              disabled={disabled || isSending || isConfirming}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              다시 시도
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
