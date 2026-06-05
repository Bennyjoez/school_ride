import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { getNotifications } from "../../api/endpoints/resources";

// metadata keyed by event_type

const EVENT_META = {
  trip_started: {
    label:      "Trip started",
    iconBg:     "bg-green-100",
    iconColor:  "text-green-600",
    dot:        "bg-green-500",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0
             001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  trip_completed: {
    label:      "Trip completed",
    iconBg:     "bg-gray-100",
    iconColor:  "text-gray-500",
    dot:        "bg-gray-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  student_boarded: {
    label:      "Boarded",
    iconBg:     "bg-blue-100",
    iconColor:  "text-blue-600",
    dot:        "bg-blue-500",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  student_alighted: {
    label:      "Alighted",
    iconBg:     "bg-orange-100",
    iconColor:  "text-orange-500",
    dot:        "bg-orange-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3
             0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
  eta_update: {
    label:      "ETA update",
    iconBg:     "bg-yellow-100",
    iconColor:  "text-yellow-600",
    dot:        "bg-yellow-400",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

// Delivery status pill shown on each row
const STATUS_META = {
  pending:  { label: "Pending",   color: "text-yellow-600 bg-yellow-50 border-yellow-100" },
  sent:     { label: "Delivered", color: "text-green-600  bg-green-50  border-green-100"  },
  failed:   { label: "Failed",    color: "text-red-600    bg-red-50    border-red-100"     },
};

// Channel icon shown alongside the status pill
const CHANNEL_ICON = {
  push: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
           6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6
           11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0
           01-6 0v-1m6 0H9" />
    </svg>
  ),
  sms: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2
           0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
    </svg>
  ),
  email: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2
           2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
};

// filter definitions

const FILTERS = [
  { label: "All",          params: {} },
  { label: "Trip alerts",  params: { event_type: "trip_started" } },
  { label: "Boarded",      params: { event_type: "student_boarded" } },
  { label: "Alighted",     params: { event_type: "student_alighted" } },
  { label: "ETA updates",  params: { event_type: "eta_update" } },
  { label: "Failed",       params: { status: "failed" } },
];

// helpers

function groupByDay(items) {
  const groups = {};
  items.forEach((n) => {
    const d   = new Date(n.created_at);
    const key = isToday(d)
      ? "Today"
      : isYesterday(d)
      ? "Yesterday"
      : format(d, "EEEE, d MMM yyyy");
    (groups[key] ??= []).push(n);
  });
  return groups;
}

// single row

function NotificationRow({ n }) {
  const meta   = EVENT_META[n.event_type]  ?? EVENT_META.trip_started;
  const status = STATUS_META[n.status]     ?? STATUS_META.pending;
  const isPending = n.status === "pending";

  const inner = (
    <div className={`flex items-start gap-4 px-5 py-4 transition-colors
      hover:bg-gray-50 ${isPending ? "bg-blue-50/30" : ""}`}>

      {/* Event icon */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center
        ${meta.iconBg} ${meta.iconColor}`}>
        {meta.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          {/* Event label + channel */}
          <span className={`flex items-center gap-1 text-[10px] font-semibold
            uppercase tracking-wide ${meta.iconColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
            {CHANNEL_ICON[n.channel] && (
              <span className="ml-1 opacity-60">{CHANNEL_ICON[n.channel]}</span>
            )}
          </span>
          {/* Timestamp */}
          <span className="text-xs text-gray-400 shrink-0">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </span>
        </div>

        {/* Message body */}
        <p className={`text-sm mt-1 leading-snug
          ${isPending ? "font-medium text-gray-900" : "text-gray-600"}`}>
          {n.message}
        </p>

        {/* Footer: delivery status + delivered_at */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full
            text-[10px] font-medium border ${status.color}`}>
            {status.label}
          </span>
          {n.delivered_at && (
            <span className="text-[10px] text-gray-400">
              at {format(new Date(n.delivered_at), "HH:mm")}
            </span>
          )}
          {n.status === "failed" && n.error_message && (
            <span className="text-[10px] text-red-400 truncate max-w-[200px]"
              title={n.error_message}>
              {n.error_message}
            </span>
          )}
        </div>
      </div>

      {/* Unread dot */}
      {isPending && (
        <span className="shrink-0 mt-2 w-2 h-2 rounded-full bg-blue-500" />
      )}
    </div>
  );

  // Link to the related trip if one exists
  return n.trip ? (
    <Link to={`/trips/${n.trip}`} className="block">{inner}</Link>
  ) : inner;
}

// skeleton

function Skeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4">
          <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3 bg-gray-100 animate-pulse rounded w-1/3" />
            <div className="h-4 bg-gray-100 animate-pulse rounded w-4/5" />
            <div className="h-3 bg-gray-100 animate-pulse rounded w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// main page

export default function NotificationsPage() {
  const [filterIdx, setFilterIdx] = useState(0);
  const activeFilter = FILTERS[filterIdx];

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", filterIdx],
    queryFn: () => getNotifications(activeFilter.params).then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const pendingCount = notifications.filter((n) => n.status === "pending").length;
  const groups = groupByDay(notifications);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">
              {pendingCount} undelivered
            </p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(({ label }, i) => (
          <button
            key={label}
            onClick={() => setFilterIdx(i)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
              transition-colors border
              ${filterIdx === i
                ? "bg-primary-600 border-primary-600 text-white"
                : "border-gray-200 text-gray-500 hover:border-gray-300 bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center
              justify-center mb-4 text-gray-300">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
                     6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6
                     8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6
                     0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">No notifications</p>
            <p className="text-xs text-gray-400 mt-1">
              {activeFilter.params.status === "failed"
                ? "No failed deliveries — great!"
                : "Nothing here yet."}
            </p>
          </div>
        ) : (
          Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <div className="px-5 py-2 bg-gray-50 border-y border-gray-100
                text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {day}
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((n) => (
                  <NotificationRow key={n.id} n={n} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {notifications.length >= 100 && (
        <p className="text-center text-xs text-gray-400">
          Showing the 100 most recent notifications.
        </p>
      )}
    </div>
  );
}