# AI 開發實戰 — 打造第一個 AI 應用

> UNEXT 見習生職涯沙龍｜2026-08-13（四）13:30–17:00｜講師：蔡子揚（Young）

今天結束的時候，你會有一個**別人打得開、能操作、真的有 AI 在裡面**的網站。
不是投影片、不是截圖、不是「等回家再做」。是一個網址。

而且你不會寫一行程式。

---
已部署的網址：https://unext-ai-dev-workshop-five.vercel.app/

## 這個 Repo 給你什麼

| 你要做的事 | 去哪裡 |
|---|---|
| 🎯 **把東西做上線（有付費 AI 助手）** | [QUICKSTART.md](QUICKSTART.md) —— 六張工單，各附驗收條件 |
| 🌐 **把東西做上線（零安裝）** | [docs/00-zero-install.md](docs/00-zero-install.md) —— 全程瀏覽器，電腦什麼都不用裝 |
| 🤖 **專案內建助教** | [AGENTS.md](AGENTS.md) —— Codex 開啟專案時自動讀取，知道這門課的目標與規則 |
| 📖 **今天用到的每一支 prompt** | [docs/02-prompts.md](docs/02-prompts.md) |
| 📋 **規格範本（A–F 六格 review）** | [SPEC-TEMPLATE.md](SPEC-TEMPLATE.md) |
| 🧯 **卡住了** | [docs/03-troubleshooting.md](docs/03-troubleshooting.md) |
| 🖼 **投影片與講稿** | `slides/` |
| 🧱 **範例程式** | `starter-kit/` |

---

## 今天你只會碰兩個檔

不管你用付費的 AI 助手還是免費對話，**動的都是這兩個檔**，差別只在誰去改它。

| 檔案 | 它管什麼 | 一句話 |
|---|---|---|
| `starter-kit/app/page.jsx`（147 行） | 畫面上的字、按鈕、顏色；輸入框幾個、提示寫什麼；結果怎麼呈現 | 這東西**長什麼樣、給誰用** |
| `starter-kit/app/api/ai/route.js`（93 行） | AI 的角色設定、輸出成什麼格式、不確定時怎麼辦 | 這東西**幫你處理什麼** |

其他檔案（`layout.jsx` 12 行、`next.config.mjs` 4 行、`package.json` 15 行）今天都不用動。

所以「我要改什麼」永遠只有兩個答案：**改樣子，還是改它會做的事。**
兩個加起來 240 行，全部貼給 AI 它也吃得下 —— 不用先判斷該動哪一個，讓它自己選。

---

## 今天走的路

```
你腦中那件煩事  →  問成一句話  →  變成需求單  →  交給 AI 工程師  →  上線
   (痛點)          (裸問)        (SPEC)        (Codex)        (Vercel)
```

六個階段，每一階都有可複製的 prompt：

| 階段 | 你在做什麼 | 產出 |
|---|---|---|
| **0 定錨** | 認清 3.5 小時能做出什麼、做不出什麼 | 一個現實的目標 |
| **1 裸問** | 什麼脈絡都不給，直接叫 AI 做 → 看它噴什麼 | 知道「為什麼要寫需求單」 |
| **2 需求單** | 讓 AI 訪談你 → 產出 SPEC，用 🟢🟡🔴 切野心 | [`SPEC.md`](SPEC-TEMPLATE.md) |
| **3 五層** | 你手上有哪些積木（說明書／招式／分身／記憶／自己跑） | 知道每塊要用哪個 |
| **4 開工** | Fork → 上線 → 讓 Codex 照 SPEC 改 → push | **你的網址** |
| **5 收斂** | Demo + 標出今天做到哪、剩下的怎麼長 | 路線圖 |

---

## 你需要準備的（全部免費，不用信用卡）

