import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import GranjasEden from './pages/GranjasEden';
import FarmDetail from './pages/FarmDetail';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Finance from './pages/Finance';
import UpdateScreen from './pages/UpdateScreen';
import './styles/index.css';

function App() {
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    if (!window.electronApp?.onUpdateState) {
      setShowApp(true);
      return;
    }

    const unsubscribe = window.electronApp.onUpdateState((state) => {
      const isBusy = ['checking', 'available', 'downloading', 'downloaded', 'installing'].includes(state?.status);
      setShowApp(!isBusy);
    });

    return () => unsubscribe?.();
  }, []);

  if (!showApp) {
    return <UpdateScreen />;
  }

  return (
    <Router>
      <div className="noise-overlay" />
      <div className="layout">
        <Sidebar />
        <div className="main-content">
          <Header />
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects/granjas-eden" element={<GranjasEden />} />
              <Route path="/projects/granjas-eden/:farmSlug" element={<FarmDetail />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:slug" element={<MemberDetail />} />
              <Route path="/finance" element={<Finance />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
