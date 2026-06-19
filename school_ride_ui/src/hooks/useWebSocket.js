import { useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { selectAccessToken } from "../store/authSlice";

/**
 * useWebSocket - connects to the trip tracking WebSocket.
 *
 * @param {number|string} tripId  - the trip to track
 * @param {object} handlers
 *   onGpsPing(data) - called on each { latitude, longitude, speed_kmh, heading, recorded_at }
 *   onEtaUpdate(data) - called on each { stop_etas: { <stop_id>: <minutes> } }
 *   onOpen() - called when connection opens
 *   onClose() - called when connection closes
 *
 * Returns { disconnect } to allow manual close.
 */
export function useWebSocket(
  tripId,
  { onGpsPing, onEtaUpdate, onOpen, onClose } = {},
) {
  const accessToken = useSelector(selectAccessToken);
  const wsRef = useRef(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!tripId || !accessToken){
      console.warn("[WS] Missing tripId or accessToken, cannot connect");
      return;
    }

    const url = `ws://127.0.0.1:8000/ws/trips/${tripId}/track/?token=${accessToken}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "gps_ping") onGpsPing?.(msg.data);
        if (msg.type === "eta_update") onEtaUpdate?.(msg.data);
      } catch (e) {
        console.error("[WS] Failed to parse message", e);
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error", error);
    };

    ws.onclose = (event) => {
      onClose?.();
    };

    return () => {
      ws.close();
    };
  }, [tripId, accessToken, onOpen, onGpsPing, onEtaUpdate, onClose]);

  return { disconnect };
}
