// instrumentation.ts - Server and Edge runtime initialization
// This file is automatically loaded by Next.js
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server initialization
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime initialization
    const Sentry = await import('@sentry/nextjs');

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: false,
    });
  }
}
