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
      // Append only if message belongs to current chat
      if (data.from === recipient || data.to === recipient) {
        setMessageList((prev) => [...prev, data]);
      }
    });

    socket.on('chat_history', (history) => {
      setMessageList(history); // Replace chat on user switch
    });

    return () => {
      socket.off('user_list');
      socket.off('private_message');
      socket.off('chat_history');
    };
  }, [username, recipient]);

  useEffect(() => {
    if (recipient) {
      setMessageList([]); // Clear old chat
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

  return (
    <div className="container mt-4">
      <h4>Hello, {username} 👋</h4>

      <select
        className="form-select my-3"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      >
        <option value="">Select user to chat with</option>
        {userList.map((user, idx) => (
          <option key={idx} value={user}>{user}</option>
        ))}
      </select>

      <div className="input-group mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Type your message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button className="btn btn-primary" onClick={sendMessage}>Send</button>
      </div>

      <div className="border p-3 rounded bg-light" style={{ height: '300px', overflowY: 'auto' }}>
        {messageList.map((msg, idx) => (
          <div key={idx} className="mb-2">
            <strong>{msg.from}</strong>: {msg.message}
            <span className="text-muted float-end" style={{ fontSize: '0.8em' }}>{msg.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
