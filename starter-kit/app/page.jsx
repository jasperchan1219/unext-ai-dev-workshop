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
