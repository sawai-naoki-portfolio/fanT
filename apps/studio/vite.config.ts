import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Runs locally only (STU-08 is Phase 2): no hosting, no authentication.
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1' },
});
