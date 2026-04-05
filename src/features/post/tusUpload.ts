import { Upload } from "tus-js-client";
import { API_BASE_URL } from "@/shared/lib/api";
import { getToken } from "@/shared/lib/auth";

export interface TusUploadOptions {
  endpoint?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  postId?: number;
  onProgress?: (uploaded: number, total: number) => void;
  onStageChange?: (stage: TusUploadStage) => void;
  onError?: (error: Error) => void;
  onSuccess?: (url: string) => void;
}

export const TusUploadStage = {
  UPLOADING: "uploading",
  COMPLETING: "completing",
  COMPLETED: "completed",
} as const;

export type TusUploadStage =
  (typeof TusUploadStage)[keyof typeof TusUploadStage];

type TusCompleteResponseData = {
  id?: number;
  postId?: number;
  originalName?: string;
  storedName?: string;
  path?: string;
  fileUrl?: string;
  displayUrl?: string;
  markdown?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

function extractUploadId(uploadUrl: string): string | null {
  try {
    const parsed = new URL(uploadUrl);
    const matched = parsed.pathname.match(/\/uploads\/([^/]+)$/);
    return matched?.[1] ?? null;
  } catch {
    const matched = uploadUrl.match(/\/uploads\/([^/?#]+)/);
    return matched?.[1] ?? null;
  }
}

async function requestTusComplete(
  uploadId: string,
  file: File,
  options: TusUploadOptions,
): Promise<string> {
  const token = getToken();
  const completeHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token && !completeHeaders.Authorization) {
    completeHeaders.Authorization = `Bearer ${token}`;
  }

  const completeResponse = await fetch(`${API_BASE_URL}/attach-files/complete`, {
    method: "POST",
    headers: completeHeaders,
    body: JSON.stringify({
      uploadId,
      postId: options.postId,
      originalName: file.name,
    }),
  });

  const completePayload = (await completeResponse
    .json()
    .catch(() => ({}))) as ApiEnvelope<TusCompleteResponseData>;

  if (!completeResponse.ok) {
    const message = completePayload.message?.trim();
    throw new Error(message || "업로드 완료 처리에 실패했습니다.");
  }

  const finalUrl =
    completePayload.data?.displayUrl || completePayload.data?.fileUrl;

  if (!finalUrl) {
    throw new Error("업로드 완료 응답에 최종 파일 URL이 없습니다.");
  }

  return finalUrl;
}

export function createTusUpload(file: File, options: TusUploadOptions = {}) {
  const {
    endpoint = `${API_BASE_URL}/attach-files/uploads/`,
    headers = {},
    metadata = {},
    onProgress,
    onError,
  } = options;

  const upload = new Upload(file, {
    endpoint,
    headers,
    metadata: {
      filename: file.name,
      filetype: file.type,
      ...metadata,
    },
    retryDelays: [0, 3000, 5000, 10000, 20000],
    onError: (error) => {
      console.error("Tus upload error:", error);
      onError?.(error);
    },
    onProgress: (uploaded, total) => {
      console.log(`Progress: ${((uploaded / total) * 100) | 0}%`);
      onProgress?.(uploaded, total);
    },
    onSuccess: () => {
      return;
    },
  });

  return upload;
}

export async function uploadImageWithTus(
  file: File,
  options: TusUploadOptions = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const upload = createTusUpload(file, {
      ...options,
      onSuccess: async () => {
        try {
          if (!upload.url) {
            throw new Error("Upload URL is undefined");
          }
          const uploadId = extractUploadId(upload.url);

          if (!uploadId) {
            throw new Error("Upload ID를 추출할 수 없습니다");
          }

          options.onStageChange?.(TusUploadStage.COMPLETING);
          const completedUrl = await requestTusComplete(uploadId, file, options);

          const fileUrl =
            /^https?:\/\//i.test(completedUrl) || completedUrl.startsWith("/")
              ? completedUrl
              : `/${completedUrl}`;

          options.onStageChange?.(TusUploadStage.COMPLETED);
          options.onSuccess?.(fileUrl);
          resolve(fileUrl);
        } catch (error) {
          console.error("Tus complete error:", error);
          const uploadError =
            error instanceof Error
              ? error
              : new Error("업로드 후 파일 URL을 확인할 수 없습니다.");
          options.onError?.(uploadError);
          reject(uploadError);
        }
      },
      onProgress: (uploaded, total) => {
        options.onStageChange?.(TusUploadStage.UPLOADING);
        options.onProgress?.(uploaded, total);
      },
      onError: (error) => {
        options.onError?.(error);
        reject(error);
      },
    });

    options.onStageChange?.(TusUploadStage.UPLOADING);
    upload.start();
  });
}
