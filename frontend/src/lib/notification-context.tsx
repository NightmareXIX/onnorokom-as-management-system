"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import type { Notification, PagedResult } from "./types";

const POLL_INTERVAL_MS = 30000;
const RECENT_PAGE_SIZE = 20;

interface NotificationContextValue {
  unreadCount: number;
  notifications: Notification[];
  isLoading: boolean;
  fetchRecent: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isAuthenticated = token !== null;

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await api.get<{ count: number }>("/notifications/unread-count");
      setUnreadCount(response.data.count);
    } catch {
      // Silent: a failed background poll shouldn't interrupt the user with an error.
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      // Synchronous reset on logout, not a derived-from-fetch update.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      setNotifications([]);
      return;
    }

    refreshUnreadCount();
    const intervalId = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, refreshUnreadCount]);

  const fetchRecent = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<PagedResult<Notification>>("/notifications", {
        params: { pageSize: RECENT_PAGE_SIZE },
      });
      setNotifications(response.data.items);
    } catch {
      // Leave the previous list in place rather than clearing it on a transient failure.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      // Best-effort: the next poll will reconcile local state with the server.
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await api.post("/notifications/mark-all-read");
    } catch {
      // Best-effort: the next poll will reconcile local state with the server.
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{ unreadCount, notifications, isLoading, fetchRecent, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
