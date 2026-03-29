import { useSyncExternalStore } from "react";
import type { VerificationChannel } from "../types/auth.enums";

export type ResetPasswordSession = {
  resetToken: string;
  expiresAt: string;
  channel: VerificationChannel;
  target: string;
};

type AuthFlowState = {
  resetPasswordSession: ResetPasswordSession | null;
};

type AuthFlowListener = () => void;

const listeners = new Set<AuthFlowListener>();

const state: AuthFlowState = {
  resetPasswordSession: null,
};

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: AuthFlowListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return state;
}

export const authFlowStoreActions = {
  setResetPasswordSession(session: ResetPasswordSession) {
    state.resetPasswordSession = session;
    emitChange();
  },
  clearResetPasswordSession() {
    state.resetPasswordSession = null;
    emitChange();
  },
};

export function useAuthFlowStore<T>(selector: (current: AuthFlowState) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(snapshot()),
    () => selector(snapshot()),
  );
}
