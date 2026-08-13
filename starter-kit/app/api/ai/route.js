// 這支檔案就是「你的網站怎麼跟 AI 說話」的地方
//
// 前端（page.jsx）把使用者打的字（連同之前的對話歷史）送到這裡 → 這裡轉送給 Groq 的 AI → 把答案送回前端
//
// 為什麼不能讓前端直接打 Groq：API key 會被所有人看到（打開瀏覽器的原始碼就有）
// 所以 key 只放在這一層（伺服器端），前端永遠看不到它

// 👇 這就是你的 AI 的人格與規則。改這裡 = 換一個助手
//
// 為什麼放在這個檔（伺服器端）而不是前端：前端的東西任何人都看得到、也改得動。
// 人格放前端的話，別人可以繞過你的規則，用你的 key 去問任何事
//
// 語言規則：這裡不寫死「一定要用中文」，讓使用者自己說要用什麼語言就用什麼語言。
// 如果你希望它預設用中文、但使用者要求換語言時可以換，就寫「預設用繁體中文，
// 但如果使用者要求其他語言，就照使用者的語言回答」這種有彈性的講法，
// 而不是「一定要用中文」這種寫死、蓋過使用者指示的句子。
const SYSTEM_PROMPT = `你是一位友善的助理。
預設用繁體中文回答，講重點，不要長篇大論。
如果使用者要求你用其他語言（例如英文、日文），就照使用者的要求切換語言回答，
之後也維持使用者最後指定的語言，直到使用者又要求換回來。
不確定的事情老實說不知道，不要編。`;

// 一次最多接受多長的輸入
//
// 為什麼要有這行：沒有它，任何人都能貼 10 萬字進來，一次就把你的免費額度燒一大塊。
// 這叫 size cap，是最便宜的一道防線
const MAX_INPUT_CHARS = 4000;

// 一次最多帶幾則歷史訊息給 AI（不含這次新輸入的這一則）
//
// 為什麼要限制：歷史越長，每次呼叫要送給 AI 的字越多，越貴、也越容易超過模型的上限。
// 只留「最近幾則」通常就夠讓對話聽起來連貫了，不需要把從頭到尾的紀錄全部送出去。
const MAX_HISTORY_MESSAGES = 20;

// ⚠️ 這支 API 沒有做「認證」—— 也就是說，任何知道你網址的人都可以用它
//
// 今天這樣是刻意的（加登入會讓課程做不完），但你要知道這件事：
// 你的網址一貼出去，別人就能拿你的 key 去問 AI 問題
//
// 真的要給不特定的人用，最少要加這三樣（今天不做，但你該知道名字）：
//   1. 限流 rate limit — 同一個人一分鐘最多幾次
//   2. 認證 auth — 只有登入的人能用
//   3. 用量上限 quota — 一天最多花多少
export async function POST(request) {
  // 1. 拿到前端送來的東西
  //    input：這次使用者新打的話
  //    history：之前的對話紀錄，格式是 [{ role: 'user' | 'ai', text: '...' }, ...]
  //    history 是選填的 —— 舊版前端如果沒送這個欄位，就當作沒有歷史，行為跟以前一樣
  const { input, history } = await request.json();

  if (!input || !input.trim()) {
    return Response.json({ error: '沒有輸入內容' }, { status: 400 });
  }

  if (input.length > MAX_INPUT_CHARS) {
    return Response.json(
      { error: `一次最多 ${MAX_INPUT_CHARS} 個字，你給了 ${input.length} 個` },
      { status: 413 }
    );
  }

  // 2. 拿 API key —— 這個值來自 Vercel 的環境變數，不在程式碼裡
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: '還沒設定 GROQ_API_KEY。到 Vercel 專案 → Settings → Environment Variables 加上它，然後 Redeploy' },
      { status: 500 }
    );
  }

  // 3. 把前端送來的歷史紀錄轉成 Groq 看得懂的格式
  //    前端存的 role 是 'user' / 'ai'，Groq 要的是 'user' / 'assistant'
  //    只取最近 MAX_HISTORY_MESSAGES 則，避免無限累積、越送越貴
  const safeHistory = Array.isArray(history) ? history : [];
  const trimmedHistory = safeHistory.slice(-MAX_HISTORY_MESSAGES);
  const historyMessages = trimmedHistory
    .filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'ai'))
    .map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.text,
    }));

  // 4. 呼叫 Groq
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // ⚠️ 這行不能拿掉 —— 少了 User-Agent，Groq 會回 403
        'User-Agent': 'unext-ai-dev-workshop/1.0',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            // 這段就是你的「AI 助手人格」。改這裡 = 換一個助手
            content: SYSTEM_PROMPT,
          },
          // 把之前聊過的內容也一起送給 AI，它才會「記得」上下文
          ...historyMessages,
          { role: 'user', content: input },
        ],
        max_completion_tokens: 1200,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { error: `Groq 回了 ${res.status}`, detail: detail.slice(0, 500) },
        { status: 502 }
      );
    }

    const data = await res.json();
    const output = data.choices?.[0]?.message?.content ?? '(AI 沒有回傳內容)';
    return Response.json({ output });
  } catch (err) {
    return Response.json({ error: `呼叫失敗：${err.message}` }, { status: 500 });
  }
}
