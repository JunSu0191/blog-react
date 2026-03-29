let createPostPagePromise: Promise<unknown> | null = null;
let postDetailPagePromise: Promise<unknown> | null = null;
let editorPromise: Promise<unknown> | null = null;

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

export function preloadPostEditor() {
  if (!editorPromise) {
    editorPromise = import("@/features/post/components/editor/BlogEditor");
  }
  return editorPromise;
}

export function preloadCreateFlow() {
  return Promise.all([preloadCreatePostPage(), preloadPostEditor()]);
}
