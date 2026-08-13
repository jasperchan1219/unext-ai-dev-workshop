'use client';

// 這是你的網站首頁 —— LINE 風格聊天介面 + username 識別
//
// ⚠️ 這不是真正的登入系統：沒有密碼，只是用你打的 username 當「你是誰」的標籤。
// 只要有人知道你的 username，就能看到同一份對話紀錄 —— 這是刻意的取捨，
// 換來的是不用處理帳號、密碼、驗證信這些複雜的東西。
//
// 改法：把這整個檔案貼給 Codex，跟它說你要做什麼（見 repo 根目錄的 SPEC-TEMPLATE.md）

import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

// 👇 改這兩行就換了一個應用（先改這裡，再改介面）
// AI 的人格不在這裡 —— 它在 app/api/ai/route.js 的 SYSTEM_PROMPT（伺服器端）
const APP_TITLE = '我的第一個 AI 應用';
const PLACEHOLDER = '輸入訊息⋯⋯';

// username 存在這個瀏覽器的 localStorage 裡，下次打開網站不用再打一次
const USERNAME_KEY = 'chat-username';

export default function Home() {
  // undefined 代表「還在檢查瀏覽器裡有沒有存過 username」
  const [username, setUsername] = useState(undefined);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(USERNAME_KEY);
      setUsername(saved || null);
    } catch (err) {
      setUsername(null);
    }
  }, []);

  function handleLogin(name) {
    try {
      window.localStorage.setItem(USERNAME_KEY, name);
    } catch (err) {
      console.error('儲存 username 失敗：', err);
    }
    setUsername(name);
  }

  function handleSwitchUser() {
    try {
      window.localStorage.removeItem(USERNAME_KEY);
    } catch (err) {
      console.error('清除 username 失敗：', err);
    }
    setUsername(null);
  }

  if (username === undefined) {
    return (
      <main style={S.page}>
        <div style={S.centerBox}>載入中⋯⋯</div>
      </main>
    );
  }

  if (!username) {
    return <UsernameScreen onLogin={handleLogin} />;
  }

  return <ChatScreen username={username} onSwitchUser={handleSwitchUser} />;
}

// ============ 還沒輸入 username 時看到的畫面 ============
function UsernameScreen({ onLogin }) {
  const [value, setValue] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    onLogin(name);
  }

  return (
    <main style={S.page}>
      <div style={S.loginBox}>
        <div style={S.loginTitle}>{APP_TITLE}</div>
        <p style={S.loginSub}>
          取一個名字，換裝置時打同一個名字，就能看到同一份對話紀錄。
          <br />
          ⚠️ 這不是密碼 —— 別人知道你的名字也看得到。
        </p>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="取個名字，例如 jasper123"
            required
            style={S.loginInput}
          />
          <button type="submit" style={S.loginButton}>
            進入聊天室
          </button>
        </form>
      </div>
    </main>
  );
}

// ============ 聊天畫面 ============
function ChatScreen({ username, onSwitchUser }) {
  const [hasText, setHasText] = useState(false);
  const [messages, setMessages] = useState([]); // { id, role: 'user' | 'ai', text }
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // 進來之後，去 Supabase 把這個 username 之前的對話紀錄讀回來
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      const { data, error: loadError } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('username', username)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (loadError) {
        console.error('讀取對話紀錄失敗：', loadError);
        setError(`讀取對話紀錄失敗：${loadError.message}`);
      } else {
        setMessages(data.map((row) => ({ id: row.id, role: row.role, text: row.content })));
      }
      setHistoryLoading(false);
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function saveMessage(role, text) {
    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({ username, role, content: text })
      .select('id')
      .single();

    if (insertError) {
      console.error('儲存訊息失敗：', insertError);
      setError(`儲存訊息失敗：${insertError.message}`);
      return null;
    }
    return data.id;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const el = textareaRef.current;
    const text = (el?.value ?? '').trim();
    if (!text || loading) return;

    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', text }]);

    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }
    setHasText(false);
    setLoading(true);
    setError('');

    saveMessage('user', text);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: 'ai', text: data.output }]);
        saveMessage('ai', data.output);
      }
    } catch (err) {
      setError(`送出失敗：${err.message}`);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleChange(e) {
    setHasText(e.target.value.trim().length > 0);
  }

  async function handleClearHistory() {
    if (!window.confirm('確定要清除所有對話紀錄嗎？這個動作沒辦法復原。')) return;
    const { error: deleteError } = await supabase.from('messages').delete().eq('username', username);
    if (deleteError) {
      setError(`清除失敗：${deleteError.message}`);
      return;
    }
    setMessages([]);
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.headerAvatar}>AI</div>
        <div style={S.headerText}>
          <div style={S.headerTitle}>{APP_TITLE}</div>
          <div style={S.headerStatus}>{loading ? '正在輸入⋯⋯' : username}</div>
        </div>
        <button type="button" onClick={handleClearHistory} style={S.clearButton} title="清除所有對話紀錄">
          清除紀錄
        </button>
        <button type="button" onClick={onSwitchUser} style={S.logoutButton} title="切換使用者">
          切換
        </button>
      </header>

      <section style={S.chatArea}>
        {historyLoading && <div style={S.emptyState}>讀取對話紀錄中⋯⋯</div>}

        {!historyLoading && messages.length === 0 && (
          <div style={S.emptyState}>傳一句話開始對話吧</div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...S.bubbleRow,
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'ai' && <div style={S.avatar}>AI</div>}
            <div style={m.role === 'user' ? S.bubbleUser : S.bubbleAi}>{m.text}</div>
          </div>
        ))}

        {loading && (
          <div style={{ ...S.bubbleRow, justifyContent: 'flex-start' }}>
            <div style={S.avatar}>AI</div>
            <div style={S.bubbleAi}>
              <span style={S.typingDot}>•</span>
              <span style={{ ...S.typingDot, animationDelay: '0.2s' }}>•</span>
              <span style={{ ...S.typingDot, animationDelay: '0.4s' }}>•</span>
            </div>
          </div>
        )}

        {error && (
          <div style={S.error}>
            <strong>出錯了：</strong> {error}
          </div>
        )}

        <div ref={bottomRef} />
      </section>

      <form onSubmit={handleSubmit} style={S.inputBar}>
        <textarea
          ref={textareaRef}
          defaultValue=""
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          rows={1}
          style={S.textarea}
        />
        <button type="submit" disabled={loading || !hasText} style={S.sendButton}>
          送出
        </button>
      </form>

      <style>{`
        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
      `}</style>
    </main>
  );
}

