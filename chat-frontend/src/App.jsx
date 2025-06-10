import React, { useState } from 'react';
import ChatRoom from './ChatRoom';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [joined, setJoined] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');

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
        setJoined(true);
        setError('');
      }
    } else {
      if (users[username] === password) {
        setJoined(true);
        setError('');
      } else {
        setError('❌ Invalid username or password');
      }
    }
  };

  return (
    <div className="container mt-5">
      {!joined ? (
        <div className="text-center">
          <h2>{isSignup ? '📝 Sign Up' : '🔐 Login to Chat App'}</h2>

          <input
            className="form-control w-50 mx-auto mt-3"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            type="password"
            className="form-control w-50 mx-auto mt-3"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="text-danger mt-2">{error}</p>}

          <button className="btn btn-primary mt-3" onClick={handleAuth}>
            {isSignup ? 'Create Account' : 'Login'}
          </button>

          <p className="mt-3">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button className="btn btn-link" onClick={() => setIsSignup(!isSignup)}>
              {isSignup ? 'Login here' : 'Sign up'}
            </button>
          </p>
        </div>
      ) : (
        <ChatRoom username={username} />
      )}
    </div>
  );
}
