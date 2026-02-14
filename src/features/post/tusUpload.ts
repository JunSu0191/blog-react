import { Upload } from "tus-js-client";
import { API_BASE_URL } from "@/shared/lib/api";
import { getToken } from "@/shared/lib/auth";

export interface TusUploadOptions {
  endpoint?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, string>;
  postId?: number;
  onProgress?: (uploaded: number, total: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (url: string) => void;
}

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
): Promise<string | null> {
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

  if (!completeResponse.ok) {
    return null;
  }

  const completePayload = (await completeResponse.json()) as ApiEnvelope<TusCompleteResponseData>;

  return (
    completePayload.data?.displayUrl ||
    completePayload.data?.fileUrl ||
    completePayload.data?.path ||
    null
  );
}

async function requestUploadInfo(
  uploadId: string,
  uploadUrl: string,
  options: TusUploadOptions,
): Promise<string | null> {
  const token = getToken();
  const infoHeaders: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (token && !infoHeaders.Authorization) {
    infoHeaders.Authorization = `Bearer ${token}`;
  }

  const infoResponse = await fetch(
    `${API_BASE_URL}/attach-files/uploads/${uploadId}/info`,
    { headers: infoHeaders },
  );
  if (!infoResponse.ok) {
    return uploadUrl;
  }

  const infoPayload = (await infoResponse.json()) as ApiEnvelope<Record<string, string>>;
  return (
    infoPayload.data?.downloadUrl ||
    infoPayload.data?.displayUrl ||
    infoPayload.data?.fileUrl ||
    uploadUrl
  );
}

export function createTusUpload(file: File, options: TusUploadOptions = {}) {
  const {
    endpoint = `${API_BASE_URL}/attach-files/uploads`,
    headers = {},
    metadata = {},
    onProgress,
    onError,
    onSuccess,
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
      onSuccess?.(upload.url ?? "");
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

          // 우선 complete API로 public URL 확보, 실패 시 info API로 fallback
          const completedUrl =
            (await requestTusComplete(uploadId, file, options)) ||
            (await requestUploadInfo(uploadId, upload.url, options)) ||
            upload.url;

          const fileUrl =
            /^https?:\/\//i.test(completedUrl) || completedUrl.startsWith("/")
              ? completedUrl
              : `/${completedUrl}`;

          options.onSuccess?.(fileUrl);
          resolve(fileUrl);
        } catch (error) {
          console.error(error);
          const fallbackUrl = upload.url;
          if (fallbackUrl) {
            options.onSuccess?.(fallbackUrl);
            resolve(fallbackUrl);
            return;
          }
          reject(
            error instanceof Error
              ? error
              : new Error("업로드 후 파일 URL을 확인할 수 없습니다."),
          );
        }
      },
      onError: (error) => {
        options.onError?.(error);
        reject(error);
      },
    });

    upload.start();
  });
}
