import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';

const AVATARS = ['🦁','🐺','🦊','🐻','🐼','🦅','🐬','🦋','🌙','⚡','🔥','🌿','💎','🎭','🚀'];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return il y a ${m}min;
  const h = Math.floor(m / 60);
  if (h < 24) return il y a ${h}h;
  return il y a ${Math.floor(h / 24)}j;
}

// ─── POST CARD ────────────────────────────────────────────────────────────────
function PostCard({ post, userId, username, onLike, onComment, onMessageUser }) {
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
          <button className="btn-dm" onClick={() => onMessageUser(post.author)} title="Message privé">✉️</button>
        )}
      </div>
      <p className="post-content">{post.content}</p>
      <div className="post-actions">
        <button className={btn-action ${liked ? 'liked' : ''}} onClick={() => onLike(post.id)}>♥ {post.likes.length}</button>
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
              onKeyDown={e => e.key === 'Enter' && submitComment()} placeholder="Écrire un commentaire..." maxLength={200} />
            <button onClick={submitComment}>→</button>
          </div>
        </div>
      )}
    </article>
  );
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
        reader.onload = () => onSend(reader.result, blob.size);
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } catch (e) {
      alert('Micro non disponible');
    }
  };

  const stop = () => {
    if (mediaRef.current) mediaRef.current.stop();
    clearInterval(timerRef.current);
    setRecording(false);
    setSeconds(0);
  };
✦✦✦✦✦✦✦✦✦✦✦

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
      <button className="btn-rec-cancel" onClick={cancel} title="Annuler">✕</button>
      <button className="btn-rec-send" onClick={stop} title="Envoyer">✓</button>
    </div>
  );

  return (
    <button className="btn-media" onClick={start} title="Message vocal">🎤</button>
  );
}

