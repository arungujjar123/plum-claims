import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, FileText, Menu, X } from 'lucide-react';
import { useState } from 'react';
import ClaimSubmission from './components/ClaimSubmission';
import ClaimsList from './components/ClaimsList';
import './index.css';

function NavBar() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { to: '/', label: 'Submit Claim', icon: <FileText className="w-4 h-4" /> },
    { to: '/claims', label: 'All Claims', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-plum-900/40 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-plum-600 to-plum-800 shadow-lg shadow-plum-800/30 transition-transform group-hover:scale-105">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Plum<span className="text-plum-400"> Claims</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden sm:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === link.to
                    ? 'bg-plum-800/50 text-plum-300 shadow-inner'
                    : 'text-gray-400 hover:text-white hover:bg-surface-elevated'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile Toggle */}
          <button
            className="sm:hidden text-gray-400 hover:text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="sm:hidden pb-4 space-y-1 animate-fade-in-up">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === link.to
                    ? 'bg-plum-800/50 text-plum-300'
                    : 'text-gray-400 hover:text-white hover:bg-surface-elevated'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ClaimSubmission />} />
            <Route path="/claims" element={<ClaimsList />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-plum-900/30 py-6 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Plum Benefits. AI-powered OPD claim adjudication.</p>
        </footer>
      </div>
    </Router>
  );
}

export default App;
