import React, { useState } from 'react';
import ChatRoom from './ChatRoom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

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
  <div className="container d-flex flex-column justify-content-center align-items-center" style={{ height: '100vh' }}>
    
    {/* 🔹 Branding Header (only before login) */}
{!joined && (
  <div className="mb-4 text-center">
    <h1 className="text-white">💬 ChatterBox</h1>
    <p className="text-light">Connect instantly. Chat privately.</p>
  </div>
)}


    {!joined ? (
      <div className="card shadow p-5 w-100" style={{ maxWidth: '450px' }}>
  <h2 className="text-center mb-4 fw-bold">
    {isSignup ? '📝 Create Your Account' : '🔐 Login to ChatterBox'}
  </h2>

  <div className="input-group mb-4">
    <span className="input-group-text">
      <i className="bi bi-person"></i>
    </span>
    <input
      type="text"
      className="form-control"
      placeholder="Username"
      value={username}
      onChange={(e) => setUsername(e.target.value)}
    />
  </div>

  <div className="input-group mb-4">
    <span className="input-group-text">
      <i className="bi bi-lock"></i>
    </span>
    <input
      type="password"
      className="form-control"
      placeholder="Password"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />
  </div>

  {error && <div className="text-danger text-center mb-3">{error}</div>}

  <div className="d-grid mb-3">
    <button className="btn btn-primary" onClick={handleAuth}>
      {isSignup ? 'Create Account' : 'Login'}
    </button>
  </div>

  <div className="text-center">
    <small className="text-muted">
      {isSignup ? 'Already have an account?' : "Don't have an account?"}
    </small>
    <br />
    <button
      className="btn btn-link"
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
