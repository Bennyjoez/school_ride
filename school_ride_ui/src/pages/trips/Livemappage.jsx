// src/pages/trips/LiveMapPage.jsx
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { useWebSocket } from "../../hooks/useWebSocket";
import { getTrip } from "../../api/endpoints/resources";

// constants

const STATUS_CONFIG = {
  scheduled: {
    label: "Scheduled",
    dot: "bg-blue-400",
    text: "text-blue-600",
    bg: "bg-blue-50",
  },
  active: {
    label: "Active",
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50",
  },
  completed: {
    label: "Completed",
    dot: "bg-gray-400",
    text: "text-gray-600",
    bg: "bg-gray-50",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-red-400",
    text: "text-red-600",
    bg: "bg-red-50",
  },
};

const CHECKIN_STATUS = {
  boarded: {
    label: "On board",
    icon: "✓",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-100",
  },
  alighted: {
    label: "Alighted",
    icon: "↓",
    color: "text-orange-500",
    bg: "bg-orange-50",
    border: "border-orange-100",
  },
  pending: {
    label: "Not yet on",
    icon: "·",
    color: "text-gray-400",
    bg: "bg-gray-50",
    border: "border-gray-100",
  },
};

// Leaflet icon factories

function makeBusIcon(heading = 0, speed = 0) {
  const isMoving = speed > 2;
  const pulseColor = isMoving ? "rgba(22,163,74,0.25)" : "rgba(22,163,74,0.12)";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="23" fill="${pulseColor}" />
      <circle cx="24" cy="24" r="17" fill="#16a34a" />
      <circle cx="24" cy="24" r="17" fill="none" stroke="white" stroke-width="1.5" stroke-opacity="0.3"/>
      <g transform="rotate(${heading}, 24, 24)">
        <polygon points="24,8 29,20 24,17 19,20" fill="white" opacity="0.95"/>
      </g>
      <rect x="16" y="19" width="16" height="12" rx="2.5" fill="white" opacity="0.18"/>
      <rect x="17.5" y="20.5" width="4" height="3.5" rx="0.8" fill="white" opacity="0.75"/>
      <rect x="26.5" y="20.5" width="4" height="3.5" rx="0.8" fill="white" opacity="0.75"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
}

function makeStopIcon(isNext = false) {
  const border = isNext ? "#6366f1" : "#a5b4fc";
  const fill = isNext ? "#6366f1" : "white";
  const dot = isNext ? "white" : "#a5b4fc";
  const size = isNext ? 26 : 20;
  const cx = size / 2;
  const r = cx - 1.5;
  const dr = isNext ? 5 : 4;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="${fill}" stroke="${border}" stroke-width="2"/>
      <circle cx="${cx}" cy="${cx}" r="${dr}" fill="${dot}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [size, size],
    iconAnchor: [cx, cx],
    popupAnchor: [0, -14],
  });
}

// derive student statuses from checkin_events

function deriveStudentStatuses(trip) {
  // Map studentId → latest event type
  const latest = {};
  const events = [...(trip?.checkin_events ?? [])].sort(
    (a, b) => new Date(a.occurred_at) - new Date(b.occurred_at),
  );
  events.forEach((evt) => {
    latest[evt.student] = evt.event_type; // 'board' | 'alight'
  });

  // Build list from trip students (if available) or from events only
  const studentMap = {};
  events.forEach((evt) => {
    if (!studentMap[evt.student]) {
      studentMap[evt.student] = {
        id: evt.student,
        name: evt.student_name ?? `Student #${evt.student}`,
      };
    }
  });

  return Object.values(studentMap).map((s) => ({
    ...s,
    status:
      latest[s.id] === "board"
        ? "boarded"
        : latest[s.id] === "alight"
          ? "alighted"
          : "pending",
    lastEvent: events.filter((e) => e.student === s.id).at(-1),
  }));
}

// ETA countdown

function EtaCountdown({ minutes }) {
  const [display, setDisplay] = useState(minutes);
  useEffect(() => {
    if (minutes <= 0) return;
    const start = Date.now();
    const baseline = minutes;
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 60000; // ms → min
      const remaining = Math.max(0, baseline - elapsed);
      setDisplay(remaining.toFixed(1));
    }, 10000); // update every 10s
    return () => clearInterval(interval);
  }, [minutes]);

  const mins = parseFloat(display);
  const color =
    mins <= 2
      ? "text-red-600"
      : mins <= 5
        ? "text-orange-500"
        : "text-indigo-600";
  return (
    <span className={`font-semibold tabular-nums ${color}`}>
      {mins <= 0 ? "Now" : `${parseFloat(display).toFixed(1)} min`}
    </span>
  );
}

