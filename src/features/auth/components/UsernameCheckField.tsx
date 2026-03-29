import { Button, Input } from "@/shared/ui";
import {
  AvailabilityCheckStatus,
  type AvailabilityFieldState,
} from "../types/auth.form";

type UsernameCheckFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onCheck: () => void;
  state: AvailabilityFieldState;
  disabled?: boolean;
};

function resolveMessageColor(status: AvailabilityFieldState["status"]) {
  if (status === AvailabilityCheckStatus.AVAILABLE) {
    return "text-emerald-600 dark:text-emerald-300";
  }
  if (status === AvailabilityCheckStatus.UNAVAILABLE) {
    return "text-rose-600 dark:text-rose-300";
  }
  if (status === AvailabilityCheckStatus.CHECKING) {
    return "text-blue-600 dark:text-blue-300";
  }
  return "text-slate-500 dark:text-slate-400";
}

export default function UsernameCheckField({
  value,
  onChange,
  onCheck,
  state,
  disabled = false,
}: UsernameCheckFieldProps) {
  const isChecking = state.status === AvailabilityCheckStatus.CHECKING;

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px]">
        <Input
          label="아이디"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="영문/숫자 아이디"
          disabled={disabled || isChecking}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11 self-end"
          onClick={onCheck}
          isLoading={isChecking}
          disabled={disabled || value.trim().length === 0}
        >
          중복확인
        </Button>
      </div>
      {state.message ? (
        <p className={["text-sm", resolveMessageColor(state.status)].join(" ")}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
