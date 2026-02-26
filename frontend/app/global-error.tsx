'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#0A0A0A',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px',
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.7, marginBottom: '24px' }}>
            An error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#fff',
              color: '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            Reload page
          </button>
        </div>
      </body>
    </html>
  );
}
