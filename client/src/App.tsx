import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Contribute } from './pages/Contribute';
import { Memories } from './pages/Memories';
import { Explore } from './pages/Explore';
import { Profile } from './pages/Profile';
import { Home } from './pages/Home';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/Layout';

function App() {
  // Get base path from Vite's environment (set via VITE_BASE_PATH or defaults to '/')
  // Vite automatically sets import.meta.env.BASE_URL based on the base config
  const basePath = import.meta.env.BASE_URL || '/';
  
  // Ensure basePath ends with / for consistency (Vite should handle this, but just in case)
  const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  
  return (
    <Router basename={normalizedBasePath}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/contribute"
            element={
              <ProtectedRoute>
                <Contribute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/memories"
            element={
              <ProtectedRoute>
                <Memories />
              </ProtectedRoute>
            }
          />
          <Route path="/explore" element={<Explore />} />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
