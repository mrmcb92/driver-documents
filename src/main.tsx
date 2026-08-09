import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConfigErrorScreen from './components/ConfigErrorScreen';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { registerSW } from 'virtual:pwa-register';
import { supabaseConfigError } from './lib/supabaseClient';
import './index.css';

// Register the service worker so push notifications and offline caching work.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {supabaseConfigError ? (
      <ThemeProvider>
        <ConfigErrorScreen message={supabaseConfigError} />
      </ThemeProvider>
    ) : (
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    )}
  </React.StrictMode>
);
