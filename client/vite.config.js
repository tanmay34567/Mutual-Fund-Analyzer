import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  
  return {
    plugins: [tailwindcss(), react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    server: {
      proxy: {
        '/api': {
          target: isProduction 
            ? 'https://mutual-fund-analyzer.onrender.com'
            : 'http://localhost:5000',
          changeOrigin: true,
          secure: isProduction,
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: !isProduction
    }
  }
})
