import React, { useState } from 'react';
import ChatRoom from './ChatRoom';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState([]);

  const handleAuth = () => {
    const users = JSON.parse(localStorage.getItem('chatUsers')) || {};

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    if (isSignup) {
      if (users[username]) {
        setError('⚠️ Username already exists. Try logging in.');
      } else {
        users[username] = password;
        localStorage.setItem('chatUsers', JSON.stringify(users));
        setAllUsers(Object.keys(users));
        setJoined(true);
        setError('');
      }
    } else {
      if (users[username] === password) {
        setAllUsers(Object.keys(users));
        setJoined(true);
        setError('');
      } else {
        setError('❌ Invalid username or password');
      }
    }
  };

  return (
    <div className="container d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
      {!joined ? (
        <div className="card shadow p-4 w-100" style={{ maxWidth: '450px' }}>
          <h2 className="text-center mb-4">
            {isSignup ? '📝 Sign Up' : '🔐 Login to Chat App'}
          </h2>

          <div className="mb-3">
            <input
              className="form-control"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="mb-3">
            <input
              type="password"
              className="form-control"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <div className="text-danger text-center mb-2">{error}</div>}

          <div className="d-grid">
            <button className="btn btn-primary" onClick={handleAuth}>
              {isSignup ? 'Create Account' : 'Login'}
            </button>
          </div>

          <div className="text-center mt-3">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              className="btn btn-link p-0"
              onClick={() => setIsSignup(!isSignup)}
            >
              {isSignup ? 'Login here' : 'Sign up'}
            </button>
          </div>
        </div>
      ) : (
        <ChatRoom username={username} allUsers={allUsers} />
      )}
    </div>
  );
}