// ─── MESSAGE BUBBLE ───────────────────────────────────────────────────────────
function MessageBubble({ msg, isMine }) {
  const [mediaData, setMediaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  const loadMedia = async () => {
    if (!msg.mediaId  expired) return;
    setLoading(true);
    try {
      const r = await fetch(/api/media?id=${msg.mediaId});
      if (r.status === 404) { setExpired(true); setLoading(false); return; }
      const data = await r.json();
      setMediaData(data);
    } catch (e) { setExpired(true); }
    setLoading(false);
  };

  useEffect(() => {
    if (msg.mediaId) loadMedia();
  }, [msg.mediaId]);

  return (
    <div className={message-bubble ${isMine ? 'mine' : 'theirs'}}>
      {msg.mediaId && (
        <div className="media-content">
          {loading && <span className="media-loading">Chargement...</span>}
          {expired && <span className="media-expired">⏱ Média expiré</span>}
          {mediaData && mediaData.type === 'image' && (
            <img src={mediaData.data} alt="photo" className="msg-image" />
          )}
          {mediaData && mediaData.type === 'audio' && (
            <audio controls src={mediaData.data} className="msg-audio" />
          )}
        </div>
      )}
      {msg.content && msg.content !== '[📷 Photo]' && msg.content !== '[🎤 Vocal]' && (
        <p>{msg.content}</p>
      )}
      <span className="msg-time">{timeAgo(msg.timestamp)}</span>
    </div>
  );
}

// ─── MESSAGES PANEL ───────────────────────────────────────────────────────────
function MessagesPanel({ username, initialContact, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(initialContact || null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const messagesEndRef = useRef(null);
  const intervalRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchConversations = async () => {
    try {
      const r = await fetch(/api/conversations?user=${encodeURIComponent(username)});
      setConversations(await r.json());
    } catch (e) {}
  };

  const fetchMessages = useCallback(async (contact) => {
    try {
      const r = await fetch(/api/messages?user1=${encodeURIComponent(username)}&user2=${encodeURIComponent(contact)});
      setMessages(await r.json());
      await fetch('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: username, from: contact })
      });
      fetchConversations();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {}
  }, [username]);

  useEffect(() => {
    fetchConversations();
    if (initialContact) fetchMessages(initialContact);
    intervalRef.current = setInterval(() => {
      fetchConversations();
      if (activeConv) fetchMessages(activeConv);
    }, 3000);
    return () => clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (activeConv) fetchMessages(activeConv);
  }, [activeConv]);
✦✦✦✦✦✦✦✦✦✦✦

const sendTextMessage = async (content, mediaId = null, mediaLabel = null) => {
    if (!activeConv) return;
    await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: username, to: activeConv, content: mediaLabel || content, mediaId })
    });
    fetchMessages(activeConv);
  };

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConv) return;
    await sendTextMessage(newMsg);
    setNewMsg('');
  };

  // Upload photo
  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Photo trop lourde (max 5MB)'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const mediaId = media_${Date.now()}_${Math.random().toString(36).slice(2)};
      await fetch('/api/media', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: mediaId, data: reader.result, type: 'image' })
      });
      await sendTextMessage('', mediaId, '[📷 Photo]');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Send voice
  const handleVoice = async (audioDataUrl) => {
    const mediaId = media_${Date.now()}_${Math.random().toString(36).slice(2)};
    await fetch('/api/media', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: mediaId, data: audioDataUrl, type: 'audio' })
    });
    await sendTextMessage('', mediaId, '[🎤 Vocal]');
  };

  const startNewConv = () => {
    if (!searchUser.trim() || searchUser.trim() === username) return;
    setActiveConv(searchUser.trim());
    setSearchUser('');
  };

  return (
    <div className="messages-panel">
      <div className="messages-sidebar">
        <div className="messages-header">
          <h2>✉️ Messages</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        <div className="new-conv">
          <input placeholder="Taper un pseudo..." value={searchUser}
            onChange={e => setSearchUser(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startNewConv()} />
          <button onClick={startNewConv}>→</button>
        </div>
        <div className="conv-list">
          {conversations.length === 0 && <p className="empty-convs">Tape un pseudo pour démarrer</p>}
          {conversations.map(c => (
            <div key={c.contact} className={conv-item ${activeConv === c.contact ? 'active' : ''}}
              onClick={() => setActiveConv(c.contact)}>
              <span className="conv-name">{c.contact}</span>
              {c.unread > 0 && <span className="unread-badge">{c.unread}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="messages-main">
        {!activeConv ? (
          <div className="no-conv">Sélectionne une conversation ou tape un pseudo</div>
        ) : (
          <>
            <div className="conv-header">
              <button className="btn-back" onClick={() => setActiveConv(null)}>←</button>
              <span>💬 {activeConv}</span>
              <span className="media-hint">Les médias s'effacent après 10min</span>
            </div>
            <div className="messages-list">
              {messages.map(m => (
                <MessageBubble key={m.id} msg={m} isMine={m.from === username} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="message-input">
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Écrire un message..."

maxLength={500}
              />
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
              <button className="btn-media" onClick={() => fileInputRef.current.click()} title="Photo">📷</button>
              <VoiceRecorder onSend={handleVoice} />
              <button className="btn-send" onClick={handleSend}>→</button>
            </div>
          </>
        )}
      </div>
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
  const [showMessages, setShowMessages] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [dmTarget, setDmTarget] = useState(null);
  const intervalRef = useRef(null);
  const unreadRef = useRef(null);

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

  const fetchPosts = async () => {
    try { const r = await fetch('/api/posts'); setPosts(await r.json()); } catch (e) {}
  };

  const fetchUnread = async (name) => {
    try {
      const r = await fetch(/api/conversations?user=${encodeURIComponent(name)});
      const data = await r.json();
      setTotalUnread(data.reduce((s, c) => s + c.unread, 0));
    } catch (e) {}
  };

  useEffect(() => {
    if (!setup && username) {
      fetchPosts(); fetchUnread(username);
      intervalRef.current = setInterval(fetchPosts, 5000);
      unreadRef.current = setInterval(() => fetchUnread(username), 5000);
      return () => { clearInterval(intervalRef.current); clearInterval(unreadRef.current); };
    }
  }, [setup, username]);

  const handleSetup = () => {
    if (!username.trim()) return;
    const user = { name: username.trim(), avatar, id: userId };
    localStorage.setItem('sn_user', JSON.stringify(user));
    setSetup(false);
  };

  const handlePost = async () => {
    if (!newPost.trim() || loading) return;
    setLoading(true);
    await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username, avatar, content: newPost }) });
    setNewPost(''); await fetchPosts(); setLoading(false);
  };

  const handleLike = async (postId) => {
    await fetch('/api/like', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userId }) });
    await fetchPosts();
  };

  const handleComment = async (postId, content) => {
    await fetch('/api/comment', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, author: username, avatar, content }) });
    await fetchPosts();
  };

  if (setup) return (
    <>
      <Head><title>Agora — Réseau Libre</title></Head>
      <div className="setup-screen">
        <div className="setup-card">
          <h1>🌐 Agora</h1>
          <p>Réseau social libre & décentralisé</p>
          <div className="avatar-preview">{avatar}</div>
          <div className="avatar-picker">
            {AVATARS.map(a => <button key={a} onClick={() => setAvatar(a)} className={a === avatar ? 'selected' : ''}>{a}</button>)}
          </div>
          <input placeholder="Ton pseudo..." value={username} onChange={e => setUsername(e.target.value)}
✦✦✦✦✦✦✦✦✦✦✦

onKeyDown={e => e.key === 'Enter' && handleSetup()} maxLength={30} autoFocus />
          <button className="btn-primary" onClick={handleSetup}>Rejoindre →</button>
        </div>
      </div>
      <style jsx global>{styles}</style>
    </>
  );

  return (
    <>
      <Head><title>Agora — {username}</title></Head>
      <div className="app">
        <header>
          <div className="header-inner">
            <h1>🌐 Agora</h1>
            <div className="header-right">
              <button className="btn-messages" onClick={() => { setDmTarget(null); setShowMessages(true); }}>
                ✉️ {totalUnread > 0 && <span className="notif-dot">{totalUnread}</span>}
              </button>
              <span className="user-badge">{avatar} {username}</span>
            </div>
          </div>
        </header>
        <main>
          <div className="compose-box">
            <span className="compose-avatar">{avatar}</span>
            <div className="compose-right">
              <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
                placeholder="Qu'est-ce qui se passe ?" maxLength={500} rows={3}
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
            {posts.length === 0 && <div className="empty">Aucun message pour l'instant.</div>}
            {posts.map(post => (
              <PostCard key={post.id} post={post} userId={userId} username={username}
                onLike={handleLike} onComment={handleComment}
                onMessageUser={(u) => { setDmTarget(u); setShowMessages(true); }} />
            ))}
          </div>
        </main>
        {showMessages && (
          <div className="messages-overlay" onClick={e => e.target === e.currentTarget && setShowMessages(false)}>
            <MessagesPanel username={username} initialContact={dmTarget}
              onClose={() => { setShowMessages(false); setDmTarget(null); fetchUnread(username); }} />
          </div>
        )}
      </div>
      <style jsx global>{styles}</style>
    </>
  );
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg: #0a0a0f; --surface: #12121a; --border: #1e1e2e; --accent: #00e5a0; --text: #e8e8f0; --muted: #6b6b80; --danger: #ff4d6d; }
  body { background: var(--bg); color: var(--text); font-family: 'IBM Plex Sans', sans-serif; min-height: 100vh; }

  .setup-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 0%, #0d2018 0%, var(--bg) 70%); }
  .setup-card { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 48px 40px; width: 100%; max-width: 400px; text-align: center; display: flex; flex-direction: column; gap: 20px; }
  .setup-card h1 { font-family: 'IBM Plex Mono', monospace; font-size: 2rem; color: var(--accent); }
  .setup-card p { color: var(--muted); font-size: 0.9rem; }
  .avatar-preview { font-size: 3rem; height: 64px; display: flex; align-items: center; justify-content: center; }
  .avatar-picker { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .avatar-picker button { background: var(--border); border: 2px solid transparent; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 1.2rem; transition: all 0.15s; }
  .avatar-picker button:hover { border-color: var(--accent); }
  .avatar-picker button.selected { border-color: var(--accent); background: #0d2018; }

input, textarea { width: 100%; background: var(--border); border: 1px solid #2a2a3e; border-radius: 8px; padding: 12px 16px; color: var(--text); font-family: 'IBM Plex Sans', sans-serif; font-size: 0.95rem; transition: border-color 0.2s; resize: none; }
  input:focus, textarea:focus { outline: none; border-color: var(--accent); }
  .btn-primary { background: var(--accent); color: #0a0a0f; border: none; border-radius: 8px; padding: 12px 28px; font-family: 'IBM Plex Mono', monospace; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
  .btn-primary:hover { background: #00ffa8; transform: translateY(-1px); }
  .btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; }

  header { position: sticky; top: 0; z-index: 100; background: rgba(10,10,15,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
  .header-inner { max-width: 640px; margin: 0 auto; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-family: 'IBM Plex Mono', monospace; font-size: 1.3rem; color: var(--accent); }
  .header-right { display: flex; align-items: center; gap: 12px; }
  .user-badge { background: var(--border); border-radius: 20px; padding: 6px 14px; font-size: 0.85rem; color: var(--muted); }
  .btn-messages { position: relative; background: var(--border); border: 1px solid #2a2a3e; border-radius: 20px; padding: 6px 14px; font-size: 1.1rem; cursor: pointer; transition: all 0.15s; }
  .btn-messages:hover { border-color: var(--accent); }
  .notif-dot { position: absolute; top: -4px; right: -4px; background: var(--danger); color: white; border-radius: 10px; padding: 1px 5px; font-size: 0.7rem; font-weight: 600; animation: pulse 1.5s infinite; }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.2); } }

  main { max-width: 640px; margin: 0 auto; padding: 24px 20px; }
  .compose-box { display: flex; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 24px; }
  .compose-avatar { font-size: 1.6rem; flex-shrink: 0; padding-top: 4px; }
  .compose-right { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .compose-footer { display: flex; justify-content: space-between; align-items: center; }
  .char-count { font-size: 0.8rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }
  .feed { display: flex; flex-direction: column; gap: 12px; }
  .empty { text-align: center; color: var(--muted); padding: 40px; }

  .post-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; transition: border-color 0.2s; }
  .post-card:hover { border-color: #2a2a3e; }
  .post-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .post-avatar { font-size: 1.5rem; }
  .post-author { font-weight: 600; font-size: 0.9rem; display: block; }
  .post-time { color: var(--muted); font-size: 0.78rem; font-family: 'IBM Plex Mono', monospace; }
  .post-content { font-size: 0.95rem; line-height: 1.6; margin-bottom: 14px; white-space: pre-wrap; word-break: break-word; }
  .post-actions { display: flex; gap: 12px; }
  .btn-action { background: none; border: 1px solid var(--border); border-radius: 20px; padding: 5px 14px; color: var(--muted); font-size: 0.85rem; cursor: pointer; transition: all 0.15s; font-family: 'IBM Plex Mono', monospace; }
  .btn-action:hover { border-color: var(--accent); color: var(--accent); }
  .btn-action.liked { border-color: var(--danger); color: var(--danger); }
  .btn-dm { background: none; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.4; transition: opacity 0.15s; padding: 4px; }
  .btn-dm:hover { opacity: 1; }
  .comments-section { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }

.comment { display: flex; gap: 8px; }
  .comment-avatar { font-size: 1.1rem; flex-shrink: 0; }
  .comment-author { font-weight: 600; font-size: 0.82rem; margin-right: 6px; color: var(--accent); }
  .comment-text { font-size: 0.88rem; }
  .comment-input { display: flex; gap: 8px; margin-top: 4px; }
  .comment-input input { flex: 1; padding: 8px 12px; font-size: 0.85rem; }
  .comment-input button { background: var(--accent); border: none; border-radius: 8px; color: var(--bg); font-size: 1rem; padding: 0 14px; cursor: pointer; font-weight: bold; }

  .messages-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.7); display: flex; align-items: stretch; justify-content: flex-end; animation: fadeIn 0.2s; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .messages-panel { display: flex; width: 100%; max-width: 700px; height: 100vh; background: var(--bg); border-left: 1px solid var(--border); animation: slideIn 0.2s; }
  @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

  .messages-sidebar { width: 240px; border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
  .messages-header { padding: 16px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .messages-header h2 { font-size: 1rem; font-family: 'IBM Plex Mono', monospace; color: var(--accent); }
  .btn-close { background: none; border: none; color: var(--muted); font-size: 1.1rem; cursor: pointer; }
  .new-conv { padding: 12px; border-bottom: 1px solid var(--border); display: flex; gap: 6px; }
  .new-conv input { flex: 1; padding: 8px 10px; font-size: 0.85rem; }
  .new-conv button { background: var(--accent); border: none; border-radius: 6px; color: var(--bg); padding: 0 10px; cursor: pointer; font-weight: bold; }
  .conv-list { flex: 1; overflow-y: auto; }
  .empty-convs { padding: 20px; color: var(--muted); font-size: 0.82rem; text-align: center; line-height: 1.5; }
  .conv-item { padding: 14px 16px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); transition: background 0.15s; }
  .conv-item:hover { background: var(--surface); }
  .conv-item.active { background: #0d2018; border-left: 3px solid var(--accent); }
  .conv-name { font-size: 0.9rem; font-weight: 500; }
  .unread-badge { background: var(--danger); color: white; border-radius: 10px; padding: 2px 7px; font-size: 0.72rem; font-weight: 600; }

  .messages-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .no-conv { flex: 1; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 0.9rem; text-align: center; padding: 20px; }
  .conv-header { padding: 12px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 0.95rem; flex-shrink: 0; }
  .btn-back { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 1.1rem; }
  .media-hint { margin-left: auto; font-size: 0.72rem; color: var(--muted); font-weight: 400; font-family: 'IBM Plex Mono', monospace; }

  .messages-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .message-bubble { max-width: 75%; padding: 10px 14px; border-radius: 12px; }
  .message-bubble.mine { align-self: flex-end; background: #0d2018; border: 1px solid var(--accent); border-bottom-right-radius: 4px; }
  .message-bubble.theirs { align-self: flex-start; background: var(--surface); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
  .message-bubble p { font-size: 0.9rem; line-height: 1.5; word-break: break-word; }
  .msg-time { font-size: 0.72rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; display: block; margin-top: 4px; }
  .message-bubble.mine .msg-time { text-align: right; }
✦✦✦✦✦✦✦✦✦✦✦

.media-content { margin-bottom: 6px; }
  .msg-image { max-width: 220px; max-height: 220px; border-radius: 8px; display: block; object-fit: cover; }
  .msg-audio { width: 200px; height: 36px; }
  .media-loading { font-size: 0.8rem; color: var(--muted); }
  .media-expired { font-size: 0.8rem; color: var(--muted); font-style: italic; }

  .message-input { padding: 10px 12px; border-top: 1px solid var(--border); display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
  .message-input input { flex: 1; padding: 10px 14px; }
  .btn-send { background: var(--accent); border: none; border-radius: 8px; color: var(--bg); padding: 0 16px; height: 40px; cursor: pointer; font-weight: bold; font-size: 1rem; }
  .btn-send:hover { background: #00ffa8; }
  .btn-media { background: var(--border); border: 1px solid #2a2a3e; border-radius: 8px; padding: 0 10px; height: 40px; cursor: pointer; font-size: 1.1rem; transition: border-color 0.15s; flex-shrink: 0; }
  .btn-media:hover { border-color: var(--accent); }

  .voice-recording { display: flex; align-items: center; gap: 6px; background: #1a0a0a; border: 1px solid var(--danger); border-radius: 8px; padding: 6px 10px; flex-shrink: 0; }
  .rec-dot { color: var(--danger); font-size: 0.7rem; animation: pulse 1s infinite; }
  .rec-time { font-family: 'IBM Plex Mono', monospace; font-size: 0.85rem; color: var(--danger); min-width: 36px; }
  .btn-rec-cancel { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; }
  .btn-rec-send { background: var(--accent); border: none; border-radius: 6px; color: var(--bg); padding: 2px 8px; cursor: pointer; font-weight: bold; }

  @media (max-width: 480px) {
    main { padding: 16px 12px; }
    .setup-card { padding: 32px 24px; }
    .messages-sidebar { width: 180px; }
    .msg-image { max-width: 160px; max-height: 160px; }
    .msg-audio { width: 150px; }
  }
`;
✦✦✦✦✦✦✦✦✦✦✦

