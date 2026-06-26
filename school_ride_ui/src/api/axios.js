import axios from "axios";
import { store } from "../store";
import { setAccessToken, logout } from "../store/authSlice";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach access token to every request
api.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Silently refresh access token on 401, then replay the original request
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = store.getState().auth.refreshToken;
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post("/api/auth/refresh/", {
          refresh: refreshToken,
        });
        store.dispatch(setAccessToken(data.access));
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        store.dispatch(logout());
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    // Build a clean error message — avoid duplicating the detail field
    const res = error?.response?.data || {};
    const parts = Object.entries(res)
      .filter(([key]) => key !== "detail")
      .map(
        ([key, val]) => `${key}: ${Array.isArray(val) ? val.join(" ") : val}`,
      );
    const base = res.detail || error.message || "An unknown error occurred";
    const message = parts.length ? `${base} — ${parts.join(" ")}` : base;

    return Promise.reject({ message });
  },
);

export default api;
