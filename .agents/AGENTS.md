# 核心開發準則 (Core Development Guidelines)

1. **防禦性資料隔離與合併 (Defensive Data Isolation & Merging)**
   - 在實作資料合併 (Merging) 或同步 (Syncing) 邏輯前，必須嚴格檢查資料來源。絕對禁止將不同 Scope（例如個人空間 vs 共用空間）的資料庫錯誤合併與上傳。
   - 在任何資料流操作時，預設先懷疑有沒有可能會汙染到其他模組的狀態。

2. **React 狀態生命週期管理 (State Lifecycle & Cleanup)**
   - 當 Context 改變（例如：切換 Workspace、切換 User ID 等）時，相關聯的組件應該徹底銷毀並重建，避免前一個 Context 的狀態 (State) 殘留。
   - **實作方式**：強烈建議在最外層元件使用 `key` 屬性（如 `key={activeFolderId}`），透過強制卸載 (Unmount) 來達成 100% 的狀態重置，這是最乾淨且最安全的做法。

3. **邊界情況自我審查 (Edge Case Self-Review)**
   - 每次宣告完成一項功能前，必須在腦海中模擬極端操作流程（例如：「使用者快速切換頁面」、「存檔途中立刻按其他按鈕」、「斷線或 API 延遲」）。
   - 不要犯低級的狀態互相污染錯誤，交付給使用者測試前，務必再三確認邏輯漏洞。

4. **APK 打包時機 (APK Build Trigger)**
   - 絕對禁止在修改程式碼後「自動」或「預設」在背景執行 APK 打包腳本（如 `build_apk.ps1` 或 `npx cap sync android`）。
   - 只有在使用者**明確且主動要求**「請幫我打包 APK」或「更新 APK」時，才可以執行打包指令。這能避免與 Vite 預覽伺服器產生檔案鎖定 (EBUSY) 衝突，並節省系統資源。

5. **自動對話紀錄 (Automatic Chat History Logging)**
   - 在完成一個階段性任務或每日任務結束時，必須主動將當天完成的事項整理並記錄到 `.agents/chat_history.md` 檔案中，幫助專案保持完整的歷史脈絡。

6. **專案發布與版本控制資訊 (GitHub / Deployment Info)**
   - **GitHub 帳號**：`Burgerting`
   - **專案 (Repository) 名稱**：`Noteboook`
   - **GitHub Pages 網址**：`https://Burgerting.github.io/Noteboook/`
   - 任何牽涉到 GitHub 上傳、Git Remote 設定或部署腳本 (如 Vite 的 `base` 路徑) 的操作，都必須無條件套用此設定，確保發布過程不會出錯。

7. **發布前私密資訊檢查 (Pre-Deployment Privacy Check)**
   - 在執行任何 `git add`、`git push` 或部署 (deploy) 指令前，必須主動檢查專案狀態與 `.gitignore` 的完整性。
   - 確保絕對不會將任何含有私密資料的檔案或資料夾（例如 `local_drive/` 的記帳本 JSON 檔、`apk/` 的打包檔、或是包含 API 金鑰的檔案）推送到 GitHub 或公開網路。
   - 對隱私資料保持最高警戒，預設禁止上傳任何使用者生成的個人帳務檔案。
