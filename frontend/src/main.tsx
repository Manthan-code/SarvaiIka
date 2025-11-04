import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import './index.css'
import { initSentry } from './config/sentry'
import { ThemeProvider } from './hooks/useTheme'

// Initialize Sentry for error monitoring
initSentry();

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="ai-agent-theme">
      <App />
    </ThemeProvider>
  </QueryClientProvider>
);
