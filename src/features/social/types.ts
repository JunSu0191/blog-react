export type PostLikeStatus = {
  postId: number;
  liked: boolean;
  likeCount: number;
};

export type CommentReactionType = "LIKE" | "DISLIKE" | "NONE";

export type CommentReactionStatus = {
  commentId: number;
  myReaction: CommentReactionType;
  likeCount: number;
  dislikeCount: number;
};

export type MyPageSummary = {
  userId: number;
  username: string;
  name: string;
  profile: {
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    websiteUrl: string | null;
    location: string | null;
  };
  stats: {
    postCount: number;
    commentCount: number;
    likedPostCount: number;
  };
};

export type MyPageProfileUpdateRequest = {
  name: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  websiteUrl: string | null;
  location: string | null;
};

export type MyPagePostItem = {
  id: number;
  title: string;
  content?: string;
  createdAt?: string;
  likeCount?: number;
  commentCount?: number;
};

export type MyPageCommentItem = {
  id: number;
  postId?: number;
  postTitle?: string;
  content: string;
  createdAt?: string;
  likeCount?: number;
  dislikeCount?: number;
  myReaction?: CommentReactionType;
};
