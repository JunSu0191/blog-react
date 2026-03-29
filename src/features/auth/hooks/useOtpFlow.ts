import { useCallback, useMemo, useState } from "react";
import type { StandardApiError } from "@/lib/apiError";
import { createApiError, parseApiError } from "@/lib/apiError";
import {
  confirmVerificationCode,
  sendVerificationCode,
} from "../api/authApi";
import { useCooldownTimer } from "./useCooldownTimer";
import {
  VerificationChannel,
  VerificationStepStatus,
  type VerificationPurpose,
} from "../types/auth.enums";
import type {
  ConfirmVerificationResponseData,
  SendVerificationRequest,
  SendVerificationResponseData,
} from "../types/auth.api";

type OtpConfirmPayload = {
  verificationId: number;
  code: string;
  purpose: VerificationPurpose;
  channel: VerificationChannel;
  target: string;
};

type OtpLastAction =
  | {
      type: "send";
      payload: {
        target: string;
        channel: VerificationChannel;
      };
    }
  | {
      type: "confirm";
      payload: {
        code: string;
      };
    };

type OtpActionResult<TData = unknown> = {
  ok: boolean;
  data?: TData;
  error?: StandardApiError;
};

type UseOtpFlowOptions<TConfirmData> = {
  purpose: VerificationPurpose;
  initialChannel?: VerificationChannel;
  sendHandler?: (request: SendVerificationRequest) => Promise<SendVerificationResponseData>;
  confirmHandler?: (request: OtpConfirmPayload) => Promise<TConfirmData>;
};

type OtpSessionState<TConfirmData> = {
  status: VerificationStepStatus;
  verificationId: number | null;
  expiresAt: string | null;
  resendCount: number;
  target: string;
  channel: VerificationChannel;
  verifiedAt: string | null;
  confirmedData: TConfirmData | null;
  debugCode?: string;
};

function createInitialState<TConfirmData>(
  initialChannel: VerificationChannel,
): OtpSessionState<TConfirmData> {
  return {
    status: VerificationStepStatus.IDLE,
    verificationId: null,
    expiresAt: null,
    resendCount: 0,
    target: "",
    channel: initialChannel,
    verifiedAt: null,
    confirmedData: null,
    debugCode: undefined,
  };
}

