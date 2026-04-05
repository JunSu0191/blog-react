import {
  TusUploadStage,
  uploadImageWithTus,
  type TusUploadOptions,
  type TusUploadStage as TusUploadStageType,
} from "@/features/post/tusUpload";
import { useState, useCallback } from "react";

export interface UseTusUploadReturn {
  upload: (file: File, options?: TusUploadOptions) => Promise<string>;
  isUploading: boolean;
  progress: number;
  stage: TusUploadStageType;
  error: Error | null;
}

export function useTusUpload(): UseTusUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<TusUploadStageType>(TusUploadStage.UPLOADING);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(async (file: File, options: TusUploadOptions = {}): Promise<string> => {
    setIsUploading(true);
    setProgress(0);
    setStage(TusUploadStage.UPLOADING);
    setError(null);

    try {
      const uploadedUrl = await uploadImageWithTus(file, {
        ...options,
        onProgress: (uploaded, total) => {
          const progressPercent = (uploaded / total) * 100;
          setProgress(progressPercent);
          options.onProgress?.(uploaded, total);
        },
        onStageChange: (nextStage) => {
          setStage(nextStage);
          options.onStageChange?.(nextStage);
        },
      });

      setIsUploading(false);
      setProgress(100);
      return uploadedUrl;
    } catch (error) {
      const uploadError =
        error instanceof Error ? error : new Error("업로드에 실패했습니다.");
      setError(uploadError);
      setIsUploading(false);
      throw uploadError;
    }
  }, []);

  return {
    upload,
    isUploading,
    progress,
    stage,
    error,
  };
}
