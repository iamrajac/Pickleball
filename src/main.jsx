import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f1923', color: '#e2eaf4', padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏓</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 2, color: '#10d48e', marginBottom: 8 }}>SOMETHING WENT WRONG</div>
          <div style={{ fontSize: 14, color: '#7a95b0', marginBottom: 32, maxWidth: 320 }}>The app hit an unexpected error. Try refreshing — your tournament data is safe.</div>
          <button onClick={() => window.location.reload()} style={{ padding: '14px 32px', background: '#10d48e', border: 'none', borderRadius: 10, color: '#0f1923', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, cursor: 'pointer' }}>
            REFRESH
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
