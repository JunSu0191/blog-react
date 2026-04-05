import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./layout";
import type { ReactElement } from "react";
import { AdminGuard, RequireAuth } from "./guards";

const LoginPage = lazy(() => import("../features/user/pages/LoginPage"));
const RegisterPage = lazy(() => import("../features/auth/pages/RegisterPage"));
const FindIdPage = lazy(() => import("../features/auth/pages/FindIdPage"));
const ResetPasswordPage = lazy(
  () => import("../features/auth/pages/ResetPasswordPage"),
);
const NicknameOnboardingPage = lazy(
  () => import("../features/auth/pages/NicknameOnboardingPage"),
);
const OAuthCallbackPage = lazy(
  () => import("../features/user/pages/OAuthCallbackPage"),
);
const ForbiddenPage = lazy(() => import("../features/user/pages/ForbiddenPage"));
const ChangePasswordRequiredPage = lazy(
  () => import("../features/user/pages/ChangePasswordRequiredPage"),
);
const HomePage = lazy(() => import("../features/post/pages/HomePage"));
const SearchPage = lazy(() => import("../features/post/pages/SearchPage"));
const CategoryHubPage = lazy(() => import("../features/post/pages/CategoryHubPage"));
const TagHubPage = lazy(() => import("../features/post/pages/TagHubPage"));
const PostListPage = lazy(() => import("../features/post/pages/PostListPage"));
const CreatePostPage = lazy(() => import("../features/post/pages/CreatePostPage"));
const PostDetailPage = lazy(() => import("../features/post/pages/PostDetailPage"));
const MyPage = lazy(() => import("../features/social/pages/MyPage"));
const ChatPage = lazy(() => import("../features/chat/pages/ChatPage"));
const NotificationsPage = lazy(() => import("../features/notifications/pages/NotificationsPage"));
const AdminDashboardPage = lazy(
  () => import("../features/admin/pages/AdminDashboardPage"),
);
const AdminUsersPage = lazy(() => import("../features/admin/pages/AdminUsersPage"));
const AdminPostsPage = lazy(() => import("../features/admin/pages/AdminPostsPage"));
const AdminCategoriesPage = lazy(
  () => import("../features/admin/pages/AdminCategoriesPage"),
);
const AdminCommentsPage = lazy(
  () => import("../features/admin/pages/AdminCommentsPage"),
);
const AdminCurationPage = lazy(
  () => import("../features/admin/pages/AdminCurationPage"),
);
const BlogProfilePage = lazy(
  () => import("../features/blog/pages/BlogProfilePage"),
);
const BlogCustomizePage = lazy(
  () => import("../features/blog/pages/BlogCustomizePage"),
);

function RouteLoader() {
  return (
    <div className="route-enter flex min-h-[48vh] flex-col items-center justify-center gap-3">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
      <p className="text-sm font-semibold text-slate-500">페이지 로딩 중...</p>
    </div>
  );
}

function LazyRoute({ children }: { children: ReactElement }) {
  return <Suspense fallback={<RouteLoader />}>{children}</Suspense>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route
        path="/login"
        element={
          <LazyRoute>
            <LoginPage />
          </LazyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <LazyRoute>
            <RegisterPage />
          </LazyRoute>
        }
      />
      <Route
        path="/register/social"
        element={
          <LazyRoute>
            <RegisterPage />
          </LazyRoute>
        }
      />
      <Route
        path="/find-id"
        element={
          <LazyRoute>
            <FindIdPage />
          </LazyRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <LazyRoute>
            <ResetPasswordPage />
          </LazyRoute>
        }
      />
      <Route
        path="/auth/callback"
        element={
          <LazyRoute>
            <OAuthCallbackPage />
          </LazyRoute>
        }
      />
      <Route
        path="/onboarding/nickname"
        element={
          <RequireAuth>
            <LazyRoute>
              <NicknameOnboardingPage />
            </LazyRoute>
          </RequireAuth>
        }
      />
      <Route
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route
                path="/home"
                element={
                  <LazyRoute>
                    <HomePage />
                  </LazyRoute>
                }
              />
              <Route
                path="/search"
                element={
                  <LazyRoute>
                    <SearchPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/categories/:categoryId"
                element={
                  <LazyRoute>
                    <CategoryHubPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/tags/:tag"
                element={
                  <LazyRoute>
                    <TagHubPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/posts"
                element={
                  <LazyRoute>
                    <PostListPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/posts/create"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <CreatePostPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/posts/:postId/edit"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <CreatePostPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/posts/:postId"
                element={
                  <LazyRoute>
                    <PostDetailPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/mypage"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <MyPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/mypage/blog-customize"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <BlogCustomizePage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/chat"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <ChatPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/notifications"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <NotificationsPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/change-password"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <ChangePasswordRequiredPage />
                    </LazyRoute>
                  </RequireAuth>
                }
              />
              <Route
                path="/403"
                element={
                  <LazyRoute>
                    <ForbiddenPage />
                  </LazyRoute>
                }
              />
              <Route
                path="/admin"
                element={<Navigate to="/admin/dashboard" replace />}
              />
              <Route
                path="/admin/dashboard"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminDashboardPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminUsersPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/posts"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminPostsPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/curation"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminCurationPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminCategoriesPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/admin/comments"
                element={
                  <AdminGuard>
                    <LazyRoute>
                      <AdminCommentsPage />
                    </LazyRoute>
                  </AdminGuard>
                }
              />
              <Route
                path="/:username"
                element={
                  <LazyRoute>
                    <BlogProfilePage />
                  </LazyRoute>
                }
              />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
