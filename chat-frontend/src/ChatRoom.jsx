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
const [groupList, setGroupList] = useState(() => {
  const saved = localStorage.getItem('groupList');
  return saved ? JSON.parse(saved) : [];
});


const [showAddMemberModal, setShowAddMemberModal] = useState(false);
const [selectedNewMembers, setSelectedNewMembers] = useState([]);

const [showGroupModal, setShowGroupModal] = useState(false);
const [groupName, setGroupName] = useState('');
const [selectedGroupUsers, setSelectedGroupUsers] = useState([]);
const [base64Image, setBase64Image] = useState(null);
const [base64File, setBase64File] = useState(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [selectedMsgIndex, setSelectedMsgIndex] = useState(null);
  const [forwardMessageContent, setForwardMessageContent] = useState(null);
  const [showForwardTo, setShowForwardTo] = useState(false);
  

  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
const [selectedMemberToRemove, setSelectedMemberToRemove] = useState('');

  
  const chatEndRef = useRef(null);
  const [selectedGroup, setSelectedGroup] = useState('');
const [selectedUsersToAdd, setSelectedUsersToAdd] = useState([]);

const handleUserSelection = (e) => {
  const options = Array.from(e.target.selectedOptions);
  const usernames = options.map((opt) => opt.value);
  setSelectedUsersToAdd(usernames);
};

const handleAddMembers = () => {
  if (selectedGroup && selectedUsersToAdd.length > 0) {
    socket.emit('add_to_group', {
      groupName: selectedGroup,
      newMembers: selectedUsersToAdd,
    });

    alert(`Added ${selectedUsersToAdd.join(', ')} to ${selectedGroup}`);
    setSelectedUsersToAdd([]);
  }
};


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
  socket.on('group_list', (groups) => {
    setGroupList(groups);
    localStorage.setItem('groupList', JSON.stringify(groups)); // 💾 Save to localStorage
  });

  return () => {
    socket.off('group_list');
  };
}, []);



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
  if ((!message.trim() && !base64Image && !base64File) || !recipient) return;

  const isGroup = groupList.includes(recipient); // group or private

  const payload = {
    from: username,
    message,
    image: base64Image,
    file: base64File,
    forwarded: false,
  };

  if (isGroup) {
    socket.emit('group_message', {
      ...payload,
      groupName: recipient,
    });
  } else {
    socket.emit('private_message', {
      ...payload,
      to: recipient,
    });
  }

  setMessage('');
  setBase64Image(null);
  setBase64File(null);
};



  const handleCreateGroup = () => {
  if (groupName.trim() && selectedGroupUsers.length > 0) {
    const group = {
      name: groupName,
      members: [...selectedGroupUsers, username],
    };
    socket.emit('create_group', group);
    setGroupName('');
    setSelectedGroupUsers([]);
    setShowGroupModal(false);
  }
};

useEffect(() => {
  const storedGroups = JSON.parse(localStorage.getItem('groupList') || '[]');
  if (storedGroups.length > 0) {
    setGroupList(storedGroups);
    // Optionally sync with server:
    // socket.emit('sync_groups', storedGroups);
  }
}, []);


useEffect(() => {
  if (!socket) return;

  const handleGroupMessage = (msg) => {
    const isCurrentGroup = recipient === msg.to;

    if (isCurrentGroup) {
      setMessageList((prev) => [...prev, msg]);

      // Mark as read
      socket.emit('mark_group_read', {
        groupName: recipient,
        username,
      });
    } else {
      // Increase unread count
      setUnreadCounts((prev) => ({
        ...prev,
        [msg.to]: (prev[msg.to] || 0) + 1,
      }));
    }
  };

  // Initial unread counts when user logs in
  const handleInitialUnreadCounts = (counts) => {
    setUnreadCounts(counts); // counts is an object { groupName: count }
  };

  // Update unread count for one group
  const handleUnreadCountUpdate = ({ groupName, count }) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [groupName]: count,
    }));
  };

  socket.on('group_message', handleGroupMessage);
  socket.on('group_unread_counts', handleInitialUnreadCounts);
  socket.on('group_unread_count_update', handleUnreadCountUpdate);

  return () => {
    socket.off('group_message', handleGroupMessage);
    socket.off('group_unread_counts', handleInitialUnreadCounts);
    socket.off('group_unread_count_update', handleUnreadCountUpdate);
  };
}, [socket, recipient, username]);



const [groupMembers, setGroupMembers] = useState([]);

useEffect(() => {
  socket.on('group_members', ({ groupName, members }) => {
    if (groupName === recipient) {
      setGroupMembers(members);
    }
  });

  return () => {
    socket.off('group_members');
  };
}, [recipient]);



