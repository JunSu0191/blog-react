import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthContext } from "../shared/context/useAuthContext";
import { getToken } from "../shared/lib/auth";
import Layout from "./layout";
import type { ReactElement } from "react";

const LoginPage = lazy(() => import("../features/user/pages/LoginPage"));
const RegisterPage = lazy(() => import("../features/user/pages/RegisterPage"));
const PostListPage = lazy(() => import("../features/post/pages/PostListPage"));
const CreatePostPage = lazy(() => import("../features/post/pages/CreatePostPage"));
const PostDetailPage = lazy(() => import("../features/post/pages/PostDetailPage"));
const MyPage = lazy(() => import("../features/social/pages/MyPage"));
const ChatPage = lazy(() => import("../features/chat/pages/ChatPage"));
const NotificationsPage = lazy(() => import("../features/notifications/pages/NotificationsPage"));

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
      <Route path="/" element={<Navigate to="/login" replace />} />
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
        path="/*"
        element={
          <Layout>
            <Routes>
              <Route
                path="/posts"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <PostListPage />
                    </LazyRoute>
                  </RequireAuth>
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
                path="/posts/:id"
                element={
                  <RequireAuth>
                    <LazyRoute>
                      <PostDetailPage />
                    </LazyRoute>
                  </RequireAuth>
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
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  try {
    const { token } = useAuthContext();
    const effectiveToken = token ?? getToken();
    if (!effectiveToken) return <Navigate to="/login" replace />;
    return children;
  } catch {
    return <Navigate to="/login" replace />;
  }
}
