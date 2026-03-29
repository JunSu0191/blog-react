import { useSyncExternalStore } from "react";

export const CHAT_SIDEBAR_SECTION = {
  FRIENDS: "friends",
  DIRECT: "direct",
  GROUP: "group",
  INVITES: "invites",
} as const;

export type ChatSidebarSection =
  (typeof CHAT_SIDEBAR_SECTION)[keyof typeof CHAT_SIDEBAR_SECTION];

type ChatUiState = {
  activeSection: ChatSidebarSection;
  activeThreadId?: number;
  hiddenThreadIds: Set<number>;
  resurfacedThreadIds: Set<number>;
};

type ChatUiListener = () => void;

const listeners = new Set<ChatUiListener>();

const state: ChatUiState = {
  activeSection: CHAT_SIDEBAR_SECTION.DIRECT,
  activeThreadId: undefined,
  hiddenThreadIds: new Set<number>(),
  resurfacedThreadIds: new Set<number>(),
};

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: ChatUiListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return state;
}

function withUpdatedSet(
  source: Set<number>,
  action: (next: Set<number>) => void,
) {
  const next = new Set(source);
  action(next);
  return next;
}

export const chatUiStoreActions = {
  setActiveSection(section: ChatSidebarSection) {
    if (state.activeSection === section) return;
    state.activeSection = section;
    emit();
  },
  setActiveThreadId(threadId?: number) {
    if (state.activeThreadId === threadId) return;
    state.activeThreadId = threadId;
    emit();
  },
  markThreadHidden(threadId: number) {
    if (state.hiddenThreadIds.has(threadId)) return;
    state.hiddenThreadIds = withUpdatedSet(state.hiddenThreadIds, (next) => {
      next.add(threadId);
    });
    emit();
  },
  markThreadVisible(threadId: number) {
    if (
      !state.hiddenThreadIds.has(threadId) &&
      !state.resurfacedThreadIds.has(threadId)
    ) {
      return;
    }
    state.hiddenThreadIds = withUpdatedSet(state.hiddenThreadIds, (next) => {
      next.delete(threadId);
    });
    state.resurfacedThreadIds = withUpdatedSet(
      state.resurfacedThreadIds,
      (next) => {
        next.delete(threadId);
      },
    );
    emit();
  },
  markThreadResurfaced(threadId: number) {
    if (state.resurfacedThreadIds.has(threadId)) return;
    state.resurfacedThreadIds = withUpdatedSet(
      state.resurfacedThreadIds,
      (next) => {
        next.add(threadId);
      },
    );
    emit();
  },
  clearThreadResurfaced(threadId: number) {
    if (!state.resurfacedThreadIds.has(threadId)) return;
    state.resurfacedThreadIds = withUpdatedSet(
      state.resurfacedThreadIds,
      (next) => {
        next.delete(threadId);
      },
    );
    emit();
  },
  reset() {
    state.activeSection = CHAT_SIDEBAR_SECTION.DIRECT;
    state.activeThreadId = undefined;
    state.hiddenThreadIds = new Set<number>();
    state.resurfacedThreadIds = new Set<number>();
    emit();
  },
};

export function useChatUiStore<T>(selector: (current: ChatUiState) => T) {
  return useSyncExternalStore(
    subscribe,
    () => selector(snapshot()),
    () => selector(snapshot()),
  );
}