// 樣式集中放這裡，改配色只改這一塊
const LINE_GREEN = '#06C755';
const BG = '#8DB5A6';

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxWidth: 480,
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, "Noto Sans TC", sans-serif',
    background: BG,
  },
  centerBox: { margin: 'auto', color: '#fff', fontSize: '0.95rem' },
  loginBox: {
    margin: 'auto',
    width: '100%',
    maxWidth: 340,
    padding: '2rem 1.5rem',
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: 4,
  },
  loginTitle: { fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 },
  loginSub: { fontSize: '0.85rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 },
  loginInput: {
    width: '100%',
    padding: '0.7rem 1rem',
    fontSize: '0.98rem',
    border: '1px solid #ddd',
    borderRadius: 10,
    boxSizing: 'border-box',
    marginBottom: '0.7rem',
    outline: 'none',
  },
  loginButton: {
    width: '100%',
    padding: '0.7rem',
    fontSize: '0.98rem',
    fontWeight: 600,
    color: '#fff',
    background: LINE_GREEN,
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0.9rem 1.1rem',
    background: LINE_GREEN,
    color: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
    flexShrink: 0,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.9rem',
    flexShrink: 0,
  },
  headerTitle: { fontWeight: 700, fontSize: '1.05rem' },
  headerStatus: {
    fontSize: '0.75rem',
    opacity: 0.85,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerText: { flex: 1, minWidth: 0 },
  clearButton: {
    flexShrink: 0,
    padding: '0.4rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(255,255,255,0.2)',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 14,
    cursor: 'pointer',
  },
  logoutButton: {
    flexShrink: 0,
    padding: '0.4rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#fff',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: 14,
    cursor: 'pointer',
  },
  chatArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 0.8rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  emptyState: { margin: 'auto', color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem' },
  bubbleRow: { display: 'flex', alignItems: 'flex-end', gap: 6 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: '#fff',
    color: LINE_GREEN,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.7rem',
    flexShrink: 0,
  },
  bubbleUser: {
    maxWidth: '75%',
    padding: '0.6rem 0.9rem',
    background: '#A8E063',
    color: '#1a1a1a',
    borderRadius: '16px 4px 16px 16px',
    fontSize: '0.98rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
  },
  bubbleAi: {
    maxWidth: '75%',
    padding: '0.6rem 0.9rem',
    background: '#fff',
    color: '#1a1a1a',
    borderRadius: '4px 16px 16px 16px',
    fontSize: '0.98rem',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
  },
  typingDot: { animation: 'blink 1.4s infinite both', fontSize: '1.2rem', lineHeight: '0.5rem' },
  error: {
    alignSelf: 'center',
    padding: '0.6rem 1rem',
    background: '#fff5f5',
    border: '1px solid #ffd0d0',
    borderRadius: 10,
    fontSize: '0.88rem',
    color: '#c0392b',
  },
  inputBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '0.7rem 0.8rem',
    background: '#fff',
    borderTop: '1px solid #e5e5e5',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    padding: '0.6rem 0.9rem',
    fontSize: '0.98rem',
    fontFamily: 'inherit',
    border: '1px solid #ddd',
    borderRadius: 20,
    resize: 'none',
    boxSizing: 'border-box',
    maxHeight: 100,
    outline: 'none',
  },
  sendButton: {
    padding: '0.6rem 1.3rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    background: LINE_GREEN,
    border: 'none',
    borderRadius: 20,
    cursor: 'pointer',
    flexShrink: 0,
  },
};
