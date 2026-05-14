import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Servers from './pages/Servers';
import Containers from './pages/Containers';
import Deployments from './pages/Deployments';
import Alerts from './pages/Alerts';
import Metrics from './pages/Metrics';
import Logs from './pages/Logs';
import Layout from './components/Layout';

function App() {
  const { token } = useAuthStore();

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={!token ? <Login /> : <Navigate to="/" />}
          />
          <Route
            path="/"
            element={token ? <Layout /> : <Navigate to="/login" />}
          >
            <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
            <Route path="servers" element={<ErrorBoundary><Servers /></ErrorBoundary>} />
            <Route path="containers" element={<ErrorBoundary><Containers /></ErrorBoundary>} />
            <Route path="deployments" element={<ErrorBoundary><Deployments /></ErrorBoundary>} />
            <Route path="alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
            <Route path="metrics" element={<ErrorBoundary><Metrics /></ErrorBoundary>} />
            <Route path="logs" element={<ErrorBoundary><Logs /></ErrorBoundary>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
