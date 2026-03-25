import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type ErrorBoundaryLevel = "app" | "route";

interface Props {
  children: ReactNode;
  level?: ErrorBoundaryLevel;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const level = this.props.level ?? "route";
      const isAppLevel = level === "app";

      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {isAppLevel ? "A critical error occurred" : "Something went wrong"}
            </AlertTitle>
            <AlertDescription>
              <p className="mb-4">{this.state.error.message}</p>
              {isAppLevel ? (
                <Button variant="outline" size="sm" onClick={this.handleRefresh}>
                  Refresh page
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={this.handleReset}>
                  Try again
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
