import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import GranjasEden from './pages/GranjasEden';
import FarmDetail from './pages/FarmDetail';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Finance from './pages/Finance';
import './styles/index.css';

function App() {
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
