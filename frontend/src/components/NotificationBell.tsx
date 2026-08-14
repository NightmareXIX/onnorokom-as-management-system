"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { deadlineDistance } from "@/lib/format";
import { useNotifications } from "@/lib/notification-context";
import type { Notification } from "@/lib/types";

function unreadCountLabel(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export function NotificationBell() {
  const { unreadCount, notifications, isLoading, fetchRecent, markAsRead, markAllAsRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const toggleOpen = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      fetchRecent();
    }
  };

  const handleSelect = async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    // No `relative` here: the dropdown below anchors against AppHeader's `nav` (the
    // nearest positioned ancestor) instead of this button's own small bounding box,
    // so it stays right-aligned to the header's edge even when the bell itself sits
    // mid-row (e.g. before the Log out button) rather than flush against that edge.
    <div ref={containerRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={isOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path
            d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M10 19a2 2 0 0 0 4 0"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        {unreadCount > 0 && (
          <Badge
            tone="red"
            className="absolute -right-1 -top-1 min-w-[1.1rem] justify-center px-1 py-0 leading-4"
          >
            {unreadCountLabel(unreadCount)}
          </Badge>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[90vw] rounded-lg border border-zinc-200 bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2">
            <span className="text-sm font-semibold text-zinc-900">Notifications</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              Mark all as read
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 && (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-zinc-500">
                <Spinner />
                <span>Loading…</span>
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">No notifications yet.</p>
            )}

            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(notification)}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-zinc-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-zinc-50 ${
                  notification.isRead ? "" : "bg-blue-50/60"
                }`}
              >
                <span className="flex w-full items-start gap-2">
                  {!notification.isRead && (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600"
                    />
                  )}
                  <span
                    className={`min-w-0 flex-1 break-words ${notification.isRead ? "text-zinc-600" : "font-medium text-zinc-900"}`}
                  >
                    {notification.message}
                  </span>
                </span>
                <span className="pl-3.5 text-xs text-zinc-400">
                  {deadlineDistance(notification.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
