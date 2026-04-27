import { useState, useEffect } from 'react';
import Login from './pages/Login';
import LocationHistory from './pages/LocationHistory';

interface User {
  Username: string;
  'Full Name': string;
  Password: string;
  Role: string;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (loggedUser: User) => {
    setUser(loggedUser);
    setIsLoggedIn(true);
    localStorage.setItem('currentUser', JSON.stringify(loggedUser));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    localStorage.removeItem('currentUser');
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <>
      {/* Static Fixed Header */}
      <header className="fixed-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
            LQ
          </div>
          <h1 style={{ fontSize: '20px', margin: 0 }}>Location QR</h1>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--text-h)' }}>{user?.['Full Name']}</p>
            <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>{user?.Role}</p>
          </div>
          <button className="btn-secondary" onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {showSuccess && (
        <div style={{ position: 'fixed', top: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
          <div className="alert alert-success">
            Login Successful! Welcome, {user?.['Full Name']}
          </div>
        </div>
      )}

      <main>
        <LocationHistory />
      </main>
    </>
  );
}

export default App;
