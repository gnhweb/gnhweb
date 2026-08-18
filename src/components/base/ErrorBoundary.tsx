import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background-50 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-5">
              <i className="ri-error-warning-line text-3xl text-accent-600"></i>
            </div>
            <h1 className="text-xl font-bold text-foreground-950 mb-2">앗, 문제가 발생했어요</h1>
            <p className="text-sm text-foreground-600 leading-relaxed mb-6">
              페이지를 불러오는 중 예상치 못한 오류가 발생했어요.<br />
              아래 버튼을 눌러 다시 시도해주세요.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent-500 text-background-50 font-semibold text-sm hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-refresh-line"></i>
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}