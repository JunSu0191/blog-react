let createPostPagePromise: Promise<unknown> | null = null;
let postDetailPagePromise: Promise<unknown> | null = null;
let richTextEditorPromise: Promise<unknown> | null = null;

export function preloadCreatePostPage() {
  if (!createPostPagePromise) {
    createPostPagePromise = import("@/features/post/pages/CreatePostPage");
  }
  return createPostPagePromise;
}

export function preloadPostDetailPage() {
  if (!postDetailPagePromise) {
    postDetailPagePromise = import("@/features/post/pages/PostDetailPage");
  }
  return postDetailPagePromise;
}

export function preloadRichTextEditor() {
  if (!richTextEditorPromise) {
    richTextEditorPromise = import("@/shared/ui/RichTextEditor");
  }
  return richTextEditorPromise;
}

export function preloadCreateFlow() {
  return Promise.all([preloadCreatePostPage(), preloadRichTextEditor()]);
}
