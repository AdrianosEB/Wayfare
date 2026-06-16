import { Component, type ReactNode } from 'react';

/**
 * Last-resort guard so a render error in one panel never blanks the whole app. Shows a calm
 * recovery card with a reload. (Streaming/UX errors are handled in-band by the store.)
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-sand p-8 text-center">
          <h1 className="text-lg font-semibold text-ink">Something went sideways</h1>
          <p className="max-w-sm text-sm text-muted">
            A part of the page hit an unexpected error. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
