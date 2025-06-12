import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function ChatRoom({ username }) {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);
  const [userList, setUserList] = useState([]);

  useEffect(() => {
    socket.emit('register_user', username);

    socket.on('user_list', (users) => {
      setUserList(users.filter((user) => user !== username));
    });

    socket.on('private_message', (data) => {
      if (data.from === recipient || data.to === recipient) {
        setMessageList((prev) => [...prev, data]);
      }
    });

    socket.on('chat_history', (history) => {
      setMessageList(history);
    });

    return () => {
      socket.off('user_list');
      socket.off('private_message');
      socket.off('chat_history');
    };
  }, [username, recipient]);

  useEffect(() => {
    if (recipient) {
      setMessageList([]);
      socket.emit('fetch_history', { from: username, to: recipient });
    }
  }, [recipient, username]);

  const sendMessage = () => {
    if (message.trim() && recipient) {
      socket.emit('private_message', {
        to: recipient,
        from: username,
        message,
      });
      setMessage('');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && recipient) {
      const reader = new FileReader();
      reader.onloadend = () => {
        socket.emit('private_message', {
          to: recipient,
          from: username,
          image: reader.result, // base64 encoded image
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="container mt-4" style={{ height: '90vh' }}>
      <h4>Hello, {username} 👋</h4>

      <div className="row h-100">
        {/* User List on the Left */}
        <div className="col-md-3 border-end">
          <h5>Users</h5>
          <ul className="list-group">
            {userList.map((user, idx) => (
              <li
                key={idx}
                className={`list-group-item ${recipient === user ? 'active' : ''}`}
                onClick={() => setRecipient(user)}
                style={{ cursor: 'pointer' }}
              >
                {user}
              </li>
            ))}
          </ul>
        </div>

        {/* Chat Area on the Right */}
        <div className="col-md-9 d-flex flex-column">
          {/* Chat Box */}
          <div
            className="border p-3 rounded bg-light flex-grow-1 mb-2"
            style={{ overflowY: 'auto' }}
          >
            {recipient ? (
              messageList.map((msg, idx) => (
                <div key={idx} className="mb-3">
                  <strong>{msg.from}</strong>:
                  {msg.message && <span> {msg.message}</span>}
                  {msg.image && (
                    <div className="mt-2">
                      <img
                        src={msg.image}
                        alt="sent"
                        style={{ maxWidth: '60%', height: 'auto', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                  <div className="text-muted" style={{ fontSize: '0.8em' }}>
                    {msg.time}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">Select a user to view chat</p>
            )}
          </div>

          {/* Message Input */}
          <div className="input-group" style={{ marginBottom: '15px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Type your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="form-control"
              style={{ maxWidth: '35%' }}
            />
            <button className="btn btn-primary" onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