useEffect(() => {
  if (groupList.includes(recipient)) {
    // Fetch group chat history
    socket.emit('fetch_group_history', { groupName: recipient });

    // ✅ Mark all as read immediately when user opens group
    socket.emit('mark_group_read', {
      groupName: recipient,
      username,
    });
        socket.emit('get_group_members', { groupName: recipient });
         setUnreadCounts((prev) => {
    const updated = { ...prev };
    delete updated[recipient];
    return updated;
  });

  }
}, [recipient, username, groupList]);


const leaveGroup = (groupName) => {
  if (!window.confirm(`Are you sure you want to leave ${groupName}?`)) return;

  socket.emit('leave_group', { groupName, username });
};



useEffect(() => {
  socket.on('left_group', ({ groupName }) => {
    setGroupList((prev) => prev.filter((g) => g !== groupName));
    if (recipient === groupName) setRecipient(null);
    alert(`You left ${groupName}`);
  });

  return () => {
    socket.off('left_group');
  };
}, [recipient]);





useEffect(() => {
  socket.on('group_update', ({ groupName, members, leftBy }) => {
    if (groupName === recipient) {
      setGroupMembers(members);
    }
  });

  return () => {
    socket.off('group_update');
  };
}, [recipient]);



 const handleFileChange = (e) => {
  const file = e.target.files[0];
  if (!file || !recipient) return;

  const reader = new FileReader();
  reader.onloadend = () => {
    const base64 = reader.result;

    if (file.type.startsWith('image/')) {
      setBase64Image(base64);
    } else {
      setBase64File({
        name: file.name,
        type: file.type,
        data: base64,
      });
    }
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
  <div className="container-fluid p-0" style={{ height: '100vh', overflow: 'hidden' }}>
    <div className="row g-0 h-100">

        {/* Sidebar */}
         <h1> {username}</h1>
<div className="col-md-3 d-flex flex-column border-end" style={{ height: '100vh', overflowY: 'auto', backgroundColor: '#00bfff' }}>
          <button className="btn btn-outline-primary mb-2" onClick={() => setShowGroupModal(true)}>
  ➕ Create Group
</button>


<h5>Groups</h5>
<ul className="list-group mb-3">
  {groupList.map((groupName) => (
    <li
      key={groupName}
      className={`list-group-item list-group-item-action d-flex justify-content-between align-items-start ${recipient === groupName ? 'active' : ''}`}
      onClick={() => {
        setRecipient(groupName);

        // ✅ Reset unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [groupName]: 0,
        }));

        // ✅ Inform server that group messages are read
        socket.emit('mark_group_read', {
          groupName,
          username,
        });
      }}
    >
      <div className="me-auto">
        {groupName}
        {recipient === groupName && groupMembers.length > 0 && (
          <div className="small text-muted mt-1">
            <b>Members:</b> {groupMembers.join(', ')}
          </div>
        )}
      </div>

      {unreadCounts[groupName] > 0 && (
        <span className="badge bg-danger rounded-pill">
          {unreadCounts[groupName]}
        </span>
      )}
    </li>
  ))}
</ul>



{groupList.includes(recipient) && (
  <button
    className="btn btn-sm btn-outline-success my-2"
    onClick={() => setShowAddMemberModal(true)}
  >
    ➕ Add Member
  </button>
)}



{groupList.includes(recipient) && (
  <button
    className="btn btn-sm btn-danger mb-2"
    onClick={() => leaveGroup(recipient)}
  >
    Leave Group
  </button>
)}



{groupList.includes(recipient) && (
  <button
    className="btn btn-sm btn-outline-danger my-2 ms-2"
    onClick={() => setShowRemoveMemberModal(true)}
  >
    ❌ Remove Member
  </button>
)}
{showRemoveMemberModal && (
  <div className="modal d-block" tabIndex="-1">
    <div className="modal-dialog">
      <div className="modal-content p-3">
        <h5>Remove Member from <b>{recipient}</b></h5>
        <select
          className="form-select my-2"
          value={selectedMemberToRemove}
          onChange={(e) => setSelectedMemberToRemove(e.target.value)}
        >
          <option value="">Select member</option>
          {groupMembers
            .filter((user) => user !== username) // Cannot remove self
            .map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
        </select>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-secondary" onClick={() => setShowRemoveMemberModal(false)}>
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (selectedMemberToRemove) {
                socket.emit('remove_from_group', {
                  groupName: recipient,
                  member: selectedMemberToRemove,
                });
                setShowRemoveMemberModal(false);
                setSelectedMemberToRemove('');
                socket.emit('get_group_members', { groupName: recipient });
              }
            }}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  </div>
)}

