// src/pages/trips/TripDetailPage.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { format, formatDistanceToNow } from "date-fns";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { selectCurrentUser } from "../../store/authSlice";
import { useWebSocket } from "../../hooks/useWebSocket";
import {
  getTrip,
  startTrip,
  endTrip,
  checkinEvent,
  postPing,
  getTripPings,
} from "../../api/endpoints/resources";
import { Button, Spinner, Badge, ErrorMessage } from "../../components/ui";
import { TRIP_STATUS_CONFIG } from "../../hooks/constants";

//  constants
const EVENT_LABEL = { board: "Boarded", alight: "Alighted" };
const EVENT_COLOR = { board: "green", alight: "orange" };

// Leaflet helpers

function makeBusIcon(heading = 0) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="17" fill="rgba(22,163,74,0.30)" />
      <circle cx="18" cy="18" r="13" fill="#16a34a" />
      <g transform="rotate(${heading}, 18, 18)">
        <polygon points="18,6 22,16 18,13 14,16" fill="white" opacity="0.9"/>
      </g>
      <rect x="12" y="14" width="12" height="9" rx="2" fill="white" opacity="0.20"/>
      <rect x="13.5" y="15.5" width="3" height="2.5" rx="0.5" fill="white" opacity="0.7"/>
      <rect x="19.5" y="15.5" width="3" height="2.5" rx="0.5" fill="white" opacity="0.7"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function makeStopIcon(isHighlighted = false) {
  const fill = isHighlighted ? "#6366f1" : "#a5b4fc";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="white" stroke="${fill}" stroke-width="2"/>
      <circle cx="10" cy="10" r="4" fill="${fill}"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
}

// Mini map

