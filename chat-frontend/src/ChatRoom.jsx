import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function ChatRoom({ username, allUsers }) {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const chatEndRef = useRef(null);

  useEffect(() => {
    socket.emit('register_user', username);
    socket.emit('sync_users', allUsers);

    socket.on('user_list', ({ all, online }) => {
      setOnlineUsers(online);
    });

    socket.on('private_message', (msg) => {
      const isActiveChat = msg.from === recipient || msg.to === recipient;
      setMessageList((prev) => (isActiveChat ? [...prev, msg] : prev));

      if (!isActiveChat && msg.to === username) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msg.from]: (prev[msg.from] || 0) + 1,
        }));
      }
    });

    socket.on('chat_history', (history) => {
      setMessageList(history);
      setUnreadCounts((prev) => {
        const updated = { ...prev };
        delete updated[recipient];
        return updated;
      });
    });

    socket.on('read_receipt_ack', ({ from }) => {
      setMessageList((prev) =>
        prev.map((msg) =>
          msg.from === username && msg.to === from ? { ...msg, read: true } : msg
        )
      );
    });

    return () => {
      socket.off('user_list');
      socket.off('private_message');
      socket.off('chat_history');
      socket.off('read_receipt_ack');
    };
  }, [username, recipient]);

  useEffect(() => {
    if (recipient) {
      socket.emit('fetch_history', { from: username, to: recipient });
      socket.emit('read_receipt', { from: username, to: recipient });
    }
  }, [recipient, username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageList]);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !recipient) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      socket.emit('private_message', {
        to: recipient,
        from: username,
        file: {
          name: file.name,
          type: file.type,
          data: reader.result,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="container mt-4" style={{ height: '90vh' }}>
      <h4>Hello, {username} 👋</h4>

      <div className="row h-100">
        {/* Sidebar */}
        <div className="col-md-3 border-end overflow-auto">
          <h5>Users</h5>
          <ul className="list-group">
            {allUsers
              .filter((u) => u !== username)
              .map((user, idx) => (
                <li
                  key={idx}
                  className={`list-group-item d-flex justify-content-between align-items-center ${recipient === user ? 'active' : ''}`}
                  onClick={() => setRecipient(user)}
                  style={{ cursor: 'pointer' }}
                >
                  <span>
                    {user}{' '}
                    {onlineUsers.includes(user) ? (
                      <span className="badge bg-success ms-2">●</span>
                    ) : (
                      <span className="badge bg-secondary ms-2">●</span>
                    )}
                  </span>
                  {unreadCounts[user] > 0 && (
                    <span className="badge bg-danger rounded-pill">{unreadCounts[user]}</span>
                  )}
                </li>
              ))}
          </ul>
        </div>

        {/* Chat Section */}
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
                        style={{ maxWidth: '60%', borderRadius: '8px' }}
                      />
                    </div>
                  )}
                  {msg.file && (
                    <div className="mt-2">
                      {msg.file.type?.startsWith('image/') ? (
                        <img
                          src={msg.file.data}
                          alt={msg.file.name}
                          style={{ maxWidth: '60%', borderRadius: '8px' }}
                        />
                      ) : (
                        <a
                          href={msg.file.data}
                          download={msg.file.name}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm btn-outline-secondary"
                        >
                          📎 {msg.file.name}
                        </a>
                      )}
                    </div>
                  )}
                  <div className="text-muted" style={{ fontSize: '0.8em' }}>
                    {msg.from === username && (
                      <span>{msg.read ? '✅✅ Read' : '✅ Sent'}</span>
                    )}
                    {' · '}
                    {msg.time}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted">Select a user to view chat</p>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Sticky Input */}
          <div
            className="input-group"
            style={{
              position: 'sticky',
              bottom: '0',
              backgroundColor: '#fff',
              paddingBottom: '10px',
              paddingTop: '5px',
              zIndex: 10,
            }}
          >
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
              onChange={handleFileChange}
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