// Main component

export default function LiveMapPage() {
  const { id } = useParams();

  // Map refs
  const mapDivRef = useRef(null);
  const leafletRef = useRef(null);
  const busMarkerRef = useRef(null);
  const trailRef = useRef(null);
  const stopLayerRef = useRef(null); // L.LayerGroup for stops

  // State
  const [livePos, setLivePos] = useState(null);
  const [stopEtas, setStopEtas] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("students"); // "students" | "stops"

  // Fetch trip
  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id).then((r) => r.data),
    refetchInterval: 20_000,
  });

  const stops = useMemo(() => trip?.stops ?? [], [trip?.stops]);
  const isActive = trip?.status === "active";
  const cfg = STATUS_CONFIG[trip?.status] ?? STATUS_CONFIG.scheduled;
  const students = deriveStudentStatuses(trip);

  const boardedCount = students.filter((s) => s.status === "boarded").length;
  const alightedCount = students.filter((s) => s.status === "alighted").length;
  const pendingCount = students.filter((s) => s.status === "pending").length;

  //  WebSocket
  useWebSocket(isActive ? id : null, {
    onGpsPing: useCallback((data) => setLivePos(data), []),
    onEtaUpdate: useCallback((data) => setStopEtas(data.stop_etas ?? {}), []),
    onOpen: useCallback(() => setWsConnected(true), []),
    onClose: useCallback(() => setWsConnected(false), []),
  });

  // Init Leaflet
  useEffect(() => {
    if (leafletRef.current || !mapDivRef.current) return;

    leafletRef.current = L.map(mapDivRef.current, {
      center: [-1.2921, 36.8219],
      zoom: 13,
      zoomControl: false,
    });

    // Custom zoom position (top-right to avoid panel overlap)
    L.control.zoom({ position: "topright" }).addTo(leafletRef.current);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leafletRef.current);

    stopLayerRef.current = L.layerGroup().addTo(leafletRef.current);

    return () => {
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, []);

  // Draw stops
  useEffect(() => {
    const map = leafletRef.current;
    const layer = stopLayerRef.current;
    if (!map || !layer || !stops.length) return;

    layer.clearLayers();

    const bounds = [];
    stops.forEach((stop) => {
      const isNext = false; // Could compute from ETAs later
      const eta = stopEtas[stop.id];
      const icon = makeStopIcon(isNext);
      const latlng = [Number(stop.latitude), Number(stop.longitude)];
      bounds.push(latlng);

      const etaHtml =
        eta != null
          ? `<span style="color:#6366f1;font-weight:600">${Number(eta).toFixed(1)} min</span>`
          : "-";

      L.marker(latlng, { icon })
        .bindPopup(
          `
          <div style="font-family:sans-serif;min-width:140px">
            <p style="font-weight:600;margin:0 0 3px;font-size:13px">${stop.name}</p>
            <p style="color:#6b7280;font-size:11px;margin:0">Stop ${stop.sequence}</p>
            <p style="color:#6b7280;font-size:11px;margin:4px 0 0">ETA: ${etaHtml}</p>
          </div>`,
        )
        .addTo(layer);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [60, 60] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [stops, stopEtas]);

  // Update bus marker on GPS ping
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !livePos) return;

    const { latitude, longitude, heading, speed_kmh } = livePos;
    const latlng = [Number(latitude), Number(longitude)];
    const icon = makeBusIcon(heading ?? 0, speed_kmh ?? 0);

    if (busMarkerRef.current) {
      busMarkerRef.current.setLatLng(latlng).setIcon(icon);
      const trail = trailRef.current;
      if (trail) {
        const pts = trail.getLatLngs();
        pts.push(latlng);
        trail.setLatLngs(pts);
      }
    } else {
      busMarkerRef.current = L.marker(latlng, { icon })
        .bindPopup(
          `
          <div style="font-family:sans-serif">
            <p style="font-weight:600;margin:0 0 3px">${trip?.route_name ?? "Bus"}</p>
            <p style="font-size:12px;color:#6b7280;margin:0">
              ${Number(speed_kmh ?? 0).toFixed(1)} km/h · ${Number(heading ?? 0).toFixed(0)}°
            </p>
          </div>`,
        )
        .addTo(map);

      trailRef.current = L.polyline([latlng], {
        color: "#16a34a",
        weight: 4,
        opacity: 0.55,
        dashArray: "8 5",
      }).addTo(map);

      map.setView(latlng, 15);
    }
  }, [livePos, trip?.route_name]);

  // Render

  return (
    <div
      className="fixed inset-0 flex flex-col bg-gray-900"
      style={{ zIndex: 50 }}
    >
      {/* ── Top bar ── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between
        px-4 py-3 bg-white/90 backdrop-blur border-b border-gray-100 shadow-sm"
      >
        {/* Back + title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/trips/${id}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg
              bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700
              transition-colors shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          {isLoading ? (
            <div className="h-4 w-40 bg-gray-100 animate-pulse rounded" />
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {trip?.route_name ?? `Trip #${id}`}
              </p>
              <p className="text-xs text-gray-400">
                {trip?.trip_date
                  ? format(new Date(trip.trip_date), "EEE d MMM")
                  : ""}
                {trip?.vehicle_plate ? ` · ${trip.vehicle_plate}` : ""}
                {trip?.driver_name ? ` · ${trip.driver_name}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Status + WS indicator */}
        <div className="flex items-center gap-3 shrink-0">
          {trip && (
            <span
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium
              ${cfg.bg} ${cfg.text}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${isActive ? "animate-pulse" : ""}`}
              />
              {cfg.label}
            </span>
          )}

          {/* WS connection dot */}
          <span
            title={wsConnected ? "Live connection" : "Connecting…"}
            className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500" : "bg-gray-300"}`}
          />

          {/* Toggle side panel */}
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg
              border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            {panelOpen ? (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 5l7 7-7 7M5 5l7 7-7 7"
                  />
                </svg>
                Hide panel
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 19l-7-7 7-7M19 19l-7-7 7-7"
                  />
                </svg>
                Show panel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main body: map + side panel ── */}
      <div className="flex flex-1 overflow-hidden pt-[57px]">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapDivRef} className="w-full h-full" />

          {/* Speed / heading HUD */}
          {livePos && (
            <div
              className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10
              flex items-center gap-4 px-5 py-2.5
              bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-gray-100 text-sm"
            >
              <span className="flex flex-col items-center">
                <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                  {Number(livePos.speed_kmh ?? 0).toFixed(0)}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                  km/h
                </span>
              </span>
              <span className="w-px h-8 bg-gray-200" />
              <span className="flex flex-col items-center">
                <span className="text-lg font-bold text-gray-900 tabular-nums leading-none">
                  {Number(livePos.heading ?? 0).toFixed(0)}°
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">
                  heading
                </span>
              </span>
              <span className="w-px h-8 bg-gray-200" />
              <span className="flex flex-col items-center">
                <span className="text-xs text-gray-500 font-mono tabular-nums leading-none">
                  {Number(livePos.latitude).toFixed(4)},
                </span>
                <span className="text-xs text-gray-500 font-mono tabular-nums leading-none">
                  {Number(livePos.longitude).toFixed(4)}
                </span>
              </span>
              <span className="w-px h-8 bg-gray-200" />
              <span className="text-[10px] text-gray-400 leading-tight max-w-[80px] text-center">
                {livePos.recorded_at
                  ? formatDistanceToNow(new Date(livePos.recorded_at), {
                      addSuffix: true,
                    })
                  : "-"}
              </span>
            </div>
          )}

          {/* No active trip notice */}
          {!isLoading && trip && !isActive && (
            <div className="absolute inset-0 flex items-end justify-center pb-24 pointer-events-none z-10">
              <div
                className="bg-white/95 backdrop-blur rounded-2xl px-6 py-4 shadow-lg
                border border-gray-100 text-center max-w-xs"
              >
                <p className="text-sm font-semibold text-gray-700">
                  Trip is not active
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Live tracking is only available while the trip is in progress.
                  Current status:{" "}
                  <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div
            className="hidden sm:flex flex-col w-80 bg-white border-l border-gray-100
            overflow-hidden shadow-xl"
          >
            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0">
              {[
                { key: "students", label: "Students" },
                { key: "stops", label: `Stops (${stops.length})` },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2
                    ${
                      activeTab === key
                        ? "border-primary-500 text-primary-600"
                        : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Students tab */}
            {activeTab === "students" && (
              <div className="flex flex-col flex-1 overflow-hidden">
                {/* Summary strip */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 shrink-0">
                  {[
                    {
                      label: "On board",
                      count: boardedCount,
                      color: "text-green-600",
                    },
                    {
                      label: "Alighted",
                      count: alightedCount,
                      color: "text-orange-500",
                    },
                    {
                      label: "Pending",
                      count: pendingCount,
                      color: "text-gray-400",
                    },
                  ].map(({ label, count, color }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center py-3"
                    >
                      <span
                        className={`text-xl font-bold tabular-nums ${color}`}
                      >
                        {count}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Student list */}
                <div className="flex-1 overflow-y-auto">
                  {students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-300 text-sm">
                      No check-in events yet
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50">
                      {students.map((s) => {
                        const st = CHECKIN_STATUS[s.status];
                        return (
                          <li
                            key={s.id}
                            className={`flex items-center gap-3 px-4 py-3 ${st.bg} transition-colors`}
                          >
                            {/* Avatar */}
                            <div
                              className="w-8 h-8 rounded-full bg-white border border-gray-100
                              flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0"
                            >
                              {s.name
                                ?.split(" ")
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {s.name}
                              </p>
                              {s.lastEvent && (
                                <p className="text-xs text-gray-400 truncate">
                                  {s.lastEvent.stop_name ?? "Unknown stop"} ·{" "}
                                  {format(
                                    new Date(s.lastEvent.occurred_at),
                                    "HH:mm",
                                  )}
                                </p>
                              )}
                            </div>
                            <span
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5
                              rounded-full border ${st.color} ${st.border} bg-white shrink-0`}
                            >
                              <span>{st.icon}</span>
                              {st.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Stops tab */}
            {activeTab === "stops" && (
              <div className="flex-1 overflow-y-auto">
                {stops.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-300 text-sm">
                    No stops on this route
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {stops.map((stop) => {
                      const eta = stopEtas[stop.id];
                      return (
                        <li
                          key={stop.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          {/* Sequence bubble */}
                          <div
                            className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100
                            flex items-center justify-center text-xs font-bold text-indigo-500 shrink-0"
                          >
                            {stop.sequence}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {stop.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {Number(stop.latitude).toFixed(4)},{" "}
                              {Number(stop.longitude).toFixed(4)}
                            </p>
                          </div>
                          {eta != null ? (
                            <EtaCountdown minutes={Number(eta)} />
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Last updated footer */}
            <div
              className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 shrink-0
              flex items-center justify-between"
            >
              <span>
                {livePos
                  ? `Updated ${formatDistanceToNow(new Date(livePos.recorded_at), { addSuffix: true })}`
                  : "Waiting for GPS…"}
              </span>
              {wsConnected && (
                <span className="flex items-center gap-1 text-green-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom drawer */}
      <div className="sm:hidden shrink-0 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-8 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { key: "students", label: "Students" },
            { key: "stops", label: `Stops (${stops.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${
                  activeTab === key
                    ? "border-primary-500 text-primary-600"
                    : "border-transparent text-gray-400"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Summary strip (students) */}
        {activeTab === "students" && (
          <div className="grid grid-cols-3 divide-x divide-gray-100 py-2">
            {[
              {
                label: "On board",
                count: boardedCount,
                color: "text-green-600",
              },
              {
                label: "Alighted",
                count: alightedCount,
                color: "text-orange-500",
              },
              { label: "Pending", count: pendingCount, color: "text-gray-400" },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex flex-col items-center">
                <span className={`text-lg font-bold tabular-nums ${color}`}>
                  {count}
                </span>
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Scrollable list */}
        <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
          {activeTab === "students" ? (
            students.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-300">
                No check-in events yet
              </p>
            ) : (
              <ul className="divide-y divide-gray-50 pb-2">
                {students.map((s) => {
                  const st = CHECKIN_STATUS[s.status];
                  return (
                    <li
                      key={s.id}
                      className={`flex items-center gap-3 px-4 py-2.5 ${st.bg}`}
                    >
                      <div
                        className="w-7 h-7 rounded-full bg-white border border-gray-100
                        flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0"
                      >
                        {s.name
                          ?.split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                        {s.name}
                      </span>
                      <span className={`text-xs font-medium ${st.color}`}>
                        {st.icon} {st.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : stops.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-300">No stops</p>
          ) : (
            <ul className="divide-y divide-gray-50 pb-2">
              {stops.map((stop) => {
                const eta = stopEtas[stop.id];
                return (
                  <li
                    key={stop.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <span
                      className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100
                        flex items-center justify-center text-xs font-bold text-indigo-500 shrink-0"
                    >
                      {stop.sequence}
                    </span>
                    <span className="flex-1 text-sm text-gray-800 truncate">
                      {stop.name}
                    </span>
                    {eta != null ? (
                      <EtaCountdown minutes={Number(eta)} />
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
