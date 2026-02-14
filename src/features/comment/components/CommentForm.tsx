import { useState } from "react";
import { Button } from "@/shared/ui";
import { useCreateComment } from "../queries";
import type { CommentCreateRequest } from "../api";

interface CommentFormProps {
  postId: number;
}

export default function CommentForm({ postId }: CommentFormProps) {
  const [content, setContent] = useState("");
  const createCommentMutation = useCreateComment();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!content.trim()) {
      alert("댓글 내용을 입력해주세요");
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        postId,
        content,
      } as CommentCreateRequest);
      setContent("");
    } catch (error) {
      console.error("댓글 생성 실패:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/70">
      <label className="mb-2 block text-sm font-bold text-slate-700 dark:text-slate-200">댓글 작성</label>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="생각을 남겨보세요"
        rows={4}
        disabled={createCommentMutation.isPending}
        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">서로 존중하는 커뮤니티 문화를 지켜주세요.</p>
        <Button type="submit" isLoading={createCommentMutation.isPending} className="rounded-xl bg-blue-600 text-white hover:bg-blue-700">
          등록
        </Button>
      </div>

      {createCommentMutation.isError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          댓글 작성에 실패했습니다.
        </p>
      )}
    </form>
  );
}
