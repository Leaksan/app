import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

const AVATARS = ['🦁','🐺','🦊','🐻','🐼','🦅','🐬','🦋','🌙','⚡','🔥','🌿','💎','🎭','🚀'];
const ADMIN_CMD = '//ad min//';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// ─── VOICE RECORDER ──────────────────────────────────────────────────────────
function VoiceRecorder({ onSend }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => onSend(reader.result);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) { alert('Micro non disponible'); }
  };

  const stop = () => {
    if (mediaRef.current) mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  };

  const cancel = () => {
    if (mediaRef.current) {
      mediaRef.current.ondataavailable = null;
      mediaRef.current.onstop = null;
      mediaRef.current.stop();
    }
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  };

  if (recording) return (
    <div className="voice-recording">
      <span className="rec-dot">●</span>
      <span className="rec-time">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</span>
      <button className="btn-rec-cancel" onClick={cancel}>✕</button>
      <button className="btn-rec-send" onClick={stop}>✓</button>
    </div>
  );
  return <button className="btn-media" onClick={start} title="Vocal">🎤</button>;
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  const [mediaData, setMediaData] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!msg.mediaId) return;
    fetch(`/api/media?id=${msg.mediaId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d ? setMediaData(d) : setExpired(true))
      .catch(() => setExpired(true));
  }, [msg.mediaId]);

  return (
    <div className={`message-bubble ${isMine ? 'mine' : 'theirs'}`}>
      {msg.mediaId && (
        <div className="media-content">
          {expired && <span className="media-expired">⏱ Média expiré</span>}
          {mediaData?.type === 'image' && <img src={mediaData.data} alt="photo" className="msg-image" />}
          {mediaData?.type === 'audio' && <audio controls src={mediaData.data} className="msg-audio" />}
        </div>
      )}
      {msg.content && !['[📷 Photo]','[🎤 Vocal]'].includes(msg.content) && <p>{msg.content}</p>}
      <div className="msg-meta">
        <span className="msg-time">{timeAgo(msg.timestamp)}</span>
        {isMine && (
          <span className="msg-status">{msg.read ? '✓✓' : '✓'}</span>
        )}
      </div>
    </div>
  );
}

// ─── MESSAGES PANEL ───────────────────────────────────────────────────────────
function MessagesPanel({ username, initialContact, onClose, onUnreadChange }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(initialContact || null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [userSuggestions, setUserSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchConvs = async () => {
    try {
      const r = await fetch(`/api/conversations?user=${encodeURIComponent(username)}`);
      const data = await r.json();
      setConversations(data);
      onUnreadChange(data.reduce((s, c) => s + c.unread, 0));
    } catch (e) {}
  };

  const fetchMsgs = useCallback(async (contact) => {
    try {
      const r = await fetch(`/api/messages?user1=${encodeURIComponent(username)}&user2=${encodeURIComponent(contact)}`);
      const data = await r.json();
      setMessages(data);
      // Marquer comme lu
      await fetch('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: username, from: contact })
      });
      // Marquer les messages comme lus côté expéditeur
      await fetch('/api/messages', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reader: username, sender: contact })
      });
      fetchConvs();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {}
  }, [username]);

  useEffect(() => {
    fetchConvs();
    if (initialContact) fetchMsgs(initialContact);
    intervalRef.current = setInterval(() => {
      fetchConvs();
      if (activeConv) fetchMsgs(activeConv);
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => { if (activeConv) fetchMsgs(activeConv); }, [activeConv]);

  const searchUsers = async (q) => {
    if (!q.trim()) { setUserSuggestions([]); return; }
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setUserSuggestions(data.filter(u => u !== username));
    } catch (e) {}
  };

  const sendMsg = async (content, mediaId = null) => {
    if (!activeConv) return;
    await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: username, to: activeConv, content, mediaId })
    });
    fetchMsgs(activeConv);
  };

  const handleSend = async () => {
    if (!newMsg.trim()) return;
    await sendMsg(newMsg.trim());
    setNewMsg('');
  };

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const mediaId = `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mediaId, data: reader.result, type: 'image' })
      });
      await sendMsg('[📷 Photo]', mediaId);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleVoice = async (audioDataUrl) => {
    const mediaId = `m_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await fetch('/api/media', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mediaId, data: audioDataUrl, type: 'audio' })
    });
    await sendMsg('[🎤 Vocal]', mediaId);
  };

  const startConvWith = (user) => {
    setActiveConv(user);
    setSearchUser('');
    setUserSuggestions([]);
  };

  return (
    <div className="messages-panel">
      {/* SIDEBAR — masquée sur mobile quand une conv est ouverte */}
      <div className={`messages-sidebar ${activeConv ? 'hidden-mobile' : ''}`}>
        <div className="messages-header">
          <h2>✉️ Messages</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="new-conv">
          <div className="search-wrapper">
            <input placeholder="Chercher un pseudo..."
              value={searchUser}
              onChange={e => { setSearchUser(e.target.value); searchUsers(e.target.value); }}
              onKeyDown={e => e.key === 'Enter' && searchUser.trim() && startConvWith(searchUser.trim())}
            />
            {userSuggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {userSuggestions.map(u => (
                  <div key={u} className="suggestion-item" onClick={() => startConvWith(u)}>
                    👤 {u}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="conv-list">
          {conversations.length === 0 && <p className="empty-convs">Tape un pseudo pour démarrer</p>}
          {conversations.map(c => (
            <div key={c.contact} className={`conv-item ${activeConv === c.contact ? 'active' : ''}`}
              onClick={() => setActiveConv(c.contact)}>
              <span className="conv-name">{c.contact}</span>
              {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div className={`messages-main ${!activeConv ? 'hidden-mobile' : ''}`}>
        {!activeConv ? (
          <div className="no-conv">Sélectionne une conversation ou tape un pseudo</div>
        ) : (
          <>
            <div className="conv-header">
              <button className="btn-back" onClick={() => setActiveConv(null)}>←</button>
              <span>💬 {activeConv}</span>
              <span className="media-hint">Médias : 10min</span>
              <button className="btn-close-mobile" onClick={onClose}>✕</button>
            </div>
            <div className="messages-list">
              {messages.map(m => <MessageBubble key={m.id} msg={m} isMine={m.from === username} />)}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Écrire..." maxLength={500} />
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              <button className="btn-media" onClick={() => fileInputRef.current.click()}>📷</button>
              <VoiceRecorder onSend={handleVoice} />
              <button className="btn-send" onClick={handleSend}>→</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ onClose, channels }) {
  const [banned, setBanned] = useState([]);
  const [banInput, setBanInput] = useState('');
  const [banSuggestions, setBanSuggestions] = useState([]);
  const [newChannel, setNewChannel] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [channelList, setChannelList] = useState(channels);
  const [msg, setMsg] = useState('');

  const fetchBanned = async () => {
    const r = await fetch('/api/admin');
    const d = await r.json();
    setBanned(d.banned || []);
  };

  const fetchChannels = async () => {
    const r = await fetch('/api/channels');
    setChannelList(await r.json());
  };

  useEffect(() => { fetchBanned(); fetchChannels(); }, []);

  const searchUsers = async (q) => {
    if (!q.trim()) { setBanSuggestions([]); return; }
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      setBanSuggestions(await r.json());
    } catch (e) {}
  };

  const banUser = async (u) => {
    const target = u || banInput.trim();
    if (!target) return;
    await fetch('/api/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: target })
    });
    setMsg(`✅ ${target} banni`);
    setBanInput(''); setBanSuggestions([]);
    fetchBanned();
  };

  const unbanUser = async (u) => {
    await fetch('/api/admin', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u })
    });
    setMsg(`✅ ${u} débanni`);
    fetchBanned();
  };

  const createChannel = async () => {
    if (!newChannel.trim()) return;
    const r = await fetch('/api/channels', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newChannel.trim(), description: newChannelDesc.trim() })
    });
    if (r.ok) {
      setMsg(`✅ Salon #${newChannel} créé`);
      setNewChannel(''); setNewChannelDesc('');
      fetchChannels();
    } else {
      const d = await r.json();
      setMsg(`❌ ${d.error}`);
    }
  };

  const deleteChannel = async (id) => {
    if (!confirm(`Supprimer #${id} et tous ses messages ?`)) return;
    await fetch('/api/channels', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    setMsg(`✅ Salon supprimé`);
    fetchChannels();
  };

  return (
    <div className="admin-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>⚙️ Panel Admin</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        {msg && <div className="admin-msg">{msg}</div>}

        <div className="admin-section">
          <h3>📢 Salons</h3>
          <div className="admin-row">
            <input placeholder="Nom du salon" value={newChannel} onChange={e => setNewChannel(e.target.value)} />
            <input placeholder="Description (optionnel)" value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} />
            <button className="btn-primary" onClick={createChannel}>Créer</button>
          </div>
          <div className="admin-list">
            {channelList.map(c => (
              <div key={c.id} className="admin-list-item">
                <span># {c.name}</span>
                {c.description && <span className="admin-desc">{c.description}</span>}
                <button className="btn-danger" onClick={() => deleteChannel(c.id)}>Supprimer</button>
              </div>
            ))}
          </div>
        </div>

        <div className="admin-section">
          <h3>🚫 Bannir un utilisateur</h3>
          <div className="admin-row" style={{ position: 'relative' }}>
            <div className="search-wrapper" style={{ flex: 1 }}>
              <input placeholder="Pseudo à bannir" value={banInput}
                onChange={e => { setBanInput(e.target.value); searchUsers(e.target.value); }}
                onKeyDown={e => e.key === 'Enter' && banUser()} />
              {banSuggestions.length > 0 && (
                <div className="suggestions-dropdown">
                  {banSuggestions.map(u => (
                    <div key={u} className="suggestion-item" onClick={() => banUser(u)}>👤 {u}</div>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-danger" onClick={() => banUser()}>Bannir</button>
          </div>
          <div className="admin-list">
            {banned.length === 0 && <span className="empty-convs">Aucun utilisateur banni</span>}
            {banned.map(u => (
              <div key={u} className="admin-list-item">
                <span>🚫 {u}</span>
                <button className="btn-primary" onClick={() => unbanUser(u)}>Débannir</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, userId, username, isAdmin, onLike, onComment, onMessageUser, onDelete }) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const liked = post.likes.includes(userId);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    await onComment(post.id, commentText);
    setCommentText('');
  };

  return (
    <article className="post-card">
      <div className="post-header">
        <span className="post-avatar">{post.avatar}</span>
        <div style={{ flex: 1 }}>
          <span className="post-author">{post.author}</span>
          <span className="post-time">{timeAgo(post.timestamp)}</span>
        </div>
        {post.author !== username && (
          <button className="btn-dm" onClick={() => onMessageUser(post.author)}>✉️</button>
        )}
        {isAdmin && (
          <button className="btn-dm" onClick={() => onDelete(post.id)}>🗑️</button>
        )}
      </div>
      <p className="post-content">{post.content}</p>
      <div className="post-actions">
        <button className={`btn-action ${liked ? 'liked' : ''}`} onClick={() => onLike(post.id)}>♥ {post.likes.length}</button>
        <button className="btn-action" onClick={() => setShowComments(!showComments)}>💬 {post.comments.length}</button>
      </div>
      {showComments && (
        <div className="comments-section">
          {post.comments.map(c => (
            <div key={c.id} className="comment">
              <span className="comment-avatar">{c.avatar}</span>
              <div>
                <span className="comment-author">{c.author}</span>
                <span className="comment-text">{c.content}</span>
              </div>
            </div>
          ))}
          <div className="comment-input">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder="Commenter..." maxLength={200} />
            <button onClick={submitComment}>→</button>
          </div>
        </div>
      )}
    </article>
  );
}

// ─── SEARCH BAR WITH SUGGESTIONS ──────────────────────────────────────────────
function SearchBar({ onAdminCmd }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = async (q) => {
    setQuery(q);
    if (q === ADMIN_CMD) { onAdminCmd(); setQuery(''); return; }
    if (!q.trim()) { setSuggestions([]); return; }
    try {
      const r = await fetch(`/api/users?q=${encodeURIComponent(q)}`);
      setSuggestions(await r.json());
      setShow(true);
    } catch (e) {}
  };

  return (
    <div className="search-wrapper header-search" ref={ref}>
      <input
        className="search-input"
        placeholder="Rechercher un utilisateur..."
        value={query}
        onChange={e => search(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShow(true)}
      />
      {show && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map(u => (
            <div key={u} className="suggestion-item" onClick={() => { setQuery(u); setShow(false); }}>
              👤 {u}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState(true);
  const [banned, setBanned] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);

  const [showMessages, setShowMessages] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [dmTarget, setDmTarget] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  const intervalRef = useRef(null);

  useEffect(() => {
    const stored = localStorage.getItem('sn_user');
    if (stored) {
      const u = JSON.parse(stored);
      setUsername(u.name); setAvatar(u.avatar); setUserId(u.id); setSetup(false);
    } else {
      setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
      setUserId('u_' + Math.random().toString(36).slice(2));
    }
  }, []);

  const fetchChannels = async () => {
    try {
      const r = await fetch('/api/channels');
      const data = await r.json();
      setChannels(data);
      if (data.length > 0 && !activeChannel) setActiveChannel(data[0].id);
    } catch (e) {}
  };

  const fetchPosts = useCallback(async () => {
    if (!activeChannel) return;
    try {
      const r = await fetch(`/api/posts?channel=${encodeURIComponent(activeChannel)}`);
      setPosts(await r.json());
    } catch (e) {}
  }, [activeChannel]);

  const checkBan = async (name) => {
    try {
      const r = await fetch(`/api/checkban?username=${encodeURIComponent(name)}`);
      const d = await r.json();
      setBanned(d.banned);
    } catch (e) { setBanned(false); }
  };

  // Enregistrer le user dans la liste
  const registerUser = async (name) => {
    try {
      await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name })
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (!setup && username) {
      fetchChannels();
      checkBan(username);
      registerUser(username);
    }
  }, [setup, username]);

  useEffect(() => {
    if (!setup && activeChannel) {
      fetchPosts();
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(fetchPosts, 5000);
      return () => clearInterval(intervalRef.current);
    }
  }, [setup, activeChannel, fetchPosts]);

  const handleSetup = () => {
    if (!username.trim()) return;
    const user = { name: username.trim(), avatar, id: userId };
    localStorage.setItem('sn_user', JSON.stringify(user));
    setSetup(false);
  };

  const handlePost = async () => {
    if (!newPost.trim() || loading || banned || !activeChannel) return;
    setLoading(true);
    await fetch('/api/posts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username, avatar, content: newPost, channel: activeChannel })
    });
    setNewPost(''); await fetchPosts(); setLoading(false);
  };

  const handleLike = async (postId) => {
    await fetch('/api/like', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userId, channel: activeChannel })
    });
    await fetchPosts();
  };

  const handleComment = async (postId, content) => {
    await fetch('/api/comment', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, author: username, avatar, content, channel: activeChannel })
    });
    await fetchPosts();
  };

  const handleDelete = async (postId) => {
    await fetch('/api/posts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, channel: activeChannel })
    });
    await fetchPosts();
  };

  if (setup) return (
    <>
      <Head><title>Agora</title></Head>
      <div className="setup-screen">
        <div className="setup-card">
          <h1>🌐 Agora</h1>
          <p>Réseau social libre & décentralisé</p>
          <div className="avatar-preview">{avatar}</div>
          <div className="avatar-picker">
            {AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} className={a === avatar ? 'selected' : ''}>{a}</button>)}
          </div>
          <input placeholder="Ton pseudo..." value={username} onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSetup()} maxLength={30} autoFocus />
          <button className="btn-primary" onClick={handleSetup}>Rejoindre →</button>
        </div>
      </div>
      <style jsx global>{styles}</style>
    </>
  );

  if (banned) return (
    <>
      <Head><title>Agora — Accès refusé</title></Head>
      <div className="setup-screen">
        <div className="setup-card">
          <h1>🚫</h1>
          <p style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>Ton compte a été banni.</p>
        </div>
      </div>
      <style jsx global>{styles}</style>
    </>
  );

  const currentChannel = channels.find(c => c.id === activeChannel);

  return (
    <>
      <Head><title>Agora — {username}</title></Head>
      <div className="app">
        <header>
          <div className="header-inner">
            <button className="btn-hamburger" onClick={() => setShowSidebar(!showSidebar)}>☰</button>
            <h1>🌐 Agora</h1>
            <SearchBar onAdminCmd={() => { setIsAdmin(true); setShowAdmin(true); }} />
            <div className="header-right">
              <button className="btn-messages" onClick={() => { setDmTarget(null); setShowMessages(true); }}>
                ✉️ {totalUnread > 0 && <span className="notif-dot">{totalUnread}</span>}
              </button>
              {isAdmin && <button className="btn-admin" onClick={() => setShowAdmin(true)}>⚙️</button>}
              <span className="user-badge">{avatar} <span className="username-text">{username}</span></span>
            </div>
          </div>
        </header>

        <div className="layout">
          {/* SIDEBAR */}
          <aside className={`sidebar ${showSidebar ? 'sidebar-open' : ''}`}>
            <div className="sidebar-title">Salons</div>
            {channels.length === 0 && <p className="empty-channels">Aucun salon.<br/>L'admin doit en créer.</p>}
            {channels.map(c => (
              <button key={c.id} className={`channel-btn ${activeChannel === c.id ? 'active' : ''}`}
                onClick={() => { setActiveChannel(c.id); setShowSidebar(false); }}>
                # {c.name}
                {c.description && <span className="channel-desc">{c.description}</span>}
              </button>
            ))}
          </aside>

          {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

          {/* FEED */}
          <main>
            {!activeChannel || channels.length === 0 ? (
              <div className="empty">Aucun salon disponible.<br/>L'admin doit en créer via ⚙️</div>
            ) : (
              <>
                <div className="channel-header-bar">
                  <span># {currentChannel?.name}</span>
                  {currentChannel?.description && <span className="channel-header-desc">{currentChannel.description}</span>}
                </div>
                <div className="compose-box">
                  <span className="compose-avatar">{avatar}</span>
                  <div className="compose-right">
                    <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
                      placeholder={`Message dans #${currentChannel?.name}...`}
                      maxLength={500} rows={3}
                      onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handlePost()} />
                    <div className="compose-footer">
                      <span className="char-count">{newPost.length}/500</span>
                      <button className="btn-primary" onClick={handlePost} disabled={!newPost.trim() || loading}>
                        {loading ? '...' : 'Publier'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="feed">
                  {posts.length === 0 && <div className="empty">Aucun message dans ce salon.</div>}
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} userId={userId} username={username} isAdmin={isAdmin}
                      onLike={handleLike} onComment={handleComment}
                      onMessageUser={(u) => { setDmTarget(u); setShowMessages(true); }}
                      onDelete={handleDelete} />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        {showMessages && (
          <div className="messages-overlay" onClick={e => e.target === e.currentTarget && setShowMessages(false)}>
            <MessagesPanel username={username} initialContact={dmTarget}
              onUnreadChange={setTotalUnread}
              onClose={() => { setShowMessages(false); setDmTarget(null); }} />
          </div>
        )}

        {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} channels={channels} />}
      </div>
      <style jsx global>{styles}</style>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg: #0a0a0f; --surface: #12121a; --border: #1e1e2e; --accent: #00e5a0; --text: #e8e8f0; --muted: #6b6b80; --danger: #ff4d6d; --header-h: 56px; }
  body { background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', sans-serif; min-height: 100vh; }

  /* SETUP */
  .setup-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 0%, #0d2018 0%, var(--bg) 70%); padding: 20px; }
  .setup-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 40px 32px; width: 100%; max-width: 400px; text-align: center; display: flex; flex-direction: column; gap: 18px; }
  .setup-card h1 { font-family: 'IBM Plex Mono', monospace; font-size: 2rem; color: var(--accent); }
  .setup-card p { color: var(--muted); font-size: 0.9rem; }
  .avatar-preview { font-size: 3rem; height: 60px; display: flex; align-items: center; justify-content: center; }
  .avatar-picker { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .avatar-picker button { background: var(--border); border: 2px solid transparent; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 1.2rem; transition: all 0.15s; }
  .avatar-picker button:hover { border-color: var(--accent); }
  .avatar-picker button.selected { border-color: var(--accent); background: #0d2018; }

  input, textarea { width: 100%; background: var(--border); border: 1px solid #2a2a3e; border-radius: 8px; padding: 10px 14px; color: var(--text); font-family: 'IBM Plex Sans', sans-serif; font-size: 0.95rem; transition: border-color 0.2s; resize: none; }
  input:focus, textarea:focus { outline: none; border-color: var(--accent); }
  .btn-primary { background: var(--accent); color: #0a0a0f; border: none; border-radius: 8px; padding: 10px 22px; font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .btn-primary:hover { background: #00ffa8; }
  .btn-primary:disabled { opacity: 0.5; cursor: default; }
  .btn-danger { background: var(--danger); color: white; border: none; border-radius: 8px; padding: 6px 14px; font-size: 0.82rem; cursor: pointer; white-space: nowrap; }
  .btn-danger:hover { opacity: 0.85; }

  /* HEADER */
  header { position: sticky; top: 0; z-index: 100; background: rgba(10,10,15,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); height: var(--header-h); }
  .header-inner { max-width: 1100px; margin: 0 auto; padding: 0 16px; height: 100%; display: flex; align-items: center; gap: 12px; }
  header h1 { font-family: 'IBM Plex Mono', monospace; font-size: 1.1rem; color: var(--accent); white-space: nowrap; }
  .btn-hamburger { background: none; border: none; color: var(--muted); font-size: 1.3rem; cursor: pointer; padding: 4px; display: none; flex-shrink: 0; }
  .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; }
  .user-badge { background: var(--border); border-radius: 20px; padding: 5px 12px; font-size: 0.82rem; color: var(--muted); white-space: nowrap; }
  .btn-messages { position: relative; background: var(--border); border: 1px solid #2a2a3e; border-radius: 20px; padding: 5px 12px; font-size: 1rem; cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
  .btn-messages:hover { border-color: var(--accent); }
  .btn-admin { background: var(--border); border: 1px solid #2a2a3e; border-radius: 20px; padding: 5px 12px; font-size: 1rem; cursor: pointer; }
  .notif-dot { position: absolute; top: -4px; right: -4px; background: var(--danger); color: white; border-radius: 10px; padding: 1px 5px; font-size: 0.68rem; font-weight: 600; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }

  /* SEARCH */
  .search-wrapper { position: relative; flex: 1; }
  .header-search { max-width: 320px; }
  .search-input { padding: 8px 12px; font-size: 0.85rem; }
  .suggestions-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; z-index: 50; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .suggestion-item { padding: 10px 14px; cursor: pointer; font-size: 0.88rem; transition: background 0.15s; }
  .suggestion-item:hover { background: var(--border); color: var(--accent); }

  /* LAYOUT */
  .layout { max-width: 1100px; margin: 0 auto; display: flex; min-height: calc(100vh - var(--header-h)); }

  /* SIDEBAR */
  .sidebar { width: 210px; flex-shrink: 0; border-right: 1px solid var(--border); padding: 14px 0; display: flex; flex-direction: column; gap: 2px; position: sticky; top: var(--header-h); height: calc(100vh - var(--header-h)); overflow-y: auto; }
  .sidebar-title { padding: 0 14px 10px; font-size: 0.7rem; font-family: 'IBM Plex Mono', monospace; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }
  .channel-btn { background: none; border: none; text-align: left; padding: 8px 14px; color: var(--muted); cursor: pointer; border-radius: 6px; margin: 0 6px; transition: all 0.15s; display: flex; flex-direction: column; gap: 2px; font-size: 0.88rem; }
  .channel-btn:hover { background: var(--surface); color: var(--text); }
  .channel-btn.active { background: #0d2018; color: var(--accent); }
  .channel-desc { font-size: 0.7rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .empty-channels { padding: 14px; color: var(--muted); font-size: 0.8rem; text-align: center; line-height: 1.5; }
  .sidebar-overlay { display: none; }

  /* MAIN */
  main { flex: 1; padding: 18px; overflow-y: auto; min-width: 0; }
  .channel-header-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
  .channel-header-bar span:first-child { font-family: 'IBM Plex Mono', monospace; font-size: 0.95rem; font-weight: 600; }
  .channel-header-desc { font-size: 0.8rem; color: var(--muted); }
  .compose-box { display: flex; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 16px; }
  .compose-avatar { font-size: 1.4rem; flex-shrink: 0; padding-top: 2px; }
  .compose-right { flex: 1; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .compose-footer { display: flex; justify-content: space-between; align-items: center; }
  .char-count { font-size: 0.76rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
  .feed { display: flex; flex-direction: column; gap: 10px; }
  .empty { text-align: center; color: var(--muted); padding: 40px; line-height: 2; }

  /* POST */
  .post-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
  .post-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .post-avatar { font-size: 1.3rem; }
  .post-author { font-weight: 600; font-size: 0.86rem; display: block; }
  .post-time { color: var(--muted); font-size: 0.73rem; font-family: 'IBM Plex Mono', monospace; }
  .post-content { font-size: 0.9rem; line-height: 1.6; margin-bottom: 12px; white-space: pre-wrap; word-break: break-word; }
  .post-actions { display: flex; gap: 8px; }
  .btn-action { background: none; border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; color: var(--muted); font-size: 0.8rem; cursor: pointer; transition: all 0.15s; font-family: 'IBM Plex Mono', monospace; }
  .btn-action:hover { border-color: var(--accent); color: var(--accent); }
  .btn-action.liked { border-color: var(--danger); color: var(--danger); }
  .btn-dm { background: none; border: none; font-size: 1rem; cursor: pointer; opacity: 0.4; transition: opacity 0.15s; padding: 3px; }
  .btn-dm:hover { opacity: 1; }
  .comments-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 8px; }
  .comment { display: flex; gap: 6px; }
  .comment-avatar { font-size: 0.95rem; flex-shrink: 0; }
  .comment-author { font-weight: 600; font-size: 0.78rem; margin-right: 5px; color: var(--accent); }
  .comment-text { font-size: 0.83rem; }
  .comment-input { display: flex; gap: 6px; margin-top: 4px; }
  .comment-input input { flex: 1; padding: 7px 10px; font-size: 0.82rem; }
  .comment-input button { background: var(--accent); border: none; border-radius: 6px; color: var(--bg); padding: 0 12px; cursor: pointer; font-weight: bold; }

  /* MESSAGES */
  .messages-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.7); display: flex; justify-content: flex-end; animation: fadeIn 0.2s; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .messages-panel { display: flex; width: 100%; max-width: 680px; height: 100vh; background: var(--bg); border-left: 1px solid var(--border); animation: slideIn 0.2s; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .messages-sidebar { width: 220px; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
  .messages-header { padding: 14px 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .messages-header h2 { font-size: 0.92rem; font-family: 'IBM Plex Mono', monospace; color: var(--accent); }
  .btn-close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; }
  .new-conv { padding: 10px; border-bottom: 1px solid var(--border); }
  .conv-list { flex: 1; overflow-y: auto; }
  .empty-convs { padding: 14px; color: var(--muted); font-size: 0.78rem; text-align: center; line-height: 1.5; display: block; }
  .conv-item { padding: 12px 14px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); transition: background 0.15s; }
  .conv-item:hover { background: var(--surface); }
  .conv-item.active { background: #0d2018; border-left: 3px solid var(--accent); }
  .conv-name { font-size: 0.86rem; font-weight: 500; }
  .unread-badge { background: var(--danger); color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.68rem; font-weight: 600; }
  .messages-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .no-conv { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.86rem; text-align: center; padding: 20px; }
  .conv-header { padding: 12px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; font-weight: 600; flex-shrink: 0; font-size: 0.92rem; }
  .btn-back { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; }
  .btn-close-mobile { display: none; background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1rem; margin-left: auto; }
  .media-hint { font-size: 0.68rem; color: var(--muted); font-weight: 400; font-family: 'IBM Plex Mono', monospace; }
  .messages-list { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
  .message-bubble { max-width: 78%; padding: 9px 12px; border-radius: 12px; }
  .message-bubble.mine { align-self: flex-end; background: #0d2018; border: 1px solid var(--accent); border-bottom-right-radius: 4px; }
  .message-bubble.theirs { align-self: flex-start; background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .message-bubble p { font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
  .msg-meta { display: flex; align-items: center; justify-content: flex-end; gap: 5px; margin-top: 3px; }
  .msg-time { font-size: 0.68rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
  .msg-status { font-size: 0.72rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
  .message-bubble.mine .msg-status { color: var(--accent); }
  .media-content { margin-bottom: 5px; }
  .msg-image { max-width: 200px; max-height: 200px; border-radius: 8px; display: block; object-fit: cover; }
  .msg-audio { width: 180px; height: 34px; }
  .media-expired { font-size: 0.76rem; color: var(--muted); font-style: italic; }
  .message-input { padding: 10px 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .message-input input { flex: 1; padding: 9px 12px; min-width: 0; }
  .btn-send { background: var(--accent); border: none; border-radius: 8px; color: var(--bg); padding: 0 14px; height: 38px; cursor: pointer; font-weight: bold; font-size: 1rem; flex-shrink: 0; }
  .btn-media { background: var(--border); border: 1px solid #2a2a3e; border-radius: 8px; padding: 0 9px; height: 38px; cursor: pointer; font-size: 1rem; flex-shrink: 0; }
  .btn-media:hover { border-color: var(--accent); }
  .voice-recording { display: flex; align-items: center; gap: 5px; background: #1a0a0a; border: 1px solid var(--danger); border-radius: 8px; padding: 5px 8px; flex-shrink: 0; }
  .rec-dot { color: var(--danger); font-size: 0.65rem; animation: pulse 1s infinite; }
  .rec-time { font-family: 'IBM Plex Mono', monospace; font-size: 0.8rem; color: var(--danger); min-width: 32px; }
  .btn-rec-cancel { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.82rem; }
  .btn-rec-send { background: var(--accent); border: none; border-radius: 5px; color: var(--bg); padding: 2px 7px; cursor: pointer; font-weight: bold; }

  /* ADMIN */
  .admin-overlay { position: fixed; inset: 0; z-index: 300; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s; padding: 16px; }
  .admin-panel { background: var(--bg); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 540px; max-height: 85vh; overflow-y: auto; }
  .admin-header { padding: 16px 22px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--bg); }
  .admin-header h2 { font-family: 'IBM Plex Mono', monospace; color: var(--accent); font-size: 0.95rem; }
  .admin-msg { margin: 10px 22px; padding: 9px 13px; background: var(--surface); border-radius: 8px; font-size: 0.83rem; color: var(--accent); }
  .admin-section { padding: 16px 22px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
  .admin-section h3 { font-size: 0.85rem; font-family: 'IBM Plex Mono', monospace; color: var(--muted); }
  .admin-row { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
  .admin-row input { flex: 1; min-width: 120px; padding: 8px 12px; font-size: 0.85rem; }
  .admin-list { display: flex; flex-direction: column; gap: 6px; }
  .admin-list-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface); border-radius: 8px; padding: 8px 12px; font-size: 0.83rem; }
  .admin-desc { color: var(--muted); font-size: 0.76rem; flex: 1; }

  /* MOBILE */
  @media (max-width: 768px) {
    .btn-hamburger { display: flex; }
    .header-search { max-width: 160px; }
    .username-text { display: none; }

    .sidebar { position: fixed; top: var(--header-h); left: 0; height: calc(100vh - var(--header-h)); z-index: 90; background: var(--bg); transform: translateX(-100%); transition: transform 0.25s; width: 240px; }
    .sidebar.sidebar-open { transform: translateX(0); }
    .sidebar-overlay { display: block; position: fixed; inset: 0; top: var(--header-h); z-index: 89; background: rgba(0,0,0,0.5); }

    .layout { flex-direction: column; }
    main { padding: 12px; }

    /* Messages - plein écran sur mobile */
    .messages-overlay { background: none; }
    .messages-panel { max-width: 100%; border-left: none; flex-direction: column; }
    .messages-sidebar { width: 100%; height: 100vh; border-right: none; flex-shrink: 0; }
    .messages-sidebar.hidden-mobile { display: none; }
    .messages-main { width: 100%; height: 100vh; }
    .messages-main.hidden-mobile { display: none; }
    .btn-close-mobile { display: block; }
    .media-hint { display: none; }
    .message-bubble { max-width: 85%; }
  }

  @media (max-width: 480px) {
    .setup-card { padding: 28px 18px; }
    .header-search { display: none; }
    .message-bubble { max-width: 88%; }
    .msg-image { max-width: 160px; max-height: 160px; }
    .msg-audio { width: 150px; }
  }
`;