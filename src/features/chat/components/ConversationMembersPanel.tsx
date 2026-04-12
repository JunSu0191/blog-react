import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import { UserAvatar } from "@/shared/ui";

export type ConversationMemberSummary = {
  userId?: number;
  name: string;
  subLabel?: string;
  avatarUrl?: string;
  isCurrentUser?: boolean;
};

type ConversationMembersPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  title: string;
  participantCount?: number;
  members: ConversationMemberSummary[];
};

function MembersList({ members }: { members: ConversationMemberSummary[] }) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
        참여자 정보를 찾지 못했습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member, index) => (
        <div
          key={typeof member.userId === "number" ? member.userId : `${member.name}-${index}`}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950"
        >
          <UserAvatar
            name={member.name}
            imageUrl={member.avatarUrl}
            alt={`${member.name} 아바타`}
            className="h-10 w-10"
            fallbackClassName="text-xs font-black"
          />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {member.name}
            </p>
            <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
              {member.isCurrentUser ? "나" : member.subLabel || "참여자"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConversationMembersPanel({
  open,
  onOpenChange,
  isMobile,
  title,
  participantCount,
  members,
}: ConversationMembersPanelProps) {
  const countLabel =
    typeof participantCount === "number" && participantCount > 0
      ? `${participantCount}명 참여 중`
      : "참여자 목록";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] rounded-t-3xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-6"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="pr-8 text-base font-bold text-slate-900 dark:text-slate-100">
              {title}
            </SheetTitle>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              {countLabel}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 overflow-y-auto">
            <MembersList members={members} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-slate-200 p-0 dark:border-slate-700">
        <DialogHeader className="border-b border-slate-200 px-6 pb-4 pt-6 text-left dark:border-slate-700">
          <DialogTitle className="pr-8 text-base font-bold text-slate-900 dark:text-slate-100">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
            {countLabel}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          <MembersList members={members} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
