import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    base: 'school_ride', // Set the base URL for the stage and production server
  },
  resolve: {
    alias: {
      'redux-persist/lib/storage': 'redux-persist/lib/storage/index.js',
    },
  },
})
