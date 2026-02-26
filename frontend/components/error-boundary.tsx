'use client';

import React from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px',
              padding: '20px',
              textAlign: 'center',
            }}
          >
            <h2 style={{ fontSize: '20px', marginBottom: '16px', color: '#fff' }}>
              Something went wrong
            </h2>
            <p style={{ opacity: 0.7, marginBottom: '24px', color: '#fff' }}>
              We're working on fixing this issue.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--em, #10b981)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
