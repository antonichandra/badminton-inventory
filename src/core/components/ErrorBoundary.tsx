import { Component, type ErrorInfo, type ReactNode } from "react";
import { UnexpectedErrorContent } from "../../pages/UnexpectedErrorPage";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unexpected application error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <UnexpectedErrorContent />;
    }

    return this.props.children;
  }
}
