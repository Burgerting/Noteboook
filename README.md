# 記帳記事本 (Noteboook)

一個整合 **Google Drive 雲端同步**、**智慧記帳分析**、**信用卡電子帳單管理**、**旅遊行程規劃** 與 **美食清單抽籤** 的全方位個人/家庭生活管理 Web 應用程式。

---

## 🚀 如何開啟網站

### 1. 線上直接使用 (推薦)
點擊以下連結即可立即使用最新版本的記帳記事本：

👉 **[https://Burgerting.github.io/Noteboook/](https://Burgerting.github.io/Noteboook/)**

---

### 2. 手機版安裝至主畫面 (類原生 APP 體驗)

支援 PWA (Progressive Web App) 技術，安裝後享有全螢幕、離線瀏覽與快速開啟體驗：

#### 🍏 iOS (iPhone / iPad - Safari)
1. 使用 **Safari 瀏覽器** 開啟 [網站網址](https://Burgerting.github.io/Noteboook/)。
2. 點擊瀏覽器底部的 **「分享」** 按鈕（向上箭頭圖示）。
3. 在選單中向下滑動，點選 **「加入主畫面」**（Add to Home Screen）。
4. 確認名稱後點擊右上角 **「新增」** 即可。

#### 🤖 Android (Chrome)
1. 使用 **Chrome 瀏覽器** 開啟 [網站網址](https://Burgerting.github.io/Noteboook/)。
2. 點擊右上角 **選單（三個直點）**。
3. 點選 **「安裝應用程式」** 或 **「加到主畫面」**。
4. 依提示完成安裝即可在手機桌面點擊圖示開啟。

---

## 💡 初次使用指引

1. **登入 Google 帳號**：進入網站後，點擊「使用 Google 登入」以取得雲端資料存取授權。
2. **設定儲存資料夾**：
   - 系統支援 **Google Picker 資料夾選擇器**，可直接從 Google Drive 挑選或新增記帳資料夾（如 `test0723` 或 `記帳本`）。
   - 所有的記帳與信用卡資料將安全儲存在您自己的 Google 雲端硬碟中，不會上傳至任何第三方伺服器。
3. **離線快取支援**：在無網路或弱網環境下，系統會自動快取資料於本機，確保隨時可瀏覽歷史帳務。

---

## ✨ 主要功能特色

* **📊 智慧記帳與統計圖表**
  * 支援快速記錄收入與支出。
  * 智慧類別匹配（輸入名稱自動帶入常用分類）。
  * 圓餅圖統計、自訂日期區間篩選與總額試算。
* **💳 信用卡電子帳單管理**
  * 支援從 Gmail 自動搜尋並讀取近期信用卡電子帳單。
  * 支援身分證字號解鎖銀行加密 PDF 並自動辨識應繳金額（身分證字號僅存放於本機瀏覽器）。
* **📅 固定支出與分期付款**
  * 每月房租、保險、學貸等固定扣款一鍵匯入。
  * 多期分期付款自動計算當期期數與剩餘金額。
* **✈️ 旅遊行程規劃**
  * 多日詳細行程表、旅遊獨立記帳（自動帶入記錄者名稱）與行李/代辦清單。
* **🍱 美食清單與吃什麼抽籤**
  * 支援 Google Takeout / Maps 地點匯入與自訂餐廳。
  * 隨機抽籤轉盤，解決「今天吃什麼」的難題。

---

## 💻 本機端開發與建置 (Local Development)

若您想在自己的電腦上執行原始碼或進行開發：

### 環境要求
* [Node.js](https://nodejs.org/) (建議 v18 以上)
* npm 或 yarn / pnpm

### 啟動步驟
```bash
# 1. 複製專案庫
git clone https://github.com/Burgerting/Noteboook.git
cd Noteboook

# 2. 安裝相依套件
npm install

# 3. 啟動本機開發伺服器
npm run dev
```
啟動後打開瀏覽器訪問 `http://localhost:5173/Noteboook/` 即可。

### 發布更新至 GitHub Pages
```bash
npm run deploy
```

---

## 🔒 隱私與安全性聲明
* 本應用程式為純前端架構 (Client-side Only)。
* 帳務與個人憑證資料均透過 Google 官方 OAuth 存取，所有檔案皆存放在使用者自己的 Google Drive，保障個人隱私安全。
