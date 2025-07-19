import { Component, ReactNode } from 'react';

import { ErrorInfo } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.log(error, { extra: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-screen place-content-center text-center p-6">
          <h1 className="text-2xl font-bold mb-2">Something went wrong 😞</h1>
          <button
            className="rounded-xl bg-black text-white px-4 py-2"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
