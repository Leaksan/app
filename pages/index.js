import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const AVATARS = ['🦁','🐺','🦊','🐻','🐼','🦅','🐬','🦋','🌙','⚡','🔥','🌿','💎','🎭','🚀'];

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h/24)}j`;
}

function PostCard({ post, userId, onLike, onComment }) {
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
        <div>
          <span className="post-author">{post.author}</span>
          <span className="post-time">{timeAgo(post.timestamp)}</span>
        </div>
      </div>
      <p className="post-content">{post.content}</p>
      <div className="post-actions">
        <button
          className={`btn-action ${liked ? 'liked' : ''}`}
          onClick={() => onLike(post.id)}
        >
          ♥ {post.likes.length}
        </button>
        <button
          className="btn-action"
          onClick={() => setShowComments(!showComments)}
        >
          💬 {post.comments.length}
        </button>
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
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
              placeholder="Écrire un commentaire..."
              maxLength={200}
            />
            <button onClick={submitComment}>→</button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [setup, setSetup] = useState(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Restore user from localStorage
    const stored = localStorage.getItem('sn_user');
    if (stored) {
      const u = JSON.parse(stored);
      setUsername(u.name);
      setAvatar(u.avatar);
      setUserId(u.id);
      setSetup(false);
    } else {
      setAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
      setUserId('u_' + Math.random().toString(36).slice(2));
    }
  }, []);

  const fetchPosts = async () => {
    try {
      const r = await fetch('/api/posts');
      const data = await r.json();
      setPosts(data);
    } catch (e) {}
  };

  useEffect(() => {
    if (!setup) {
      fetchPosts();
      intervalRef.current = setInterval(fetchPosts, 5000);
      return () => clearInterval(intervalRef.current);
    }
  }, [setup]);

  const handleSetup = () => {
    if (!username.trim()) return;
    const user = { name: username.trim(), avatar, id: userId };
    localStorage.setItem('sn_user', JSON.stringify(user));
    setSetup(false);
  };

  const handlePost = async () => {
    if (!newPost.trim() || loading) return;
    setLoading(true);
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: username, avatar, content: newPost })
    });
    setNewPost('');
    await fetchPosts();
    setLoading(false);
  };

  const handleLike = async (postId) => {
    await fetch('/api/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userId })
    });
    await fetchPosts();
  };

  const handleComment = async (postId, content) => {
    await fetch('/api/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, author: username, avatar, content })
    });
    await fetchPosts();
  };

  if (setup) {
    return (
      <>
        <Head><title>Agora — Réseau Libre</title></Head>
        <div className="setup-screen">
          <div className="setup-card">
            <h1>🌐 Agora</h1>
            <p>Réseau social libre & décentralisé</p>
            <div className="avatar-preview">{avatar}</div>
            <div className="avatar-picker">
              {AVATARS.map(a => (
                <button key={a} onClick={() => setAvatar(a)} className={a === avatar ? 'selected' : ''}>
                  {a}
                </button>
              ))}
            </div>
            <input
              placeholder="Ton pseudo..."
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSetup()}
              maxLength={30}
              autoFocus
            />
            <button className="btn-primary" onClick={handleSetup}>Rejoindre →</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Agora — {username}</title></Head>
      <div className="app">
        <header>
          <div className="header-inner">
            <h1>🌐 Agora</h1>
            <span className="user-badge">{avatar} {username}</span>
          </div>
        </header>

        <main>
          <div className="compose-box">
            <span className="compose-avatar">{avatar}</span>
            <div className="compose-right">
              <textarea
                value={newPost}
                onChange={e => setNewPost(e.target.value)}
                placeholder="Qu'est-ce qui se passe ?"
                maxLength={500}
                rows={3}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handlePost()}
              />
              <div className="compose-footer">
                <span className="char-count">{newPost.length}/500</span>
                <button
                  className="btn-primary"
                  onClick={handlePost}
                  disabled={!newPost.trim() || loading}
                >
                  {loading ? '...' : 'Publier'}
                </button>
              </div>
            </div>
          </div>

          <div className="feed">
            {posts.length === 0 && (
              <div className="empty">Aucun message pour l'instant. Soyez le premier !</div>
            )}
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                userId={userId}
                onLike={handleLike}
                onComment={handleComment}
              />
            ))}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0a0a0f;
          --surface: #12121a;
          --border: #1e1e2e;
          --accent: #00e5a0;
          --accent2: #7c4dff;
          --text: #e8e8f0;
          --muted: #6b6b80;
          --danger: #ff4d6d;
        }

        body {
          background: var(--bg);
          color: var(--text);
          font-family: 'IBM Plex Sans', sans-serif;
          min-height: 100vh;
        }

        /* SETUP */
        .setup-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(ellipse at 50% 0%, #0d2018 0%, var(--bg) 70%);
        }

        .setup-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 48px 40px;
          width: 100%;
          max-width: 400px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .setup-card h1 {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 2rem;
          color: var(--accent);
          letter-spacing: -1px;
        }

        .setup-card p { color: var(--muted); font-size: 0.9rem; }

        .avatar-preview {
          font-size: 3rem;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-picker {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: center;
        }

        .avatar-picker button {
          background: var(--border);
          border: 2px solid transparent;
          border-radius: 8px;
          padding: 6px 10px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.15s;
        }

        .avatar-picker button:hover { border-color: var(--accent); }
        .avatar-picker button.selected { border-color: var(--accent); background: #0d2018; }

        input, textarea {
          width: 100%;
          background: var(--border);
          border: 1px solid #2a2a3e;
          border-radius: 8px;
          padding: 12px 16px;
          color: var(--text);
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.95rem;
          transition: border-color 0.2s;
          resize: none;
        }

        input:focus, textarea:focus {
          outline: none;
          border-color: var(--accent);
        }

        .btn-primary {
          background: var(--accent);
          color: #0a0a0f;
          border: none;
          border-radius: 8px;
          padding: 12px 28px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          letter-spacing: 0.5px;
        }

        .btn-primary:hover { background: #00ffa8; transform: translateY(-1px); }
        .btn-primary:disabled { opacity: 0.5; cursor: default; transform: none; }

        /* APP */
        header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(10, 10, 15, 0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }

        .header-inner {
          max-width: 640px;
          margin: 0 auto;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        header h1 {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 1.3rem;
          color: var(--accent);
          letter-spacing: -0.5px;
        }

        .user-badge {
          background: var(--border);
          border-radius: 20px;
          padding: 6px 14px;
          font-size: 0.85rem;
          color: var(--muted);
        }

        main {
          max-width: 640px;
          margin: 0 auto;
          padding: 24px 20px;
        }

        /* COMPOSE */
        .compose-box {
          display: flex;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .compose-avatar {
          font-size: 1.6rem;
          flex-shrink: 0;
          padding-top: 4px;
        }

        .compose-right { flex: 1; display: flex; flex-direction: column; gap: 10px; }

        .compose-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .char-count { font-size: 0.8rem; color: var(--muted); font-family: 'IBM Plex Mono', monospace; }

        /* FEED */
        .feed { display: flex; flex-direction: column; gap: 12px; }

        .empty { text-align: center; color: var(--muted); padding: 40px; }

        .post-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 20px;
          transition: border-color 0.2s;
        }

        .post-card:hover { border-color: #2a2a3e; }

        .post-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .post-avatar { font-size: 1.5rem; }

        .post-author {
          font-weight: 600;
          font-size: 0.9rem;
          display: block;
        }

        .post-time {
          color: var(--muted);
          font-size: 0.78rem;
          font-family: 'IBM Plex Mono', monospace;
        }

        .post-content {
          font-size: 0.95rem;
          line-height: 1.6;
          color: var(--text);
          margin-bottom: 14px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .post-actions { display: flex; gap: 12px; }

        .btn-action {
          background: none;
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 5px 14px;
          color: var(--muted);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'IBM Plex Mono', monospace;
        }

        .btn-action:hover { border-color: var(--accent); color: var(--accent); }
        .btn-action.liked { border-color: var(--danger); color: var(--danger); }

        /* COMMENTS */
        .comments-section {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .comment {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .comment-avatar { font-size: 1.1rem; flex-shrink: 0; }

        .comment-author {
          font-weight: 600;
          font-size: 0.82rem;
          margin-right: 6px;
          color: var(--accent);
        }

        .comment-text { font-size: 0.88rem; color: var(--text); }

        .comment-input {
          display: flex;
          gap: 8px;
          margin-top: 4px;
        }

        .comment-input input { flex: 1; padding: 8px 12px; font-size: 0.85rem; }

        .comment-input button {
          background: var(--accent);
          border: none;
          border-radius: 8px;
          color: var(--bg);
          font-size: 1rem;
          padding: 0 14px;
          cursor: pointer;
          font-weight: bold;
          transition: background 0.15s;
        }

        .comment-input button:hover { background: #00ffa8; }

        @media (max-width: 480px) {
          main { padding: 16px 12px; }
          .setup-card { padding: 32px 24px; }
        }
      `}</style>
    </>
  );
}
