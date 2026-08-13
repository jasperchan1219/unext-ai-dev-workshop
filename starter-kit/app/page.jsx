'use client';

// 這是你的網站首頁 —— LINE 風格聊天介面 + 登入功能
//
// 對話紀錄現在存在 Supabase（雲端資料庫），不是瀏覽器本機了：
// 換裝置、換瀏覽器，只要用同一個 email 登入，就看得到同一份紀錄。
//
// 改法：把這整個檔案貼給 Codex，跟它說你要做什麼（見 repo 根目錄的 SPEC-TEMPLATE.md）

import { useState, useRef, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';

// 👇 改這兩行就換了一個應用（先改這裡，再改介面）
// AI 的人格不在這裡 —— 它在 app/api/ai/route.js 的 SYSTEM_PROMPT（伺服器端）
const APP_TITLE = '我的第一個 AI 應用';
const PLACEHOLDER = '輸入訊息⋯⋯';

export default function Home() {
  // session 是 undefined 代表「還在檢查有沒有登入過」，避免畫面閃一下登入頁又閃回聊天室
  const [session, setSession] = useState(undefined);

  // 網頁一打開，先問 Supabase「這個瀏覽器有沒有登入紀錄」
  // 之後只要登入狀態改變（登入、登出、magic link 生效），這裡都會被通知
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <main style={S.page}>
        <div style={S.centerBox}>檢查登入狀態⋯⋯</div>
      </main>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <ChatScreen session={session} />;
}

// ============ 還沒登入時看到的畫面 ============
function LoginScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSendLink(e) {
    e.preventDefault();
    const value = email.trim();
    if (!value || sending) return;

    setSending(true);
    setError('');
    try {
      // Supabase 會寄一封信到這個 email，裡面有一個登入連結，
      // 使用者點下去就會自動登入（不用設密碼）
      const { error: signInError } = await supabase.auth.signInWithOtp({ email: value });
      if (signInError) throw signInError;
      setSent(true);
    } catch (err) {
      setError(`寄送失敗：${err.message}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={S.page}>
      <div style={S.loginBox}>
        <div style={S.loginTitle}>{APP_TITLE}</div>
        <p style={S.loginSub}>登入後，你的對話紀錄會存在雲端，換裝置也看得到。</p>

        {sent ? (
          <div style={S.loginSentBox}>
            信寄出去了！打開 <strong>{email}</strong> 的信箱，點裡面的連結就會自動登入。
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#888' }}>
              沒收到信？記得看一下垃圾郵件匣。
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendLink} style={{ width: '100%' }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="你的 email"
              required
              style={S.loginInput}
            />
            <button type="submit" disabled={sending} style={S.loginButton}>
              {sending ? '寄送中⋯⋯' : '寄送登入連結'}
            </button>
          </form>
        )}

        {error && <div style={S.loginError}>{error}</div>}
      </div>
    </main>
  );
}

// ============ 登入後看到的聊天畫面 ============
function ChatScreen({ session }) {
  const userId = session.user.id;
  const userEmail = session.user.email;

  const [hasText, setHasText] = useState(false);
  const [messages, setMessages] = useState([]); // { id, role: 'user' | 'ai', text }
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // 登入後，去 Supabase 把這個使用者之前的對話紀錄讀回來
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setHistoryLoading(true);
      const { data, error: loadError } = await supabase
        .from('messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
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
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 把一則訊息寫進 Supabase（使用者的話跟 AI 的回覆都會呼叫這個）
  async function saveMessage(role, text) {
    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({ user_id: userId, role, content: text })
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

    // 先讓使用者的訊息立刻出現在畫面上，不用等資料庫寫完才顯示
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: tempId, role: 'user', text }]);

    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }
    setHasText(false);
    setLoading(true);
    setError('');

    // 同步把使用者的訊息存進 Supabase
    saveMessage('user', text);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 把「這次新打的話」跟「目前為止的對話紀錄」一起送給後端，
        // AI 才會記得之前聊過什麼，而不是每次都當成全新的對話
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
    // 中文/日文等輸入法選字時也會觸發 Enter，這時 isComposing 是 true，
    // 不能當成「送出」，不然字會被攔腰送出、殘留在框裡
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
    const { error: deleteError } = await supabase.from('messages').delete().eq('user_id', userId);
    if (deleteError) {
      setError(`清除失敗：${deleteError.message}`);
      return;
    }
    setMessages([]);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.headerAvatar}>AI</div>
        <div style={S.headerText}>
          <div style={S.headerTitle}>{APP_TITLE}</div>
          <div style={S.headerStatus}>
            {loading ? '正在輸入⋯⋯' : userEmail}
          </div>
        </div>
        <button type="button" onClick={handleClearHistory} style={S.clearButton} title="清除所有對話紀錄">
          清除紀錄
        </button>
        <button type="button" onClick={handleLogout} style={S.logoutButton} title="登出">
          登出
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
const BG = '#8DB5A6'; // LINE 聊天室背景那種淡綠灰

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
  centerBox: {
    margin: 'auto',
    color: '#fff',
    fontSize: '0.95rem',
  },
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
  loginSub: { fontSize: '0.88rem', color: '#666', marginBottom: '1rem', lineHeight: 1.6 },
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
  loginSentBox: {
    fontSize: '0.92rem',
    lineHeight: 1.7,
    color: '#333',
    background: '#f3fbf5',
    border: '1px solid #cdeed6',
    borderRadius: 10,
    padding: '1rem',
  },
  loginError: {
    marginTop: '0.8rem',
    fontSize: '0.85rem',
    color: '#c0392b',
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
  emptyState: {
    margin: 'auto',
    color: 'rgba(255,255,255,0.85)',
    fontSize: '0.95rem',
  },
  bubbleRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 6,
  },
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
  typingDot: {
    animation: 'blink 1.4s infinite both',
    fontSize: '1.2rem',
    lineHeight: '0.5rem',
  },
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
