import React, { useState } from 'react';

interface User {
  Username: string;
  'Full Name': string;
  Password: string;
  Role: string;
}

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const scriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
      const response = await fetch(`${scriptUrl}?sheet=Login`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user data');
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to retrieve data from sheet');
      }

      // Convert 2D array to array of objects
      const [headers, ...rows] = result.data;
      const users: User[] = rows.map((row: any[]) => {
        const userObj: any = {};
        headers.forEach((header: string, index: number) => {
          userObj[header] = row[index];
        });
        return userObj as User;
      });
      
      const foundUser = users.find(
        (u) => u.Username === username && String(u.Password) === password
      );

      if (foundUser) {
        onLogin(foundUser);
      } else {
        setError('Invalid username or password. Please try again.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card">
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Welcome Back</h1>
        <p style={{ marginBottom: '32px', opacity: 0.7 }}>Please sign in to continue</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="input-field"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-field"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
