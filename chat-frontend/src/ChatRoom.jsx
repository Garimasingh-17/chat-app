import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

export default function ChatRoom({ username, allUsers }) {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [selectedMsgIndex, setSelectedMsgIndex] = useState(null);
  const [forwardMessageContent, setForwardMessageContent] = useState(null);
  const [showForwardTo, setShowForwardTo] = useState(false);
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
    setSelectedMsgIndex(null);
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

  const handleDeleteMessage = (index) => {
    const updatedMessages = [...messageList];
    updatedMessages.splice(index, 1);
    setMessageList(updatedMessages);
    setSelectedMsgIndex(null);
  };

  const handleForward = (msg) => {
    setForwardMessageContent(msg);
    setShowForwardTo(true);
  };

  const sendForwardedMessage = (toUser) => {
    if (!toUser || !forwardMessageContent) return;

    const forwarded = {
      ...forwardMessageContent,
      from: username,
      to: toUser,
      forwarded: true,
    };

    socket.emit('private_message', forwarded);
    setShowForwardTo(false);
    setForwardMessageContent(null);
  };

  return (
    <div className="container mt-4" style={{ height: '90vh' }}>
      

      <div className="row h-100">
        {/* Sidebar */}
         <h1> {username}</h1>
        <div className="col-md-3 border-end overflow-auto">
          <h5>Users</h5>
<ul className="list-group user-list" style={{ maxHeight: 'calc(90vh - 120px)', overflowY: 'auto' }}>
  {allUsers
    .filter((u) => u !== username)
    .map((user, idx) => (
      <li
        key={idx}
        className={`list-group-item user-item d-flex justify-content-between align-items-center ${recipient === user ? 'active' : ''}`}
        onClick={() => setRecipient(user)}
      >
        <div className="d-flex flex-column">
          <strong style={{ fontSize: '1rem' }}>{user}</strong>
          <small className={`text-${onlineUsers.includes(user) ? 'success' : 'secondary'}`}>
            {onlineUsers.includes(user) ? 'Online' : 'Offline'}
          </small>
        </div>
        {unreadCounts[user] > 0 && (
          <span className="badge bg-danger rounded-pill">
            {unreadCounts[user]}
          </span>
        )}
      </li>
    ))}
</ul>


        </div>

        {/* Chat Section */}
<div className="col-md-9 d-flex flex-column" style={{ height: '100%' }}>
  {/* Sticky Chat Header */}
  <div
    className="d-flex justify-content-between align-items-center border-bottom px-2 py-2"
    style={{
      position: 'sticky',
      top: 0,
      backgroundColor: '#fff',
      zIndex: 10,
    }}
  >
    <h3 className="mb-0"> {recipient || '...'}</h3>
  </div>


<div className="border p-3 rounded bg-light flex-grow-1 mb-2" style={{ overflowY: 'auto', height: 0 }}>
           {recipient ? (
  messageList.map((msg, idx) => (
    <div
      key={idx}
      className={`d-flex flex-column ${msg.from === username ? 'align-items-end' : 'align-items-start'} mb-3 fade-in`}
      onClick={() => setSelectedMsgIndex(idx)}
      style={{ cursor: 'pointer' }}
    >
      <div className={`message-bubble ${msg.from === username ? 'message-from-me' : 'message-from-other'}`}>
        
        {msg.forwarded && <small className="text-muted">(Forwarded)</small>}
        <div>{msg.message}</div>

        {msg.file?.type?.startsWith('image/') && (
          <img
            src={msg.file.data}
            alt={msg.file.name}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(msg.file.data);
              setSelectedImageIndex(idx);
            }}
            style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '5px' }}
          />
        )}

        {msg.file && !msg.file.type?.startsWith('image/') && (
          <a
            href={msg.file.data}
            download={msg.file.name}
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm btn-outline-secondary mt-2"
          >
            📎 {msg.file.name}
          </a>
        )}

        <div className="text-muted mt-2" style={{ fontSize: '0.8em' }}>
          {msg.from === username && (
            <span>{msg.read ? '✅✅ Read' : '✅ Sent'}</span>
          )}
         
          {msg.time}
        </div>
      </div>

      {selectedMsgIndex === idx && (
        <div className="mt-1 d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleForward(msg);
            }}
          >
            📤 Forward
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteMessage(idx);
            }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  ))
) : (
  <p className="text-muted">Select a user to view chat</p>
)}

            <div ref={chatEndRef} />
          </div>

          {/* Sticky Message Input */}
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

      {/* Fullscreen Image View */}
      {selectedImage && (
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1050,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => {
            setSelectedImage(null);
            setSelectedImageIndex(null);
          }}
        >
          <div onClick={(e) => e.stopPropagation()} className="text-center">
            <img
              src={selectedImage}
              alt="Full View"
              style={{
                maxHeight: '80vh',
                maxWidth: '80vw',
                borderRadius: '10px',
                marginBottom: '15px',
              }}
            />
            <div className="d-flex justify-content-center gap-3">
  <a
    href={selectedImage}
    download={`image-${selectedImageIndex}`}
    className="btn btn-light"
  >
    ⬇️ Download
  </a>
  <button
    className="btn btn-danger"
    onClick={() => {
      handleDeleteMessage(selectedImageIndex);
      setSelectedImage(null);
      setSelectedImageIndex(null);
    }}
  >
    🗑️ Delete
  </button>
  <button
    className="btn btn-secondary"
    onClick={() => {
      setSelectedImage(null);
      setSelectedImageIndex(null);
    }}
  >
    ❌ Close
  </button>
</div>

          </div>
        </div>
      )}

      {/* Forward Modal */}
      {showForwardTo && (
        <div
          className="modal d-block"
          style={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1060,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowForwardTo(false)}
        >
          <div
            className="bg-white p-4 rounded shadow"
            onClick={(e) => e.stopPropagation()}
          >
            <h5>Forward to:</h5>
            <ul className="list-group">
              {allUsers
                .filter((user) => user !== username)
                .map((user, idx) => (
                  <li
                    key={idx}
                    className="list-group-item list-group-item-action"
                    style={{ cursor: 'pointer' }}
                    onClick={() => sendForwardedMessage(user)}
                  >
                    {user}
                  </li>
                ))}
            </ul>
            <div className="text-end mt-3">
              <button className="btn btn-secondary" onClick={() => setShowForwardTo(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
