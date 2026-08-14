import type { ReactNode } from "react";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-6 text-sm text-zinc-500"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  return (
    <Alert tone="error">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {onRetry && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetry}
            isLoading={isRetrying}
            loadingText="Retrying…"
          >
            Retry
          </Button>
        )}
      </div>
    </Alert>
  );
}

export function EmptyState({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-8 text-center">
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
    </div>
  );
}