| 要什麼 | 去哪拿 | 用來做什麼 |
|---|---|---|
| **GitHub** 帳號 | [github.com](https://github.com) | 放你的程式碼 |
| **Vercel** 帳號 | [vercel.com](https://vercel.com)（用 GitHub 登入） | 把它變成網址 |
| **Groq** API key | [console.groq.com](https://console.groq.com) → API Keys | 網站裡的那個 AI |
| **ChatGPT 桌面版** | [chatgpt.com/download](https://chatgpt.com/download) | Codex 在裡面（**建議 Plus 方案**） |
| **Node.js** | [nodejs.org](https://nodejs.org) 下載 LTS | 跑 `vercel` 指令要用 |

一台能上網的筆電。**不需要任何程式基礎** —— 程式全部由 AI 寫，你負責說清楚要什麼、看得出它做錯。

要裝的東西只有兩樣：**Node.js**（一個安裝檔，裝完 `node -v` 有版本號就好）和
**vercel CLI**（一行 `npm i -g vercel`）。其餘全在瀏覽器或命令列，不用設定開發環境。

---

## 五分鐘先上線

先讓網站活起來，再想要做什麼 — 因為「已經活著的東西」改起來比「從零開始」容易一百倍。

```bash
npm i -g vercel && vercel login
git clone https://github.com/你的帳號/unext-ai-dev-workshop.git
cd unext-ai-dev-workshop/starter-kit && npm install
vercel --prod                             # 第一次會問幾題，全部 Enter
vercel env add GROQ_API_KEY production    # 貼上 console.groq.com 拿的 key
vercel --prod                             # 再跑一次讓 key 生效
```

🔴 `cd starter-kit` 不能漏 —— 在根目錄跑會「成功」部署一個打開是 404 的東西。

**→ 完整步驟看 [QUICKSTART.md](QUICKSTART.md)**

---

## 這個 repo 裡有什麼

| 路徑 | 是什麼 |
|---|---|
| [`QUICKSTART.md`](QUICKSTART.md) | 五分鐘上線的逐步操作 |
| [`SPEC-TEMPLATE.md`](SPEC-TEMPLATE.md) | 需求單模板（第 2 階要填的） |
| [`docs/01-spec-method.md`](docs/01-spec-method.md) | 怎麼把一句抱怨變成 AI 做得出來的需求單 |
| [`docs/02-prompts.md`](docs/02-prompts.md) | 每一階可以直接複製的 prompt |
| [`docs/03-troubleshooting.md`](docs/03-troubleshooting.md) | 卡住了看這裡（每種錯誤怎麼修） |
| `starter-kit/` | 你的網站本體。**改這裡** |
| `.github/workflows/ci.yml` | CI：每次 push 自動檢查有沒有改壞 |

---

## starter-kit 只有五個檔

不是省略版，是真的只有五個 — 這樣你才看得懂它。

| 檔 | 做什麼 | 你會改它嗎 |
|---|---|---|
| `app/page.jsx` | 你看到的那個頁面 | **會，這是主戰場** |
| `app/api/ai/route.js` | 網站怎麼跟 AI 說話 | 換 AI 的個性時會 |
| `app/layout.jsx` | 網頁標題、外框 | 偶爾 |
| `package.json` | 用了哪些套件 | 不用 |
| `next.config.mjs` | 設定檔 | 不用 |

---

## 兩個原則（今天請守住）

**① 一次只做一件事**

跟 Codex 說「幫我做一個能上傳檔案、會分析、有登入、還能寄信的系統」→ 它會做出一個四處都壞掉的東西。
說「把首頁的標題改成 X，輸入框的提示文字改成 Y」→ 它會做對。

**② 壞了就回上一步，不要硬修**

`git` 幫你記得每一個版本。改壞了不用慌，也不用叫 AI「修好它」（越修越壞）。
回到上一個能動的版本，重講一次需求就好。

---

## 課後

這個 repo 不會消失，fork 走的那份是你自己的。
今天做到 🟢 那塊，🟡🔴 的部分照你的路線圖慢慢長。

有問題 → 先問 Codex，它看得到你的程式碼。

---

## clone 下來之後，你就有一個助教

這個專案裡有一份 `AGENTS.md`。Codex 桌面版打開這個資料夾時會自動讀它，
於是它知道：這門課要做什麼、哪些檔案負責什麼、有哪五個坑不能踩。

所以你不需要每次都解釋一遍背景 —— 直接問就好：

- 「我卡住了，下一步是什麼」
- 「幫我把送出按鈕的字改成『幫我整理』」
- 「我要記住上次打的東西，該加什麼」
