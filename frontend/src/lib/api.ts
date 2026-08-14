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

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ProblemDetails>;
    const problem = axiosError.response?.data;
    if (problem?.title) {
      return problem.title;
    }
    if (axiosError.message) {
      return axiosError.message;
    }
  }
  return "Something went wrong. Please try again.";
}