<hr className="my-2" style={{ borderColor: 'rgba(255,255,255,0.3)' }} />

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
        <div className="d-flex align-items-center gap-2">
  <span
    className="status-dot"
    style={{
      backgroundColor: onlineUsers.includes(user) ? 'limegreen' : '#ccc',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      display: 'inline-block',
    }}
  />
  <strong style={{ fontSize: '1rem' }}>{user}</strong>
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
<div className="col-md-9 d-flex flex-column" style={{ height: '100vh', overflow: 'hidden' }}>
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
  <h3 className="mb-0">{recipient || '...'}</h3>

  {/* ✅ Close Chat Button */}
  {recipient && (
    <button
      className="btn btn-sm btn-outline-secondary"
      onClick={() => setRecipient(null)}
      title="Close Chat"
    >
      ❌ Close
    </button>
  )}
</div>





<div
  className={`flex-grow-1 mb-2 ${recipient ? 'border p-3 rounded bg-light' : ''}`}
  style={{ overflowY: 'auto' }}
>           {recipient ? (
  messageList.map((msg, idx) => (
    <div
      key={idx}
      className={`d-flex flex-column ${msg.from === username ? 'align-items-end' : 'align-items-start'} mb-3 fade-in`}
      onClick={() => setSelectedMsgIndex(idx)}
      style={{ cursor: 'pointer' }}
    >
      <div className={`message-bubble ${msg.from === username ? 'message-from-me' : 'message-from-other'}`}>
        
        {msg.forwarded && <small className="text-muted">(Forwarded)</small>}
         <strong>{msg.from}</strong>
        <div>{msg.message}</div>

{msg.image && (
  <img
    src={msg.image}
    alt="Shared"
    onClick={(e) => {
      e.stopPropagation();
      setSelectedImage(msg.image);
      setSelectedImageIndex(idx);
    }}
    style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '5px' }}
  />
)}

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

      <div className="message-meta mt-2">
  {/* ✅ Read status */}
  {msg.from === username ? (
    groupList.includes(recipient) ? (
      <>
        <span className="read-status">
          ✅ Read by {msg.readBy?.filter((u) => u !== username).length || 0}
        </span>
        {msg.readBy?.some((u) => u !== username) && (
          <div className="read-by-list">
            <small>{msg.readBy.filter((u) => u !== username).join(', ')}</small>
          </div>
        )}
      </>
    ) : (
      <span className="read-status">
        {msg.read ? '✅✅ Read' : '✅ Sent'}
      </span>
    )
  ) : null}

  {/* ⏱ Timestamp */}
  <div className="message-time">{msg.time}</div>
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
 <div className="d-flex flex-column justify-content-center align-items-center text-center" style={{ height: '100%' }}>
      <h4 className="text-muted mb-2">💬 Select a user or group</h4>
      <p className="text-muted">Start chatting by selecting a name from the left panel.</p>
    </div>
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






{showAddMemberModal && (
  <div className="modal d-block" tabIndex="-1">
    <div className="modal-dialog">
      <div className="modal-content p-3">
        <h5>Add Member to <b>{recipient}</b></h5>
        <select
  multiple
  className="form-select my-2"
  onChange={(e) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setSelectedNewMembers(selected);
  }}
>
  {Array.from(allUsers).map((user) =>
    !groupMembers.includes(user) && user !== username ? (
      <option key={user} value={user}>
        {user}
      </option>
    ) : null
  )}
</select>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-secondary" onClick={() => setShowAddMemberModal(false)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (selectedNewMembers.length > 0) {
  socket.emit('add_to_group', {
    groupName: recipient,
    newMembers: selectedNewMembers,
  });

                setShowAddMemberModal(false);
setSelectedNewMembers([]);
                socket.emit('get_group_members', { groupName: recipient }); // Refresh members list
              }
            }}
          >
            Add
          </button>
        </div>
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
      {showGroupModal && (
  <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowGroupModal(false)}>
    <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
      <div className="modal-content p-4">
        <h5>Create Group</h5>
        <input
          className="form-control mb-2"
          placeholder="Group name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />
        <div className="mb-2" style={{ maxHeight: '150px', overflowY: 'auto' }}>
          {allUsers.filter(u => u !== username).map((user, i) => (
            <div key={i} className="form-check">
              <input
                type="checkbox"
                className="form-check-input"
                value={user}
                onChange={(e) => {
                  setSelectedGroupUsers((prev) =>
                    e.target.checked
                      ? [...prev, user]
                      : prev.filter(u => u !== user)
                  );
                }}
                id={`check-${user}`}
              />
              <label className="form-check-label" htmlFor={`check-${user}`}>
                {user}
              </label>
            </div>
          ))}
        </div>
        <div className="d-flex justify-content-end">
          <button className="btn btn-secondary me-2" onClick={() => setShowGroupModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateGroup}>Create</button>
        </div>
      </div>
    </div>
  </div>

)}


    </div>
  );
}