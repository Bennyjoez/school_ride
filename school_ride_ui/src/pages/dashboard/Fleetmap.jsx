// src/pages/dashboard/components/FleetMap.jsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSelector } from 'react-redux'
import { format } from 'date-fns'
import { selectAccessToken } from '../../store/authSlice'
import { getTrips } from '../../api/endpoints/resources'

// ─── SVG Bus icon factory ─────────────────────────────────────────────────────
// Returns a Leaflet DivIcon with an SVG bus marker rotated to the vehicle heading

function makeBusIcon(heading = 0, isActive = true) {
  const color  = isActive ? '#16a34a' : '#2563eb'
  const shadow = isActive ? 'rgba(22,163,74,0.35)' : 'rgba(37,99,235,0.25)'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="17" fill="${shadow}" />
      <circle cx="18" cy="18" r="13" fill="${color}" />
      <!-- Arrow indicating heading direction -->
      <g transform="rotate(${heading}, 18, 18)">
        <polygon points="18,6 22,16 18,13 14,16" fill="white" opacity="0.9"/>
      </g>
      <!-- Bus body -->
      <rect x="12" y="14" width="12" height="9" rx="2" fill="white" opacity="0.25"/>
      <!-- Windows -->
      <rect x="13.5" y="15.5" width="3" height="2.5" rx="0.5" fill="white" opacity="0.7"/>
      <rect x="19.5" y="15.5" width="3" height="2.5" rx="0.5" fill="white" opacity="0.7"/>
    </svg>
  `
  return {
    html: svg,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  }
}

function makeStopIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="9" fill="white" stroke="#6366f1" stroke-width="2"/>
      <circle cx="10" cy="10" r="4" fill="#6366f1"/>
    </svg>
  `
  return {
    html: svg,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  }
}

// ─── Leaflet map initialisation ───────────────────────────────────────────────

function initLeaflet(container, center) {
  // Dynamically access window.L — Leaflet loaded via CDN in index.html
  const L = window.L
  if (!L) return null

  const map = L.map(container, {
    center,
    zoom: 13,
    zoomControl: true,
    attributionControl: true,
  })

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)

  return map
}

// ─── Active trip WebSocket manager ────────────────────────────────────────────
// Opens one WS per active trip, feeds pings back via onPing callback

function useLiveFleet(activeTrips, accessToken, onPing) {
  const socketsRef = useRef({})

  useEffect(() => {
    if (!accessToken || !activeTrips?.length) return

    activeTrips.forEach(trip => {
      if (socketsRef.current[trip.id]) return // already connected

      const ws = new WebSocket(
        `ws://127.0.0.1:8000/ws/trips/${trip.id}/track/?token=${accessToken}`
      )

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'gps_ping') {
            onPing(trip.id, trip.route_name, msg.data)
          }
        } catch {}
      }

      socketsRef.current[trip.id] = ws
    })

    // Close sockets for trips no longer active
    const activeTripIds = new Set(activeTrips.map(t => t.id))
    Object.keys(socketsRef.current).forEach(id => {
      if (!activeTripIds.has(Number(id))) {
        socketsRef.current[id]?.close()
        delete socketsRef.current[id]
      }
    })

    return () => {
      // Cleanup on unmount
      Object.values(socketsRef.current).forEach(ws => ws?.close())
      socketsRef.current = {}
    }
  }, [activeTrips, accessToken])
}

// ─── Main FleetMap component ──────────────────────────────────────────────────