function TripMiniMap({ trip, livePosition }) {
  const mapRef = useRef(null);
  const leaflet = useRef(null);
  const busRef = useRef(null);
  const trailRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (leaflet.current || !mapRef.current) return;
    const center = [-1.2921, 36.8219]; // Nairobi CBD default // TODO: could center on the location of the device running the frontend, if permission is granted
    leaflet.current = L.map(mapRef.current, {
      center,
      zoom: 13,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(leaflet.current);

    // Draw route stops
    const stops = trip?.stops ?? [];
    stops.forEach((stop) => {
      L.marker([Number(stop.latitude), Number(stop.longitude)], {
        icon: makeStopIcon(),
      })
        .bindPopup(`<b>${stop.name}</b><br/>Stop ${stop.sequence}`)
        .addTo(leaflet.current);
    });

    // Fit to stops if any
    if (stops.length > 1) {
      const bounds = stops.map((s) => [
        Number(s.latitude),
        Number(s.longitude),
      ]);
      leaflet.current.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      leaflet.current?.remove();
      leaflet.current = null;
    };
  }, [trip?.stops]);

  // Update bus marker on live position changes
  useEffect(() => {
    const map = leaflet.current;
    if (!map || !livePosition) return;
    const { latitude, longitude, heading } = livePosition;
    const latlng = [Number(latitude), Number(longitude)];

    if (busRef.current) {
      busRef.current.setLatLng(latlng).setIcon(makeBusIcon(heading ?? 0));
      const latlngs = trailRef.current.getLatLngs();
      latlngs.push(latlng);
      trailRef.current.setLatLngs(latlngs);
    } else {
      busRef.current = L.marker(latlng, { icon: makeBusIcon(heading ?? 0) })
        .bindPopup("Bus location")
        .addTo(map);
      trailRef.current = L.polyline([latlng], {
        color: "#16a34a",
        weight: 3,
        opacity: 0.6,
        dashArray: "6 4",
      }).addTo(map);
      map.setView(latlng, 14);
    }
  }, [livePosition]);

  return (
    <div
      className="rounded-xl overflow-hidden border border-gray-100 shadow-sm"
      style={{ height: 280 }}
    >
      <div ref={mapRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}

// GPS status bar (Driver only)

function GpsStatusBar({ pingCount, lastPing, isSending }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 rounded-lg border border-gray-100 text-sm">
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${isSending ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
        />
        <span
          className={isSending ? "text-green-700 font-medium" : "text-gray-400"}
        >
          {isSending ? "GPS Active" : "GPS Inactive"}
        </span>
      </span>
      {lastPing && (
        <>
          <span className="text-gray-300">|</span>
          <span className="text-gray-500">
            {Number(lastPing.latitude).toFixed(5)},{" "}
            {Number(lastPing.longitude).toFixed(5)}
          </span>
          {lastPing.accuracy && (
            <span className="text-gray-400">
              ±{Math.round(lastPing.accuracy)}m
            </span>
          )}
        </>
      )}
      <span className="text-gray-300">|</span>
      <span className="text-gray-500">
        {pingCount} ping{pingCount !== 1 ? "s" : ""} sent
      </span>
    </div>
  );
}

// Check-in form

function CheckInForm({ trip, onSuccess }) {
  const queryClient = useQueryClient();
  const [studentCode, setStudentCode] = useState("");
  const [stopId, setStopId] = useState("");
  const [eventType, setEventType] = useState("board");
  const [apiError, setApiError] = useState(null);

  const stops = trip?.stops ?? [];

  const mutation = useMutation({
    mutationFn: (data) => checkinEvent(trip.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", String(trip.id)] });
      setStudentCode("");
      setStopId("");
      setEventType("board");
      setApiError(null);
      onSuccess?.();
    },
    onError: (err) => setApiError(err),
  });

  const handleSubmit = () => {
    if (!studentCode || !stopId) return;
    setApiError(null);
    mutation.mutate({
      student_code: studentCode,
      stop: stopId,
      event_type: eventType,
    });
  };

  return (
    <div className="space-y-3">
      {apiError && <ErrorMessage error={apiError} />}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Student Code
          </label>
          <input
            type="text"
            placeholder="e.g. A1B2C3"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Stop
          </label>
          <select
            value={stopId}
            onChange={(e) => setStopId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
          >
            <option value="">Select stop…</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sequence}. {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Event
          </label>
          <div className="flex gap-2">
            {["board", "alight"].map((type) => (
              <button
                key={type}
                onClick={() => setEventType(type)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
                  ${
                    eventType === type
                      ? type === "board"
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-orange-50 border-orange-300 text-orange-700"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
              >
                {EVENT_LABEL[type]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!studentCode || !stopId || mutation.isPending}
          size="sm"
        >
          {mutation.isPending ? <Spinner size="sm" /> : "Record Event"}
        </Button>
      </div>
    </div>
  );
}

//  Main page

export default function TripDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const currentUser = useSelector(selectCurrentUser);

  const [livePosition, setLivePosition] = useState(null);
  const [stopEtas, setStopEtas] = useState({});
  const [pingCount, setPingCount] = useState(0);
  const [lastGps, setLastGps] = useState(null);
  const [checkinSuccess, setCheckinSuccess] = useState(false);

  //  GPS ping loop refs (Driver only)
  const watchIdRef = useRef(null);
  const pingTimerRef = useRef(null);
  const pendingPos = useRef(null);

  //  Data fetching
  const {
    data: trip,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id).then((r) => r.data),
    refetchInterval: (query) =>
      query?.state?.data?.status === "active" ? 15_000 : false,
  });

  const { data: pings = [] } = useQuery({
    queryKey: ["trip-pings", id],
    queryFn: () => getTripPings(id).then((r) => r.data),
    enabled: !!trip,
    refetchInterval: (query) =>
      query?.state?.data?.status === "active" ? 10_000 : false,
  });

  //  Start / End mutations
  const startMutation = useMutation({
    mutationFn: () => startTrip(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", id] }),
  });

  const endMutation = useMutation({
    mutationFn: () => endTrip(id),
    onSuccess: () => {
      stopGpsPingLoop();
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
      queryClient.invalidateQueries({ queryKey: ["trip-pings", id] });
    },
  });

  //  WebSocket (live GPS) ─
  const isActive = trip?.status === "active";

  useWebSocket(isActive ? id : null, {
    onGpsPing: useCallback((data) => {
      setLivePosition(data);
    }, []),
    onEtaUpdate: useCallback((data) => {
      setStopEtas(data.stop_etas ?? {});
    }, []),
  });

  //  Driver GPS ping loop ─
  const isDriver = currentUser?.user_type === "5";

  const stopGpsPingLoop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const sendPing = useCallback(async () => {
    if (!pendingPos.current) return;
    const { latitude, longitude, speed, heading, accuracy } =
      pendingPos.current;
    try {
      await postPing(id, {
        latitude,
        longitude,
        speed_kmh: speed != null ? speed * 3.6 : 0, // m/s → km/h
        heading: heading ?? 0,
        recorded_at: new Date().toISOString(),
      });
      setPingCount((c) => c + 1);
      setLastGps({ latitude, longitude, accuracy });
    } catch {
      // Silently fail — WS broadcast still works even if HTTP ping fails
    }
  }, [id]);

  useEffect(() => {
    if (!isDriver || !isActive) {
      stopGpsPingLoop();
      return;
    }
    if (!navigator.geolocation) return;

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        pendingPos.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          accuracy: pos.coords.accuracy,
        };
      },
      (err) => console.warn("[GPS]", err.message),
      { enableHighAccuracy: true, maximumAge: 3000 },
    );

    // Send pings every 5 seconds
    pingTimerRef.current = setInterval(sendPing, 5000);

    return stopGpsPingLoop;
  }, [isDriver, isActive, sendPing, stopGpsPingLoop]);

  //  Render ─
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );

  if (isError || !trip)
    return (
      <div className="p-6">
        <ErrorMessage error="Could not load trip details." />
      </div>
    );

  const checkinEvents = trip.checkin_events ?? [];
  const stops = trip.stops ?? [];
  const cfg = TRIP_STATUS_CONFIG[trip.status] ?? TRIP_STATUS_CONFIG.scheduled;
  const lastPing = pings.length > 0 ? pings[pings.length - 1] : null;

  const canStart =
    ["1", "2", "3", "5"].includes(currentUser?.user_type) &&
    trip.status === "scheduled";
  const canEnd =
    ["1", "2", "3", "5"].includes(currentUser?.user_type) &&
    trip.status === "active";
  const canCheckin =
    ["4", "5"].includes(currentUser?.user_type) && trip.status === "active"; // only the teacher and the driver can record check-in events

  const handleCheckinSuccess = () => {
    setCheckinSuccess(true);
    setTimeout(() => setCheckinSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/*  Header  */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link to="/trips" className="hover:text-gray-600 transition-colors">
              Trips
            </Link>
            <span>/</span>
            <span className="text-gray-600">Trip #{trip.id}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {trip.route_name}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {format(new Date(trip.trip_date), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Badge variant={cfg.color} size="lg">
          {cfg.label}
        </Badge>
      </div>

      {/*  Trip meta cards  */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Vehicle", value: trip.vehicle_plate ?? "—" },
          { label: "Driver", value: trip.driver_name ?? "—" },
          {
            label: "Departed",
            value: trip.actual_start
              ? format(new Date(trip.actual_start), "HH:mm")
              : "—",
          },
          {
            label: "Arrived",
            value: trip.actual_end
              ? format(new Date(trip.actual_end), "HH:mm")
              : "—",
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3"
          >
            <p className="text-xs font-medium text-gray-400 mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/*  Trip controls  */}
      {(canStart || canEnd) && (
        <div className="flex flex-wrap gap-3 items-center">
          {canStart && (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              variant="primary"
            >
              {startMutation.isPending ? <Spinner size="sm" /> : null}
              Start Trip
            </Button>
          )}
          {canEnd && (
            <Button
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
              variant="danger"
            >
              {endMutation.isPending ? <Spinner size="sm" /> : null}
              End Trip
            </Button>
          )}
          {(startMutation.isError || endMutation.isError) && (
            <ErrorMessage
              error={startMutation.error ?? endMutation.error}
              inline
            />
          )}
        </div>
      )}

      {/*  Driver GPS status  */}
      {isDriver && isActive && (
        <GpsStatusBar
          pingCount={pingCount}
          lastPing={lastGps}
          // eslint-disable-next-line react-hooks/refs
          isSending={!!watchIdRef.current}
        />
      )}

      {/*  Two-column layout: map + ping history  */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Live mini-map — 3/5 */}
        <div className="lg:col-span-3 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            Live Position
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-normal">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </h2>
          <TripMiniMap trip={trip} livePosition={livePosition} />

          {/* ETA overlay under map */}
          {Object.keys(stopEtas).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {stops.map((stop) => {
                const eta = stopEtas[stop.id];
                return eta != null ? (
                  <span
                    key={stop.id}
                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full px-3 py-1"
                  >
                    {stop.name} · {eta} min
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>

        {/* Ping history — 2/5 */}
        <div className="lg:col-span-2 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">
            GPS Pings
            <span className="ml-2 text-xs font-normal text-gray-400">
              {pings.length} recorded
            </span>
          </h2>

          {pings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[calc(280px-24px)] bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-300 text-sm">
              No pings yet
            </div>
          ) : (
            <div
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
              style={{ maxHeight: 280 }}
            >
              <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-medium">
                        Time
                      </th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">
                        km/h
                      </th>
                      <th className="text-right px-3 py-2 text-gray-500 font-medium">
                        Heading
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...pings].reverse().map((ping) => (
                      <tr
                        key={ping.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-3 py-2 text-gray-500 font-mono">
                          {format(new Date(ping.recorded_at), "HH:mm:ss")}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-700 font-semibold">
                          {Number(ping.speed_kmh).toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-400">
                          {Number(ping.heading).toFixed(0)}°
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {lastPing && (
            <p className="text-xs text-gray-400">
              Last ping{" "}
              {formatDistanceToNow(new Date(lastPing.recorded_at), {
                addSuffix: true,
              })}
            </p>
          )}
        </div>
      </div>

      {/*  Check-in form (Teacher / Driver)  */}
      {canCheckin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Record Check-in
            </h2>
            {checkinSuccess && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Event recorded
              </span>
            )}
          </div>
          <CheckInForm trip={trip} onSuccess={handleCheckinSuccess} />
        </div>
      )}

      {/*  Check-in event log  */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Check-in Log</h2>
          <span className="text-xs text-gray-400">
            {checkinEvents.length} events
          </span>
        </div>

        {checkinEvents.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-300">
            No check-in events recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Student", "Stop", "Event", "Time", "Recorded by"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-medium text-gray-500"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {checkinEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-900">
                      {evt.student_name}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {evt.stop_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={EVENT_COLOR[evt.event_type]} size="sm">
                        {EVENT_LABEL[evt.event_type]}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">
                      {format(new Date(evt.occurred_at), "HH:mm:ss")}
                    </td>
                    <td className="px-5 py-3 text-gray-400">
                      {evt.recorded_by_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/*  Guardian live map link  */}
      {isActive && (
        <div className="flex justify-end">
          <Link
            to={`/trips/${id}/map`}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700
              font-medium transition-colors"
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
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            Open full live map
          </Link>
        </div>
      )}
    </div>
  );
}