export function useOtpFlow<TConfirmData = ConfirmVerificationResponseData>({
  purpose,
  initialChannel = VerificationChannel.SMS,
  sendHandler,
  confirmHandler,
}: UseOtpFlowOptions<TConfirmData>) {
  const [state, setState] = useState<OtpSessionState<TConfirmData>>(() =>
    createInitialState(initialChannel),
  );
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<StandardApiError | null>(null);
  const [lastAction, setLastAction] = useState<OtpLastAction | null>(null);
  const cooldown = useCooldownTimer();

  const effectiveSendHandler = sendHandler ?? sendVerificationCode;
  const effectiveConfirmHandler = useMemo(() => {
    if (confirmHandler) return confirmHandler;
    return (request: OtpConfirmPayload) =>
      confirmVerificationCode({
        verificationId: request.verificationId,
        code: request.code,
      }) as Promise<TConfirmData>;
  }, [confirmHandler]);

  const reset = useCallback(() => {
    cooldown.clear();
    setError(null);
    setLastAction(null);
    setState(createInitialState<TConfirmData>(initialChannel));
  }, [cooldown, initialChannel]);

  const invalidateByTarget = useCallback(
    (nextTarget: string, nextChannel?: VerificationChannel) => {
      const normalizedTarget = nextTarget.trim();
      const normalizedChannel = nextChannel ?? state.channel;

      if (
        state.target === normalizedTarget &&
        state.channel === normalizedChannel
      ) {
        return;
      }

      cooldown.clear();
      setError(null);
      setLastAction(null);
      setState(createInitialState<TConfirmData>(normalizedChannel));
    },
    [cooldown, state.channel, state.target],
  );

  const executeSendCode = useCallback(
    async (
      payload: { target: string; channel: VerificationChannel },
      trackLastAction: boolean,
    ): Promise<OtpActionResult<SendVerificationResponseData>> => {
      const target = payload.target.trim();
      if (trackLastAction) {
        setLastAction({ type: "send", payload: { target, channel: payload.channel } });
      }

      setIsSending(true);
      setError(null);

      try {
        const result = await effectiveSendHandler({
          purpose,
          channel: payload.channel,
          target,
        });

        cooldown.start(result.cooldownSeconds);
        setState((previous) => ({
          ...previous,
          status: VerificationStepStatus.CODE_SENT,
          verificationId: result.verificationId,
          expiresAt: result.expiresAt,
          resendCount: result.resendCount,
          target,
          channel: payload.channel,
          verifiedAt: null,
          confirmedData: null,
          debugCode: result.debugCode,
        }));

        return { ok: true, data: result };
      } catch (caughtError) {
        const parsedError = parseApiError(caughtError);
        setError(parsedError);
        return { ok: false, error: parsedError };
      } finally {
        setIsSending(false);
      }
    },
    [cooldown, effectiveSendHandler, purpose],
  );

  const executeConfirmCode = useCallback(
    async (code: string, trackLastAction: boolean): Promise<OtpActionResult<TConfirmData>> => {
      const verificationId = state.verificationId;
      if (!verificationId) {
        const noVerificationError = createApiError({
          status: null,
          code: null,
          message: "인증번호를 먼저 전송해 주세요.",
          retriable: false,
        });
        setError(noVerificationError);
        return { ok: false, error: noVerificationError };
      }

      const normalizedCode = code.trim();
      if (trackLastAction) {
        setLastAction({ type: "confirm", payload: { code: normalizedCode } });
      }

      setIsConfirming(true);
      setError(null);

      try {
        const result = await effectiveConfirmHandler({
          verificationId,
          code: normalizedCode,
          purpose,
          channel: state.channel,
          target: state.target,
        });

        setState((previous) => ({
          ...previous,
          status: VerificationStepStatus.VERIFIED,
          confirmedData: result,
          verifiedAt: new Date().toISOString(),
        }));

        return { ok: true, data: result };
      } catch (caughtError) {
        const parsedError = parseApiError(caughtError);
        setError(parsedError);
        return { ok: false, error: parsedError };
      } finally {
        setIsConfirming(false);
      }
    },
    [effectiveConfirmHandler, purpose, state.channel, state.target, state.verificationId],
  );

  const sendCode = useCallback(
    async (payload: { target: string; channel: VerificationChannel }) => {
      return executeSendCode(payload, true);
    },
    [executeSendCode],
  );

  const confirmCode = useCallback(
    async (code: string) => {
      return executeConfirmCode(code.trim(), true);
    },
    [executeConfirmCode],
  );

  const retryLastAction = useCallback(
    async (): Promise<OtpActionResult<SendVerificationResponseData | TConfirmData>> => {
      if (!lastAction) return { ok: false };

      if (lastAction.type === "send") {
        return executeSendCode(lastAction.payload, false);
      }

      return executeConfirmCode(lastAction.payload.code, false);
    },
    [executeConfirmCode, executeSendCode, lastAction],
  );

  const markCompleted = useCallback(() => {
    setState((previous) => ({
      ...previous,
      status: VerificationStepStatus.COMPLETED,
    }));
  }, []);

  const canResend = state.status !== VerificationStepStatus.IDLE && !cooldown.isRunning;

  return {
    ...state,
    error,
    isSending,
    isConfirming,
    cooldownSeconds: cooldown.remainingSeconds,
    canResend,
    sendCode,
    confirmCode,
    retryLastAction,
    invalidateByTarget,
    markCompleted,
    reset,
  };
}