export function FleetMap({ height = '420px', defaultCenter = [-1.2921, 36.8219] }) {
  const accessToken = useSelector(selectAccessToken)
  const mapRef      = useRef(null)   // DOM node
  const leafletRef  = useRef(null)   // Leaflet map instance
  const markersRef  = useRef({})     // { tripId: { marker, polyline, stops[] } }

  // Vehicle positions keyed by tripId — updated by WS pings
  const [positions, setPositions] = useState({})
  // Selected trip id for info panel
  const [selected, setSelected]   = useState(null)

  // Fetch today's trips
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: trips } = useQuery({
    queryKey: ['trips', 'today-fleet'],
    queryFn: () => getTrips().then(r =>
      r.data.filter(t => t.trip_date === today)
    ),
    refetchInterval: 60_000,
  })

  const activeTrips    = trips?.filter(t => t.status === 'active')    ?? []
  const scheduledTrips = trips?.filter(t => t.status === 'scheduled') ?? []

  // Handle incoming GPS ping — update positions state
  const handlePing = useCallback((tripId, routeName, data) => {
    setPositions(prev => ({
      ...prev,
      [tripId]: {
        ...data,
        routeName,
        tripId,
        updatedAt: new Date(),
      },
    }))
  }, [])

  // Open WebSocket connections for all active trips
  useLiveFleet(activeTrips, accessToken, handlePing)

  // Initialise Leaflet map once
  useEffect(() => {
    if (leafletRef.current || !mapRef.current) return
    leafletRef.current = initLeaflet(mapRef.current, defaultCenter)
    return () => {
      leafletRef.current?.remove()
      leafletRef.current = null
    }
  }, [])

  // Update markers whenever positions change
  useEffect(() => {
    const L   = window.L
    const map = leafletRef.current
    if (!L || !map) return

    Object.entries(positions).forEach(([tripId, pos]) => {
      const latlng  = [Number(pos.latitude), Number(pos.longitude)]
      const isActive = activeTrips.some(t => String(t.id) === String(tripId))
      const iconDef  = makeBusIcon(pos.heading ?? 0, isActive)
      const icon     = L.divIcon(iconDef)

      if (markersRef.current[tripId]?.marker) {
        // Update existing marker position and icon
        markersRef.current[tripId].marker
          .setLatLng(latlng)
          .setIcon(icon)

        // Extend polyline (route trail)
        const poly = markersRef.current[tripId].polyline
        if (poly) {
          const latlngs = poly.getLatLngs()
          latlngs.push(latlng)
          poly.setLatLngs(latlngs)
        }
      } else {
        // Create new marker
        const marker = L.marker(latlng, { icon })
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:160px">
              <p style="font-weight:600;margin:0 0 4px">${pos.routeName}</p>
              <p style="color:#6b7280;font-size:12px;margin:0">
                ${Number(pos.speed_kmh ?? 0).toFixed(1)} km/h · ${Number(pos.heading ?? 0).toFixed(0)}°
              </p>
              <p style="color:#9ca3af;font-size:11px;margin:4px 0 0">
                ${pos.latitude}, ${pos.longitude}
              </p>
            </div>
          `)
          .on('click', () => setSelected(String(tripId)))
          .addTo(map)

        // Dashed trail polyline
        const polyline = L.polyline([latlng], {
          color:     isActive ? '#16a34a' : '#2563eb',
          weight:    3,
          opacity:   0.6,
          dashArray: '6 4',
        }).addTo(map)

        markersRef.current[tripId] = { marker, polyline }
      }
    })

    // Draw stop markers for trips whose routes have stops
    trips?.forEach(trip => {
      if (!trip.stops && !markersRef.current[`stops-${trip.id}`]) {
        // Stops are nested on the route — draw from route.stops if available
      }
    })
  }, [positions, activeTrips])

  // Draw stop markers when trips data loads
  useEffect(() => {
    const L   = window.L
    const map = leafletRef.current
    if (!L || !map || !trips) return

    trips.forEach(trip => {
      const key = `stops-${trip.id}`
      if (markersRef.current[key]) return // already drawn

      const stops = trip.stops ?? []
      const stopMarkers = stops.map(stop => {
        const stopIcon = L.divIcon(makeStopIcon())
        return L.marker([Number(stop.latitude), Number(stop.longitude)], { icon: stopIcon })
          .bindPopup(`
            <div style="font-family:sans-serif">
              <p style="font-weight:600;margin:0 0 2px">${stop.name}</p>
              <p style="color:#6b7280;font-size:12px;margin:0">Stop ${stop.sequence} · ${stop.eta_minutes} min</p>
            </div>
          `)
          .addTo(map)
      })

      if (stopMarkers.length) {
        markersRef.current[key] = stopMarkers
      }
    })
  }, [trips])

  // Selected trip details
  const selectedPos  = selected ? positions[selected] : null
  const selectedTrip = selected ? trips?.find(t => String(t.id) === selected) : null

  return (
    <div className="bg-white rounded-2xl mb-5 border border-gray-100 shadow-sm overflow-hidden">

      {/* Map header */}
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Live Fleet Map</span>
          {activeTrips.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {activeTrips.length} live
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {/* Legend */}
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            Scheduled
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border-2 border-indigo-500 inline-block" />
            Stop
          </span>
        </div>
      </div>

      {/* Map container */}
      <div style={{ height, position: 'relative' }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

        {/* No active vehicles overlay */}
        {activeTrips.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center
            bg-white/70 backdrop-blur-sm pointer-events-none z-10">
            <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            <p className="text-sm text-gray-400 font-medium">No active trips right now</p>
            {scheduledTrips.length > 0 && (
              <p className="text-xs text-gray-300 mt-1">
                {scheduledTrips.length} trip{scheduledTrips.length > 1 ? 's' : ''} scheduled today
              </p>
            )}
          </div>
        )}
      </div>

      {/* Selected vehicle info panel */}
      {selectedPos && selectedTrip && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50
          flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedPos.routeName}</p>
              <p className="text-xs text-gray-400">
                {selectedTrip.vehicle_plate} · {selectedTrip.driver_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-800">
                {Number(selectedPos.speed_kmh ?? 0).toFixed(1)}
              </span> km/h
            </span>
            <span>
              <span className="font-semibold text-gray-800">
                {Number(selectedPos.heading ?? 0).toFixed(0)}°
              </span> heading
            </span>
            <span className="text-gray-300">
              {selectedPos.updatedAt
                ? format(selectedPos.updatedAt, 'HH:mm:ss')
                : '—'}
            </span>
          </div>
          <button
            onClick={() => setSelected(null)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Trip list footer */}
      {trips?.length > 0 && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-4 overflow-x-auto">
          {trips.slice(0, 6).map(trip => (
            <button
              key={trip.id}
              onClick={() => setSelected(String(trip.id))}
              className={`flex items-center gap-2 shrink-0 px-3 py-1.5 rounded-lg text-xs
                transition-colors border ${
                  selected === String(trip.id)
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                trip.status === 'active' ? 'bg-green-500' : 'bg-blue-400'
              }`} />
              {trip.route_name}
            </button>
          ))}
          {trips.length > 6 && (
            <span className="text-xs text-gray-300 shrink-0">+{trips.length - 6} more</span>
          )}
        </div>
      )}

    </div>
  )
}