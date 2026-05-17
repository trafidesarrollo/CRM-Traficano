import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold">Ocurrió un error en esta página</h2>
            <p className="text-sm text-muted-foreground">{this.state.error.message}</p>
            <button
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
