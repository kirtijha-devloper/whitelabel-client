import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-800">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full border border-red-200">
            <h2 className="text-xl font-bold text-red-600 mb-2">Dashboard Error</h2>
            <p className="text-sm text-gray-600 mb-4">
              {this.state.error?.message || "An unexpected error occurred while rendering this page."}
            </p>
            {this.state.error?.stack && (
              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-48 text-red-700 font-mono mb-4 whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2 bg-[#00D3CD] text-white rounded-lg font-semibold hover:bg-[#00b8b3] transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

