// src/components/layout/NotificationBell.jsx
//
// Self-contained sidebar nav item. Polls /notifications/unread_count/ every
// 60 s and renders a red badge when there are pending notifications.
//
// Usage - drop inside your Sidebar nav list:
//   import { NotificationBell } from "./NotificationBell";
//   <NotificationBell />

import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "../../api/endpoints/resources";

export function NotificationBell() {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith("/notifications");

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => getUnreadCount().then((r) => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const count = data?.unread_count ?? 0;

  return (
    <Link
      to="/notifications"
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
        transition-colors
        ${
          isActive
            ? "bg-primary-50 text-primary-700"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        }`}
    >
      {/* Bell icon + badge */}
      <span className="relative flex items-center justify-center w-5 h-5 shrink-0">
        <svg
          className={`w-5 h-5 transition-colors
            ${isActive ? "text-primary-600" : "text-gray-400 group-hover:text-gray-600"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
               6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6
               8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6
               0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center
            min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white
            text-[10px] font-bold leading-none"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>

      <span>Notifications</span>

      {/* Right-aligned pill (visible when sidebar is expanded) */}
      {count > 0 && (
        <span
          className="ml-auto flex items-center justify-center min-w-[20px] h-5
          px-1.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
