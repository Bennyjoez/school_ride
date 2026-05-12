import axios from 'axios'
import { store } from '../store'
import { setAccessToken, logout } from '../store/authSlice'

const api = axios.create({
  baseURL: '/api/',  // proxied to http://127.0.0.1:8000 by Vite
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach access token to every request
api.interceptors.request.use(
  config => {
    const token = store.getState().auth.accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

// Silently refresh access token on 401, then replay the original request
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true

      try {
        const refreshToken = store.getState().auth.refreshToken
        if (!refreshToken) throw new Error('No refresh token')

        // Use a plain axios call (not `api`) to avoid interceptor loop
        const { data } = await axios.post('/api/auth/refresh/', {
          refresh: refreshToken,
        })

        store.dispatch(setAccessToken(data.access))
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)

      } catch {
        store.dispatch(logout())
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    return Promise.reject(error)
  }
)

export default api
