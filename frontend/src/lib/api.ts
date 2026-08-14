import axios, { AxiosError } from "axios";
import type { ProblemDetails, UserRole } from "./types";

const AUTH_STORAGE_KEY = "assignment_system_auth";

export interface StoredAuth {
  token: string;
  role: UserRole;
  fullName: string;
}

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (auth) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5080/api",
});

api.interceptors.request.use((config) => {
  const token = getStoredAuth()?.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * `AuthProvider` registers a handler here so an expired or rejected token drops
 * the session and bounces to /login instead of leaving the user on a page full of
 * "Something went wrong" errors.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // A 401 from the login call is "wrong credentials", not an expired session.
      const url = error.config?.url ?? "";
      if (!url.includes("/auth/login")) {
        setStoredAuth(null);
        onUnauthorized?.();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Downloads a submission's attached file. A plain `<a href>` can't carry the Bearer
 * auth header this app relies on (no cookie auth), so this fetches the file as a
 * blob through the authenticated axios instance and triggers the save via a
 * throwaway object URL.
 */
export async function downloadSubmissionFile(submissionId: string, fileName: string): Promise<void> {
  const response = await api.get(`/submissions/${submissionId}/file`, { responseType: "blob" });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validationMessages(problem: ProblemDetails): string | null {
  if (!problem.errors || typeof problem.errors !== "object") {
    return null;
  }
  const messages = Object.values(problem.errors)
    .flat()
    .filter((message): message is string => typeof message === "string" && message.length > 0);
  return messages.length > 0 ? messages.join(" ") : null;
}

/**
 * Turns an axios failure into something worth showing a user. The API always
 * answers with RFC-7807 `ProblemDetails`, so the useful message is normally
 * `title` (or the flattened `errors` dictionary for model-validation failures).
 */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ProblemDetails>;

    if (!axiosError.response) {
      return "Cannot reach the server. Check that the API is running and try again.";
    }

    const problem = axiosError.response.data;
    if (problem && typeof problem === "object") {
      const fromValidation = validationMessages(problem);
      if (fromValidation) {
        return fromValidation;
      }
      if (problem.detail) {
        return problem.detail;
      }
      if (problem.title) {
        return problem.title;
      }
    }

    switch (axiosError.response.status) {
      case 401:
        return "Your session has expired. Please sign in again.";
      case 403:
        return "You do not have permission to do that.";
      case 404:
        return "That item no longer exists.";
      default:
        break;
    }
  }
  return fallback;
}
