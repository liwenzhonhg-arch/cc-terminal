import React, { Component, type ErrorInfo, type ReactNode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: "#D33F2A", fontFamily: "monospace", background: "#0A0A0A", height: "100vh" }}>
          <h1>React Error</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#E8E4DA" }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", color: "#C68A2E", fontSize: 12, marginTop: 20 }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
