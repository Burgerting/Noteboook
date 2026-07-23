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
