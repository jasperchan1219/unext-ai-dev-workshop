'use client';

// 這是你的網站首頁 —— LINE 風格聊天介面
//
// 改法：把這整個檔案貼給 Codex，跟它說你要做什麼（見 repo 根目錄的 SPEC-TEMPLATE.md）

import { useState, useRef, useEffect } from 'react';

// 👇 改這兩行就換了一個應用（先改這裡，再改介面）
// AI 的人格不在這裡 —— 它在 app/api/ai/route.js 的 SYSTEM_PROMPT（伺服器端）
const APP_TITLE = '我的第一個 AI 應用';
const PLACEHOLDER = '輸入訊息⋯⋯';

// 對話紀錄存在瀏覽器的 localStorage 裡（只在這一台裝置、這個瀏覽器看得到）
// 換瀏覽器、換裝置、清瀏覽器資料都會不見 —— 這不是雲端資料庫，是本機記憶
const STORAGE_KEY = 'chat-history-v1';

export default function Home() {
  // 輸入框改用 ref 直接控制（uncontrolled），不用 React state 綁 value。
  // 原因：中文/日文輸入法有自己的「組字緩衝區」，如果 value 是被 React state
  // 綁死的（controlled），送出當下用 setState('') 清空，
  // 輸入法的組字緩衝區有時會在下一輪把殘留的字重新塞回框裡，蓋掉清空的結果，
  // 造成「明明送出了，框裡卻還留著字」。改成直接操作 DOM 元素的 value 就不會有這問題。
  const [hasText, setHasText] = useState(false);
  const [messages, setMessages] = useState([]); // { role: 'user' | 'ai', text }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false); // 避免存檔動作蓋掉還沒讀取完成的舊紀錄
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // 網頁一打開，先從 localStorage 把上次的對話紀錄讀回來
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch (err) {
      // 讀取失敗（例如資料格式壞掉）就當作沒有紀錄，不擋住網頁使用
      console.error('讀取對話紀錄失敗：', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  // 每次對話紀錄變動，就同步寫回 localStorage
  useEffect(() => {
    if (!loaded) return; // 還沒讀取完成之前不要寫，避免用空陣列蓋掉舊紀錄
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (err) {
      console.error('儲存對話紀錄失敗：', err);
    }
  }, [messages, loaded]);

  function handleClearHistory() {
    if (!window.confirm('確定要清除所有對話紀錄嗎？這個動作沒辦法復原。')) return;
    setMessages([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('清除對話紀錄失敗：', err);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e) {
    e.preventDefault();
    const el = textareaRef.current;
    const text = (el?.value ?? '').trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);

    // 直接清空 DOM 元素本身，而不是透過 state 重新 render，
    // 這樣輸入法的組字緩衝區不會有機會把舊字塞回來
    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }
    setHasText(false);
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', text: data.output }]);
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

  return (
    <main style={S.page}>
      <header style={S.header}>
        <div style={S.headerAvatar}>AI</div>
        <div style={S.headerText}>
          <div style={S.headerTitle}>{APP_TITLE}</div>
          <div style={S.headerStatus}>{loading ? '正在輸入⋯⋯' : '線上'}</div>
        </div>
        <button
          type="button"
          onClick={handleClearHistory}
          style={S.clearButton}
          title="清除所有對話紀錄"
        >
          清除紀錄
        </button>
      </header>

      <section style={S.chatArea}>
        {messages.length === 0 && (
          <div style={S.emptyState}>
            傳一句話開始對話吧
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              ...S.bubbleRow,
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {m.role === 'ai' && <div style={S.avatar}>AI</div>}
            <div style={m.role === 'user' ? S.bubbleUser : S.bubbleAi}>
              {m.text}
            </div>
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
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
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
  headerStatus: { fontSize: '0.78rem', opacity: 0.85 },
  headerText: { flex: 1, minWidth: 0 },
  clearButton: {
    flexShrink: 0,
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#fff',
    background: 'rgba(255,255,255,0.2)',
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
