# 🏝️ 我的AI島 (My AI Island) — 張文華醫師的 AI 創作生態島

歡迎來到 **「我的AI島 (My AI Island)」**！
本專案是從 **[My AI Works](https://famidoc.github.io/my-ai-works/)** 衍生而來的全新獨立互動式島嶼 PWA（Progressive Web App），採用「溫暖奇幻 × 未來科幻生態島」世界觀打造，**100% 不影響原有的 My AI Works 專案**，並直接與原平台共享同一個 Google Apps Script (GAS) 雲端資料庫。

---

## 🌟 七大主題地標與功能

1. **🎨 雲巔美術館 (Cloud Peak Gallery)**：展示 AI 繪畫、透明水彩、雙重曝光與視覺藝術作品（對應 `IMAGES`）。
2. **🎬 星光醫學劇院 (Starlight Medical Theater)**：播映【加減學學】實證醫學科普與【偶爾想想】AI 趨勢洞察影片（對應 `VIDEOS`）。
3. **💬 慢畫樹屋 (Comic Treehouse)**：收藏【慢畫漫畫】幽默哲思漫畫作品（對應 `COMICS`）。
4. **🌱 薛丁格蘭花溫室 (Schrödinger's Orchid Greenhouse)**：內建沉浸式小說閱讀器（支援深色/護眼/淺色主題、字級縮放、防劇透摺疊與章節獨立留言，對應 `NOVELS`）。
5. **⚡ 量子創客實驗室 (Quantum Maker Lab)**：展示以 Vibe Coding 打造的各式實用 Web App 與工具（對應 `APPS`）。
6. **🩺 島主觀星診所 (Doctor's Observatory)**：張文華醫師 (Famidoc Chang) 駐島簡介、三大創作航道、社群連結與全島即時統計儀表板。
7. **📡 跨維度通訊燈塔 (Beacon Lighthouse)**：提供 Email 電子報訂閱，以及「🔥 最高點閱 / ❤️ 最多按讚」全島人氣創作 Top 10 風雲榜。

---

## ✨ 島嶼專屬互動與彩蛋

- **☀️ 晨曦日光島 ↔ 🌙 星辰量子夜**：一鍵切換日夜光影與動態 Canvas 粒子（日光微塵 vs 夜晚量子螢火蟲與星塵），晚間 19:00 後登島會自動點亮夜光模式。
- **🐈 薛丁格的橘貓 & 島主今日處方籤**：點擊島中央石橋上的橘貓或頂部「今日處方籤」按鈕，隨機抽取融合家庭醫學、熱力學與量子力學的島主金句，並由橘貓為訪客隨機推薦一件島上作品。
- **🔊 Web Audio 療癒環境音**：純程式碼即時合成的海浪潮汐白噪音與溫暖真空管收音機共鳴弦音（無須載入外部大型音檔）。
- **🗺️ 島嶼地圖 / 🗂️ 全島總覽雙模式**：電腦版可全景瀏覽與滾輪縮放，手機版支援單指左右滑動巡島、雙指縮放，並附帶底部「一鍵快速傳送列」。

---

## 🔄 資料同步機制（免重複維護）

本專案採用三層極速載入架構：
1. `localStorage` 本地快取（回訪秒開）
2. 本地 `data.json` 與遠端 `https://famidoc.github.io/my-ai-works/data.json` 自動備援
3. 背景即時連線 `GAS_URL` 雲端試算表 API 更新最新作品、點閱數、按讚數與訪客留言

因此您只需要在原本的 Google 試算表上架作品，**「My AI Works」與「我的AI島」兩邊都會自動同步更新**！
