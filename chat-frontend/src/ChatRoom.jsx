import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

const socket = io('http://192.168.29.11:4000'); // Or your IP

export default function ChatRoom({ username }) {
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);

  const storageKey = `chatMessages_${username}`;

  useEffect(() => {
  const savedMessages = JSON.parse(localStorage.getItem(storageKey)) || [];
  setMessageList(savedMessages);

  const handleReceive = (data) => {
    setMessageList((prevMessages) => {
      const updatedMessages = [...prevMessages, data];
      localStorage.setItem(storageKey, JSON.stringify(updatedMessages));
      return updatedMessages;
    });
  };

  socket.on('receive_message', handleReceive);

  return () => {
    socket.off('receive_message', handleReceive);
  };
}, [storageKey]);
 // ✅ included dependency

const sendMessage = () => {
  if (message.trim() === '') return;

  const messageData = {
    author: username,
    message: message,
    time: new Date().toLocaleTimeString(),
  };

  socket.emit('send_message', messageData);

 

  setMessage('');
};


  return (
    <div className="container mt-5">
      <h2 className="mb-4">💬 Welcome, {username}</h2>

      <div className="mb-3">
        <input
          type="text"
          placeholder="Enter message"
          className="form-control"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage} className="btn btn-primary mt-2">
          Send
        </button>
      </div>

      <div className="border p-3 rounded bg-light" style={{ height: '300px', overflowY: 'auto' }}>
        {messageList.map((msg, index) => (
          <div key={index} className="mb-2">
            <strong>{msg.author}</strong>: {msg.message}
            <span className="text-muted float-end" style={{ fontSize: '0.8em' }}>
              {msg.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
