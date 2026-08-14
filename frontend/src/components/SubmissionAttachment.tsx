"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { downloadSubmissionFile, getApiErrorMessage } from "@/lib/api";
import { formatFileSize } from "@/lib/format";

/** Attachment row + Download button, shared by every surface that renders a Submission. */
export function SubmissionAttachment({
  submissionId,
  fileName,
  fileSizeBytes,
}: {
  submissionId: string;
  fileName: string;
  fileSizeBytes: number | null;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setError(null);
    setIsDownloading(true);
    try {
      await downloadSubmissionFile(submissionId, fileName);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not download the file."));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-600">
          📎 {fileName}
          {fileSizeBytes !== null && ` (${formatFileSize(fileSizeBytes)})`}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleDownload}
          isLoading={isDownloading}
          loadingText="Downloading…"
        >
          Download
        </Button>
      </div>
      {error && (
        <Alert tone="error" className="mt-2">
          {error}
        </Alert>
      )}
    </div>
  );
}
