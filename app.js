// ==========================================================================
// 我的AI島 (My AI Island) — 核心互動與雲端資料引擎
// 與 My AI Works 共享同一個 Google Apps Script (GAS) 雲端資料庫
// ==========================================================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbxAt2_Sp1QsY-ajrnSA0_uyWXaYG2gdN2fJO55ktGbexB60Suj_RA9Q4V1Qj0Iih279FA/exec";
const REMOTE_STATIC_FALLBACK = "https://famidoc.github.io/my-ai-works/data.json";

const urlParams = new URLSearchParams(window.location.search);
let requestedId = urlParams.get('id') || "";
let requestedZone = urlParams.get('zone') || "";
let appUrl = window.location.href.split('?')[0];

let allData = [];
let currentList = [];
let currentIndex = 0;
let currentType = 'image';
let currentKeyword = '';
let currentRenderedCount = 0;
const CHUNK_SIZE = 12;
let observer = null;
let sentinel = null;
let currentComments = [];
let renderedCommentCount = 0;
const COMMENT_CHUNK_SIZE = 5;

// 展館視窗專用變數
let activePavilionKey = null;
let pavilionList = [];
let pavilionRenderedCount = 0;
let pavilionKeyword = '';
let pavilionSort = 'newest';

// 小說專用全域變數
let currentNovel = null;
let currentChapterIndex = 1;
let currentReaderTheme = 'reader-theme-dark';
let currentReaderFontSize = 1.15;

// 島嶼環境與地圖狀態
let isNightMode = false;
let mapScale = 1;
let mapTranslateX = 0;
let mapTranslateY = 0;
let isDraggingMap = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;

// Web Audio 環境音效狀態（預設開啟，支援進館自動暫停、回島自動恢復與森林鳥鳴合成）
let audioCtx = null;
let isAudioPlaying = false;
let userWantsAmbientAudio = true;
let audioMasterGain = null;
let birdBusNode = null;
let birdSongTimer = null;

const getModalImageSize = () => window.innerWidth < 768 ? 'w800' : 'w1200';

// ==========================================================================
// 七大主題地標設定 (對應 island-map.png 精確視覺座標)
// ==========================================================================
const ISLAND_LANDMARKS = [
  {
    key: 'images',
    dataType: 'image',
    nameZh: '雲巔美術館',
    nameEn: 'CLOUD PEAK GALLERY',
    zoneCode: 'ZONE 01 // CLOUD PEAK GALLERY',
    icon: '🎨',
    x: 30,
    y: 21,
    color: '#4ef2d2',
    glow: 'rgba(78, 242, 210, 0.55)',
    quote: '在千年巨木與雲海交會的螺旋露台上，每一幅畫作都是光影、水彩與 AI 想像力的量子顯影。'
  },
  {
    key: 'profile',
    dataType: null,
    nameZh: '島主觀星診所',
    nameEn: "DOCTOR'S OBSERVATORY",
    zoneCode: 'ZONE 02 // ISLAND HQ & CLINIC',
    icon: '🩺',
    x: 61,
    y: 22,
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.55)',
    quote: '白天是溫暖守護健康的家庭醫學科診所，夜晚則是仰望宇宙深處與人性微光的觀星台。'
  },
  {
    key: 'comics',
    dataType: 'comic',
    nameZh: '慢畫樹屋',
    nameEn: 'COMIC TREEHOUSE',
    zoneCode: 'ZONE 03 // WHIMSICAL TREEHOUSE',
    icon: '💬',
    x: 40,
    y: 49,
    color: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.55)',
    quote: '藏在金黃銀杏林裡的木造樹屋，用一格格幽默與哲思，畫出日常與時代裡的會心一笑。'
  },
  {
    key: 'novels',
    dataType: 'novel',
    nameZh: '薛丁格蘭花溫室',
    nameEn: 'ORCHID GREENHOUSE',
    zoneCode: 'ZONE 04 // QUANTUM STORY GREENHOUSE',
    icon: '🌱',
    x: 63,
    y: 49,
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.55)',
    quote: '老式真空管收音機在嘉德麗雅蘭花間閃爍紫藍微光，這裡收藏著跨越平行宇宙的溫馨科幻故事。'
  },
  {
    key: 'videos',
    dataType: 'video',
    nameZh: '星光醫學劇院',
    nameEn: 'STARLIGHT THEATER',
    zoneCode: 'ZONE 05 // BAYSIDE AMPHITHEATER',
    icon: '🎬',
    x: 25,
    y: 74,
    color: '#f472b6',
    glow: 'rgba(244, 114, 182, 0.55)',
    quote: '迎著海灣微風的星光圓頂劇場，播映【加減學學】實證醫學科普與【偶爾想想】的未來洞察。'
  },
  {
    key: 'apps',
    dataType: 'apps',
    nameZh: '量子創客實驗室',
    nameEn: 'QUANTUM MAKER LAB',
    zoneCode: 'ZONE 06 // VIBE CODING DOME',
    icon: '⚡',
    x: 65,
    y: 73,
    color: '#2dd4bf',
    glow: 'rgba(45, 212, 191, 0.55)',
    quote: '以 Vibe Coding 驅動的幾何能量圓頂，將奇思妙想化為人人可用的 AI 數位工具與 Web App。'
  },
  {
    key: 'lighthouse',
    dataType: null,
    nameZh: '跨維度通訊燈塔',
    nameEn: 'BEACON LIGHTHOUSE',
    zoneCode: 'ZONE 07 // SIGNAL & LEADERBOARD',
    icon: '📡',
    x: 87,
    y: 38,
    color: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.6)',
    quote: '矗立在海岬懸崖上的共振燈塔，為您發送新作品登島通知，並揭曉全島人氣創作風雲榜。'
  }
];

// 島主處方籤 & 薛丁格橘貓 語錄庫
const FORTUNE_QUOTES = [
  "【島主處方 #01】根據熱力學第二定律，孤立系統總是走向混亂與熵增；但只要每天讀 15 分鐘好書、欣賞一幅畫，大腦的前額葉就能獲得最溫柔的「負熵」。",
  "【島主處方 #02】薛丁格的貓在盒子打開前同時處於兩種狀態；就像退休後的人生，只要保有好奇心，你同時是經驗豐富的老手，也是探索 AI 宇宙的少年。",
  "【島主處方 #03】登山醫學告訴我們「高爬低睡」能預防高山症；在 AI 狂飆的時代，思想可以飛向雲巔，但雙腳與心靈要睡在溫暖踏實的人間煙火裡。",
  "【島主處方 #04】家庭醫師常說：最好的藥物往往不在藥罐裡，而在陽光、散步、深讀與一場讓你眼眶溫熱的好故事裡。",
  "【島主處方 #05】在艾弗雷特的多世界詮釋裡，每一個微笑與善意的選擇，都會分裂出一個更明亮的平行宇宙。今天，你已經來到了最有趣的那個分支！",
  "【島主處方 #06】透明水彩最迷人的地方，在於「留白」與「水痕的自然暈染」；人生不必塗得太滿，留一點空白，光才照得進來。",
  "【島主處方 #07】大腦的小膠質細胞需要良好睡眠與規律刺激來清除斑塊；現在，就讓島上的色彩與故事幫你的神經元做一場深層 SPA 吧！",
  "【島主處方 #08】單車環島時，逆風總是讓人踩得氣喘吁吁，但回頭看，最難忘的風景往往都在上坡轉彎處。"
];

// ==========================================================================
// SVG 視覺圖示常數
// ==========================================================================
const eyeIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const heartFilledSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
const heartOutlineSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
const commentIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
const eyeIconModal = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const heartModalSvg = (isFilled) => `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFilled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const shareIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 8px;"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>';
const commentIconModal = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 6px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';

// ==========================================================================
// 系統初始化與安全網路請求
// ==========================================================================
async function safeFetchJson(url, options = {}, retries = 2, delayMs = 1500, timeoutMs = 15000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      const rawText = await res.text();
      const trimmed = rawText.trim();
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<head')) {
        throw new Error('Google 伺服器暫時忙碌或回傳 HTML');
      }
      return JSON.parse(rawText);
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

window.onload = function() {
  renderIslandLandmarks();
  setupIslandMapInteractions();
  setupIslandParticles();

  // 更新 NPC 橘貓座標到石橋中央 (x: 51%, y: 61%)
  const npcCat = document.getElementById('npc-cat-pin');
  if (npcCat) {
    npcCat.style.left = '51%';
    npcCat.style.top = '61%';
  }

  window.onscroll = function() {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  };

  // 若時間為晚上 18:00 ~ 清晨 06:00，預設開啟星辰量子夜
  const hour = new Date().getHours();
  if (hour >= 19 || hour < 6) {
    setDayNightMode(true);
  }

  loadData();
  checkSubscribeIntent();
  setupPwaManager();
  setupAmbientAudioAutoStart();
  window.addEventListener('hashchange', checkSubscribeIntent);

  // 鍵盤 Esc 關閉視窗支援
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const pwaModal = document.getElementById('pwa-install-modal');
      if (document.getElementById('modal').style.display === 'block') closeModalDirect();
      else if (document.getElementById('novel-modal').style.display === 'block') closeNovelModalDirect();
      else if (document.getElementById('fortune-modal').style.display === 'block') closeFortuneModalDirect();
      else if (pwaModal && pwaModal.style.display === 'block') closePwaModalDirect();
      else if (document.getElementById('pavilion-modal').classList.contains('open')) closePavilion();
    }
  });
};

function loadData() {
  const loader = document.getElementById('loader');
  const cached = localStorage.getItem('portfolio_cache');
  let hasCachedData = false;

  if (cached) {
    try {
      const cachedData = JSON.parse(cached);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        initData(cachedData);
        hasCachedData = true;
      }
    } catch (e) {
      localStorage.removeItem('portfolio_cache');
    }
  }

  if (!hasCachedData) {
    loader.style.display = 'flex';
    fetch('./data.json')
      .then(res => {
        if (!res.ok) return fetch(REMOTE_STATIC_FALLBACK);
        return res;
      })
      .then(res => res.json())
      .then(staticData => {
        if (Array.isArray(staticData) && staticData.length > 0) {
          initData(staticData);
          hasCachedData = true;
          try { localStorage.setItem('portfolio_cache', JSON.stringify(staticData)); } catch (e) {}
        }
      })
      .catch(err => {
        console.warn('[Island Loader] 靜態快取載入略過，等待 GAS API:', err.message);
      });
  }

  // 背景向 GAS API 同步最新作品與統計數據
  safeFetchJson(`${GAS_URL}?action=getPortfolio`, {}, 2, 1500, 15000)
    .then(json => {
      if (json.status === 'success' && Array.isArray(json.data)) {
        try { localStorage.setItem('portfolio_cache', JSON.stringify(json.data)); } catch (e) {}
        initData(json.data);
      }
    })
    .catch(err => {
      console.warn('[Island API] 使用快取資料運作中:', err.message || err);
      if (hasCachedData) loader.style.display = 'none';
    });
}

let hasHandledDeepLink = false;
let deepLinkTimer = null;

function initData(data) {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
  allData = data;
  if (!observer) setupObserver();

  updateIslandStatsAndBubbles();
  updateGallery();

  // 若展館已開啟，同步更新展館內容
  if (activePavilionKey) {
    if (activePavilionKey === 'profile') renderProfileDashboard();
    else if (activePavilionKey === 'lighthouse') renderLeaderboard('views');
    else renderPavilionGallery();
  }

  // 處理深層連結 (?id=xxx 或 ?zone=xxx)
  if (!hasHandledDeepLink) {
    if (requestedId && requestedId !== "") {
      const cleanReqId = String(requestedId).split('@')[0];
      const targetItem = allData.find(x => String(x.id) === String(requestedId) || String(x.id).split('@')[0] === cleanReqId);
      if (targetItem) {
        hasHandledDeepLink = true;
        if (deepLinkTimer) clearTimeout(deepLinkTimer);
        const typeStr = (targetItem.type || '').toLowerCase();
        if (typeStr === 'novel') {
          const chParam = urlParams.get('ch');
          deepLinkTimer = setTimeout(() => openNovelModal(targetItem, chParam ? parseInt(chParam, 10) : null), 250);
          return;
        }
        currentList = allData.filter(i => (i.type || '').toLowerCase() === typeStr);
        deepLinkTimer = setTimeout(() => openModal(targetItem), 250);
        return;
      }
    } else if (requestedZone && ISLAND_LANDMARKS.some(l => l.key === requestedZone)) {
      hasHandledDeepLink = true;
      setTimeout(() => openPavilion(requestedZone), 250);
    }
  }
}

// ==========================================================================
// 島嶼地標渲染與動態氣泡更新
// ==========================================================================
function renderIslandLandmarks() {
  const layer = document.getElementById('landmarks-layer');
  if (!layer) return;
  layer.innerHTML = '';

  ISLAND_LANDMARKS.forEach((lm, idx) => {
    const btn = document.createElement('button');
    btn.className = 'landmark-pin';
    btn.id = `landmark-pin-${lm.key}`;
    btn.style.left = `${lm.x}%`;
    btn.style.top = `${lm.y}%`;
    btn.style.setProperty('--pin-color', lm.color);
    btn.style.setProperty('--pin-glow', lm.glow);
    btn.style.setProperty('--anim-delay', `${(idx * 0.35).toFixed(2)}s`);

    btn.innerHTML = `
      <div class="landmark-bubble" id="landmark-bubble-${lm.key}">
        <span class="new-dot"></span>
        <span id="landmark-bubble-text-${lm.key}">探索地標</span>
      </div>
      <div class="landmark-orb-wrap">
        <div class="landmark-pulse-ring"></div>
        <div class="landmark-orb">${lm.icon}</div>
      </div>
      <div class="landmark-plaque">
        <span class="landmark-name-zh">${lm.nameZh}</span>
        <span class="landmark-name-en">${lm.nameEn}</span>
      </div>
    `;

    btn.onclick = (e) => {
      e.stopPropagation();
      if (dragMoved) return;
      openPavilion(lm.key);
    };

    layer.appendChild(btn);
  });
}

function extractCleanWorkTitle(rawTitle) {
  if (!rawTitle) return '';
  let t = String(rawTitle).trim();
  // 僅移除固定系列專欄前綴，保留畫作本身以【】命名的作品標題
  t = t.replace(/^【(加減學學|偶爾想想|慢畫漫畫|連載小說|App\s*Share)】/i, '').trim();
  const lines = t.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  t = lines[0] || '';
  t = t.replace(/^[【《]+|[】》]+$/g, '').trim();
  if (!t && lines[1]) {
    t = lines[1].replace(/^[【《(（]+|[】》)）]+$/g, '').trim();
  }
  return t.length > 10 ? t.slice(0, 10) + '…' : t;
}

function updateIslandStatsAndBubbles() {
  const counts = {
    images: allData.filter(x => (x.type || '').toLowerCase() === 'image').length,
    videos: allData.filter(x => (x.type || '').toLowerCase() === 'video').length,
    comics: allData.filter(x => (x.type || '').toLowerCase() === 'comic').length,
    novels: allData.filter(x => (x.type || '').toLowerCase() === 'novel').length,
    apps: allData.filter(x => (x.type || '').toLowerCase() === 'apps').length
  };

  const totalWorks = allData.length;
  const totalViews = allData.reduce((acc, x) => acc + (Number(x.viewCount) || 0), 0);
  const totalLikes = allData.reduce((acc, x) => acc + (Number(x.likes) || 0), 0);

  const topPill = document.getElementById('stat-total-works');
  if (topPill) {
    topPill.innerHTML = `🏝️ 全島館藏 <strong>${totalWorks}</strong> 件 · 👁️ <strong>${totalViews}</strong> 點閱 · ❤️ <strong>${totalLikes}</strong> 按讚`;
  }

  // 更新底部傳送列數字
  Object.keys(counts).forEach(k => {
    const el = document.getElementById(`dock-count-${k}`);
    if (el) el.innerText = counts[k];
  });

  // 更新島上 7 大地標的動態氣泡文字
  ISLAND_LANDMARKS.forEach(lm => {
    const bubbleTextEl = document.getElementById(`landmark-bubble-text-${lm.key}`);
    if (!bubbleTextEl) return;

    if (lm.dataType) {
      const items = allData.filter(x => (x.type || '').toLowerCase() === lm.dataType);
      const latestTitle = items[0] ? extractCleanWorkTitle(items[0].title) : '';
      if (lm.key === 'novels') {
        bubbleTextEl.innerText = latestTitle ? `${items.length} 部 · 新《${latestTitle}》` : `連載中 · ${items.length} 部作品`;
      } else {
        bubbleTextEl.innerText = latestTitle ? `${items.length} 件 · 新《${latestTitle}》` : `館藏 ${items.length} 件`;
      }
    } else if (lm.key === 'profile') {
      bubbleTextEl.innerText = '島主 Famidoc 駐診中';
    } else if (lm.key === 'lighthouse') {
      bubbleTextEl.innerText = `訂閱通知 · Top 10 熱榜`;
    }
  });
}

// ==========================================================================
// 島嶼地圖拖曳平移 (Pan) 與縮放 (Zoom) 互動控制
// ==========================================================================
function setupIslandMapInteractions() {
  const viewport = document.getElementById('map-viewport');
  if (!viewport) return;

  // 滑鼠拖曳
  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDraggingMap = true;
    dragMoved = false;
    dragStartX = e.clientX - mapTranslateX;
    dragStartY = e.clientY - mapTranslateY;
    viewport.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDraggingMap) return;
    const nx = e.clientX - dragStartX;
    const ny = e.clientY - dragStartY;
    if (Math.abs(nx - mapTranslateX) > 5 || Math.abs(ny - mapTranslateY) > 5) {
      dragMoved = true;
    }
    mapTranslateX = nx;
    mapTranslateY = ny;
    clampAndApplyMapTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDraggingMap) {
      isDraggingMap = false;
      viewport.classList.remove('dragging');
      setTimeout(() => { dragMoved = false; }, 50);
    }
  });

  // 滑鼠滾輪縮放
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.14 : -0.14;
    zoomMap(delta);
  }, { passive: false });

  // 手機觸控單指平移與雙指縮放
  let initialPinchDist = null;
  let initialScale = 1;

  viewport.addEventListener('touchstart', (e) => {
    const hint = document.getElementById('mobile-pan-hint');
    if (hint) hint.style.opacity = '0';

    if (e.touches.length === 1) {
      isDraggingMap = true;
      dragMoved = false;
      dragStartX = e.touches[0].clientX - mapTranslateX;
      dragStartY = e.touches[0].clientY - mapTranslateY;
    } else if (e.touches.length === 2) {
      isDraggingMap = false;
      initialPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialScale = mapScale;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDraggingMap) {
      const nx = e.touches[0].clientX - dragStartX;
      const ny = e.touches[0].clientY - dragStartY;
      if (Math.abs(nx - mapTranslateX) > 6 || Math.abs(ny - mapTranslateY) > 6) {
        dragMoved = true;
      }
      mapTranslateX = nx;
      mapTranslateY = ny;
      clampAndApplyMapTransform();
    } else if (e.touches.length === 2 && initialPinchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      mapScale = Math.max(0.85, Math.min(2.2, initialScale * (dist / initialPinchDist)));
      clampAndApplyMapTransform();
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    isDraggingMap = false;
    initialPinchDist = null;
    setTimeout(() => { dragMoved = false; }, 60);
  });
}

function zoomMap(delta) {
  mapScale = Math.max(0.85, Math.min(2.2, mapScale + delta));
  clampAndApplyMapTransform();
}

function resetIslandView() {
  mapScale = 1;
  mapTranslateX = 0;
  mapTranslateY = 0;
  clampAndApplyMapTransform();
}

function clampAndApplyMapTransform() {
  const stage = document.getElementById('map-stage');
  if (!stage) return;
  const maxOffsetX = Math.max(260, (stage.offsetWidth * mapScale - window.innerWidth) * 0.58 + 120);
  const maxOffsetY = Math.max(140, (stage.offsetHeight * mapScale - window.innerHeight) * 0.58 + 90);
  mapTranslateX = Math.max(-maxOffsetX, Math.min(maxOffsetX, mapTranslateX));
  mapTranslateY = Math.max(-maxOffsetY, Math.min(maxOffsetY, mapTranslateY));
  stage.style.transform = `translate3d(${mapTranslateX}px, ${mapTranslateY}px, 0) scale(${mapScale})`;
}

// ==========================================================================
// 沉浸式「半透明毛玻璃展館艙」(#pavilion-modal) 控制邏輯
// ==========================================================================
function openPavilion(landmarkKey) {
  const lm = ISLAND_LANDMARKS.find(x => x.key === landmarkKey);
  if (!lm) return;

  activePavilionKey = landmarkKey;

  // 更新頂部與底部按鈕高亮
  document.querySelectorAll('.pav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pav') === landmarkKey);
  });
  document.querySelectorAll('.dock-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-landmark') === landmarkKey);
  });

  // 更新展館橫幅資訊
  document.getElementById('pavilion-hero-icon').innerText = lm.icon;
  document.getElementById('pavilion-zone-badge').innerText = lm.zoneCode;
  document.getElementById('pavilion-title').innerText = `${lm.nameZh} (${lm.nameEn})`;
  document.getElementById('pavilion-quote').innerText = lm.quote;

  const worksBody = document.getElementById('pavilion-works-body');
  const profileBody = document.getElementById('pavilion-profile-body');
  const lighthouseBody = document.getElementById('pavilion-lighthouse-body');
  const countPill = document.getElementById('pavilion-count-pill');

  worksBody.style.display = 'none';
  profileBody.style.display = 'none';
  lighthouseBody.style.display = 'none';

  if (lm.key === 'profile') {
    countPill.innerText = '駐島家庭醫學科專科醫師';
    profileBody.style.display = 'block';
    renderProfileDashboard();
  } else if (lm.key === 'lighthouse') {
    countPill.innerText = '新作品通知 & 全島熱榜';
    lighthouseBody.style.display = 'block';
    renderLeaderboard('views');
  } else {
    worksBody.style.display = 'block';
    pavilionKeyword = '';
    pavilionSort = 'newest';
    const searchEl = document.getElementById('pavilionSearchInput');
    const sortEl = document.getElementById('pavilionSortSelect');
    if (searchEl) searchEl.value = '';
    if (sortEl) sortEl.value = 'newest';
    renderPavilionGallery();
  }

  const overlay = document.getElementById('pavilion-modal');
  overlay.classList.add('open');
  overlay.scrollTo({ top: 0, behavior: 'smooth' });
  syncAmbientAudioState();
}

function closePavilion() {
  activePavilionKey = null;
  document.getElementById('pavilion-modal').classList.remove('open');
  document.querySelectorAll('.dock-item').forEach(btn => btn.classList.remove('active'));
  syncAmbientAudioState();
}

function closePavilionOnBackdrop(e) {
  if (e.target.id === 'pavilion-modal') {
    closePavilion();
  }
}

function onPavilionSearch(val) {
  pavilionKeyword = (val || '').trim().toLowerCase();
  renderPavilionGallery();
}

function onPavilionSort(val) {
  pavilionSort = val || 'newest';
  renderPavilionGallery();
}

function renderPavilionGallery() {
  const lm = ISLAND_LANDMARKS.find(x => x.key === activePavilionKey);
  if (!lm || !lm.dataType) return;

  pavilionList = allData.filter(item => {
    const matchType = (item.type || '').toLowerCase() === lm.dataType;
    const text = ((item.title || '') + (item.desc || '') + (item.tag || '')).toLowerCase();
    const matchKw = pavilionKeyword === '' || text.includes(pavilionKeyword);
    return matchType && matchKw;
  });

  pavilionList.sort((a, b) => {
    if (pavilionSort === 'popular') return (b.viewCount || 0) - (a.viewCount || 0);
    if (pavilionSort === 'liked') return (b.likes || 0) - (a.likes || 0);
    return 0;
  });

  // 同步設定 currentList，讓點擊卡片進燈箱後的左右切換按鈕在同一館內順暢運作
  currentList = pavilionList;

  const countPill = document.getElementById('pavilion-count-pill');
  if (countPill) countPill.innerText = `本館共 ${pavilionList.length} 件創作`;

  const grid = document.getElementById('pavilion-gallery-grid');
  grid.innerHTML = '';
  pavilionRenderedCount = 0;

  if (pavilionList.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: #94a3b8;">🔍 找不到符合關鍵字的作品，請試試其他搜尋詞！</div>`;
    document.getElementById('pavilion-load-more-wrap').style.display = 'none';
    return;
  }

  loadMorePavilionItems();
}

function loadMorePavilionItems() {
  const grid = document.getElementById('pavilion-gallery-grid');
  const nextBatch = pavilionList.slice(pavilionRenderedCount, pavilionRenderedCount + CHUNK_SIZE);
  nextBatch.forEach(item => grid.appendChild(createCard(item)));
  pavilionRenderedCount += nextBatch.length;

  const moreWrap = document.getElementById('pavilion-load-more-wrap');
  if (moreWrap) {
    moreWrap.style.display = pavilionRenderedCount < pavilionList.length ? 'block' : 'none';
  }
}

function renderProfileDashboard() {
  const dash = document.getElementById('island-stats-dashboard');
  if (!dash) return;

  const totalWorks = allData.length;
  const totalViews = allData.reduce((acc, x) => acc + (Number(x.viewCount) || 0), 0);
  const totalLikes = allData.reduce((acc, x) => acc + (Number(x.likes) || 0), 0);
  const imgCount = allData.filter(x => (x.type || '').toLowerCase() === 'image').length;
  const vidCount = allData.filter(x => (x.type || '').toLowerCase() === 'video').length;
  const novelCount = allData.filter(x => (x.type || '').toLowerCase() === 'novel').length;

  dash.innerHTML = `
    <div class="stat-metric-box">
      <div class="stat-metric-val">${totalWorks}</div>
      <div class="stat-metric-label">🌟 全島創作總數</div>
    </div>
    <div class="stat-metric-box">
      <div class="stat-metric-val">${totalViews}</div>
      <div class="stat-metric-label">👁️ 累計登島點閱</div>
    </div>
    <div class="stat-metric-box">
      <div class="stat-metric-val">${totalLikes}</div>
      <div class="stat-metric-label">❤️ 訪客共鳴按讚</div>
    </div>
    <div class="stat-metric-box">
      <div class="stat-metric-val">${imgCount}</div>
      <div class="stat-metric-label">🎨 雲巔美術館畫作</div>
    </div>
    <div class="stat-metric-box">
      <div class="stat-metric-val">${vidCount}</div>
      <div class="stat-metric-label">🎬 星光醫學劇院影片</div>
    </div>
    <div class="stat-metric-box">
      <div class="stat-metric-val">${novelCount}</div>
      <div class="stat-metric-label">🌱 溫室連載小說</div>
    </div>
  `;
}

function renderLeaderboard(metric = 'views') {
  document.getElementById('lb-tab-views').classList.toggle('active', metric === 'views');
  document.getElementById('lb-tab-likes').classList.toggle('active', metric === 'likes');

  const listEl = document.getElementById('leaderboard-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const sorted = [...allData].sort((a, b) => {
    if (metric === 'likes') return (b.likes || 0) - (a.likes || 0);
    return (b.viewCount || 0) - (a.viewCount || 0);
  }).slice(0, 10);

  sorted.forEach((item, idx) => {
    let realId = item.id.includes('@') ? item.id.split('@')[0] : item.id;
    let thumbUrl = (item.type || '').toLowerCase() === 'video'
      ? `https://img.youtube.com/vi/${realId}/hqdefault.jpg`
      : `https://drive.google.com/thumbnail?id=${realId}&sz=w400`;

    const row = document.createElement('div');
    row.className = 'lb-item';
    row.innerHTML = `
      <div class="lb-rank">${idx + 1}</div>
      <img src="${thumbUrl}" class="lb-thumb" loading="lazy" alt="">
      <div class="lb-info">
        <div class="lb-title">${escapeHtml(item.title)}</div>
        <div class="lb-meta">
          <span>👁️ ${item.viewCount || 0} 點閱</span>
          <span>❤️ ${item.likes || 0} 按讚</span>
          <span>💬 ${item.commentCount || 0} 留言</span>
        </div>
      </div>
    `;
    row.onclick = () => {
      currentList = sorted;
      if ((item.type || '').toLowerCase() === 'novel') openNovelModal(item);
      else openModal(item);
    };
    listEl.appendChild(row);
  });
}

// ==========================================================================
// 島嶼環境互動：日夜星辰切換、動態粒子畫布、Web Audio 療癒海浪與收音機
// ==========================================================================
function toggleDayNight() {
  setDayNightMode(!isNightMode);
}

function setDayNightMode(night) {
  isNightMode = night;
  document.body.classList.toggle('island-mode-night', isNightMode);
  document.body.classList.toggle('island-mode-day', !isNightMode);

  const metaTheme = document.getElementById('meta-theme-color');
  if (metaTheme) {
    metaTheme.setAttribute('content', isNightMode ? '#050b14' : '#0f2027');
  }

  const iconEl = document.getElementById('day-night-icon');
  const labelEl = document.getElementById('day-night-label');
  if (iconEl && labelEl) {
    if (isNightMode) {
      iconEl.innerText = '☀️';
      labelEl.innerText = '晨曦日光島';
    } else {
      iconEl.innerText = '🌙';
      labelEl.innerText = '星辰量子夜';
    }
  }
}

function setupIslandParticles() {
  const canvas = document.getElementById('island-fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = 1280;
    canvas.height = 720;
  }
  resizeCanvas();

  const particles = Array.from({ length: 55 }, () => ({
    x: Math.random() * 1280,
    y: Math.random() * 720,
    r: Math.random() * 2.4 + 1,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.25 - 0.12,
    alpha: Math.random() * 0.7 + 0.2,
    phase: Math.random() * Math.PI * 2,
    hue: Math.random() > 0.45 ? 170 : 45
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.phase += 0.03;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      const glowAlpha = (Math.sin(p.phase) * 0.35 + 0.55) * p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isNightMode ? p.r * 1.25 : p.r, 0, Math.PI * 2);

      if (isNightMode) {
        // 夜晚：青色量子螢火蟲、溫室紫光微粒與金色星塵
        ctx.fillStyle = p.hue === 170
          ? `rgba(102, 252, 241, ${glowAlpha})`
          : `rgba(253, 224, 71, ${glowAlpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.hue === 170 ? '#66fcf1' : '#fde047';
      } else {
        // 白天：溫暖陽光微塵與水彩光斑
        ctx.fillStyle = `rgba(255, 251, 235, ${glowAlpha * 0.75})`;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#fef08a';
      }
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }
  animate();
}

// ==========================================================================
// Web Audio API 療癒環境音引擎：海浪潮汐、樹梢微風、悅耳森林鳥鳴與真空管微頻
// 支援「預設開啟」、「進館自動靜音」、「回島自動恢復」與「手動開關記憶」
// ==========================================================================
function isUserInPavilionOrModal() {
  const pavOpen = document.getElementById('pavilion-modal')?.classList.contains('open');
  const modalOpen = document.getElementById('modal')?.style.display === 'block';
  const novelOpen = document.getElementById('novel-modal')?.style.display === 'block';
  const listViewActive = document.getElementById('island-list-view')?.classList.contains('active');
  return Boolean(pavOpen || modalOpen || novelOpen || listViewActive);
}

function initAmbientAudioEngine() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioCtx = new AudioContextClass();

  audioMasterGain = audioCtx.createGain();
  audioMasterGain.gain.value = 0.0001;
  audioMasterGain.connect(audioCtx.destination);

  // 建立 6 秒立體粉紅噪音基底 (供海浪與微風共用)
  const bufferSize = audioCtx.sampleRate * 6;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.12;
    b6 = white * 0.115926;
  }

  // --------------------------------------------------------
  // 1. 主音軌 A：拍岸海浪潮汐 (Rolling Ocean Surf)
  // --------------------------------------------------------
  const waveSource = audioCtx.createBufferSource();
  waveSource.buffer = noiseBuffer;
  waveSource.loop = true;

  const waveFilter = audioCtx.createBiquadFilter();
  waveFilter.type = 'lowpass';
  waveFilter.frequency.value = 500;
  waveFilter.Q.value = 0.7;

  const waveGain = audioCtx.createGain();
  waveGain.gain.value = 0.52;

  const waveLfo = audioCtx.createOscillator();
  waveLfo.type = 'sine';
  waveLfo.frequency.value = 0.125;

  const waveFilterMod = audioCtx.createGain();
  waveFilterMod.gain.value = 340;
  waveLfo.connect(waveFilterMod);
  waveFilterMod.connect(waveFilter.frequency);

  const waveAmpMod = audioCtx.createGain();
  waveAmpMod.gain.value = 0.32;
  waveLfo.connect(waveAmpMod);
  waveAmpMod.connect(waveGain.gain);
  waveLfo.start();

  waveSource.connect(waveFilter);
  waveFilter.connect(waveGain);
  waveGain.connect(audioMasterGain);
  waveSource.start();

  // --------------------------------------------------------
  // 2. 主音軌 B：雲巔樹梢與海面微風 (Gentle Island Breeze)
  // --------------------------------------------------------
  const breezeSource = audioCtx.createBufferSource();
  breezeSource.buffer = noiseBuffer;
  breezeSource.loop = true;
  breezeSource.playbackRate.value = 1.15;

  const breezeFilter = audioCtx.createBiquadFilter();
  breezeFilter.type = 'bandpass';
  breezeFilter.frequency.value = 920;
  breezeFilter.Q.value = 1.4;

  const breezeGain = audioCtx.createGain();
  breezeGain.gain.value = 0.2;

  const breezeLfo = audioCtx.createOscillator();
  breezeLfo.type = 'sine';
  breezeLfo.frequency.value = 0.07;
  const breezeFilterMod = audioCtx.createGain();
  breezeFilterMod.gain.value = 400;
  breezeLfo.connect(breezeFilterMod);
  breezeFilterMod.connect(breezeFilter.frequency);
  breezeLfo.start();

  breezeSource.connect(breezeFilter);
  breezeFilter.connect(breezeGain);
  breezeGain.connect(audioMasterGain);
  breezeSource.start();

  // --------------------------------------------------------
  // 3. 主音軌 C：悅耳森林鳥鳴空間匯流排 (山谷回音與溫潤濾波)
  // --------------------------------------------------------
  birdBusNode = audioCtx.createGain();
  birdBusNode.gain.value = 0.85;

  const birdToneFilter = audioCtx.createBiquadFilter();
  birdToneFilter.type = 'lowpass';
  birdToneFilter.frequency.value = 3600;

  // 森林山谷自然空間回音 (Delay + Feedback)
  const echoDelay = audioCtx.createDelay();
  echoDelay.delayTime.value = 0.17;
  const echoFeedback = audioCtx.createGain();
  echoFeedback.gain.value = 0.24;
  const echoWet = audioCtx.createGain();
  echoWet.gain.value = 0.28;

  birdBusNode.connect(birdToneFilter);
  birdToneFilter.connect(audioMasterGain);

  birdToneFilter.connect(echoDelay);
  echoDelay.connect(echoFeedback);
  echoFeedback.connect(echoDelay);
  echoDelay.connect(echoWet);
  echoWet.connect(audioMasterGain);

  // --------------------------------------------------------
  // 4. 極微弱背景點綴：遠方溫室隱約飄來的真空管暖音
  // --------------------------------------------------------
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const padGain = audioCtx.createGain();
  osc1.type = 'sine';
  osc2.type = 'sine';
  osc1.frequency.value = 216;
  osc2.frequency.value = 324;
  padGain.gain.value = 0.002;
  osc1.connect(padGain);
  osc2.connect(padGain);
  padGain.connect(audioMasterGain);
  osc1.start();
  osc2.start();

  scheduleNextBirdSong(900);
}

// 合成單一清脆圓潤的鳥鳴音符 (支援滑音、微顫音與左右樹冠立體聲定位)
function triggerSingleBirdNote(startTime, fStart, fPeak, fEnd, duration, peakGain, panVal = 0) {
  if (!audioCtx || !birdBusNode) return;

  const osc = audioCtx.createOscillator();
  const subOsc = audioCtx.createOscillator();
  const subGain = audioCtx.createGain();
  const noteGain = audioCtx.createGain();

  osc.type = 'sine';
  subOsc.type = 'triangle';
  subGain.gain.value = 0.14; // 賦予木管笛音般的溫潤泛音

  osc.frequency.setValueAtTime(fStart, startTime);
  osc.frequency.exponentialRampToValueAtTime(fPeak, startTime + duration * 0.45);
  osc.frequency.exponentialRampToValueAtTime(fEnd, startTime + duration);

  subOsc.frequency.setValueAtTime(fStart * 0.5, startTime);
  subOsc.frequency.exponentialRampToValueAtTime(fPeak * 0.5, startTime + duration * 0.45);
  subOsc.frequency.exponentialRampToValueAtTime(fEnd * 0.5, startTime + duration);

  // 柔和無爆音的音量包絡線
  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.linearRampToValueAtTime(peakGain, startTime + Math.min(0.022, duration * 0.25));
  noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(noteGain);
  subOsc.connect(subGain);
  subGain.connect(noteGain);

  if (typeof audioCtx.createStereoPanner === 'function') {
    const panner = audioCtx.createStereoPanner();
    panner.pan.setValueAtTime(panVal, startTime);
    noteGain.connect(panner);
    panner.connect(birdBusNode);
  } else {
    noteGain.connect(birdBusNode);
  }

  osc.start(startTime);
  subOsc.start(startTime);
  osc.stop(startTime + duration + 0.02);
  subOsc.stop(startTime + duration + 0.02);
}

// 隨機演奏 4 種自然森林鳥鳴樂句 (山雀清啼、畫眉五聲婉轉、銀杏林青笛、雙鳥遠近對唱)
function playMelodicBirdPhrase() {
  if (!audioCtx || audioCtx.state !== 'running' || !isAudioPlaying) return;

  const now = audioCtx.currentTime + 0.04;
  const pan = (Math.random() * 1.3) - 0.65; // -0.65 (左方巨木) ~ +0.65 (右方銀杏林)
  const volScale = isNightMode ? 0.55 : 1.0; // 夜晚轉為輕柔夜鶯音量
  const pattern = Math.floor(Math.random() * 4);

  if (pattern === 0) {
    // 樂句 A：山雀輕快雙音清啼 (Sweet Rising Third)
    triggerSingleBirdNote(now, 2050, 2580, 2420, 0.11, 0.065 * volScale, pan);
    triggerSingleBirdNote(now + 0.15, 2100, 2720, 2550, 0.13, 0.072 * volScale, pan);
  } else if (pattern === 1) {
    // 樂句 B：畫眉鳥五聲宮調婉轉啼鳴 (Melodic Pentatonic Phrase)
    const notes = [
      { delay: 0.00, f1: 1760, f2: 2093, f3: 1975, dur: 0.12, g: 0.06 },
      { delay: 0.15, f1: 1975, f2: 2489, f3: 2349, dur: 0.11, g: 0.068 },
      { delay: 0.29, f1: 2349, f2: 2793, f3: 2637, dur: 0.15, g: 0.072 },
      { delay: 0.47, f1: 2489, f2: 2093, f3: 1760, dur: 0.18, g: 0.052 }
    ];
    notes.forEach(n => {
      triggerSingleBirdNote(now + n.delay, n.f1, n.f2, n.f3, n.dur, n.g * volScale, pan);
    });
  } else if (pattern === 2) {
    // 樂句 C：雲巔青笛圓潤滑音 (Gentle Forest Glissando)
    triggerSingleBirdNote(now, 1620, 2380, 1980, 0.21, 0.062 * volScale, pan);
    triggerSingleBirdNote(now + 0.25, 1980, 2640, 2480, 0.14, 0.055 * volScale, pan);
    triggerSingleBirdNote(now + 0.42, 2480, 2820, 2600, 0.12, 0.045 * volScale, pan);
  } else {
    // 樂句 D：左右樹林雙鳥遠近對唱 (Canopy Call & Response)
    const leftPan = -0.55;
    const rightPan = 0.6;
    triggerSingleBirdNote(now, 1920, 2450, 2300, 0.12, 0.066 * volScale, leftPan);
    triggerSingleBirdNote(now + 0.14, 2300, 2760, 2580, 0.14, 0.068 * volScale, leftPan);
    // 遠處另一棵樹上的鳥兒輕聲回應
    triggerSingleBirdNote(now + 0.44, 2150, 2620, 2400, 0.13, 0.038 * volScale, rightPan);
    triggerSingleBirdNote(now + 0.59, 2400, 2050, 1880, 0.16, 0.035 * volScale, rightPan);
  }
}

function scheduleNextBirdSong(customDelayMs = null) {
  if (birdSongTimer) clearTimeout(birdSongTimer);
  const nextDelay = customDelayMs !== null
    ? customDelayMs
    : (isNightMode ? 4500 + Math.random() * 3500 : 2500 + Math.random() * 2800);

  birdSongTimer = setTimeout(() => {
    if (isAudioPlaying && audioCtx && audioCtx.state === 'running' && !isUserInPavilionOrModal()) {
      playMelodicBirdPhrase();
    }
    scheduleNextBirdSong();
  }, nextDelay);
}

function updateAmbientButtonUI() {
  const btn = document.getElementById('btn-ambient-audio');
  const icon = document.getElementById('audio-icon');
  const label = document.getElementById('audio-label');
  if (!btn || !icon) return;

  if (userWantsAmbientAudio) {
    btn.classList.add('audio-active');
    icon.innerText = '🔊';
    if (label) label.innerText = '海浪鳥鳴中';
  } else {
    btn.classList.remove('audio-active');
    icon.innerText = '🔇';
    if (label) label.innerText = '環境音';
  }
}

function syncAmbientAudioState() {
  updateAmbientButtonUI();
  const shouldPlayNow = userWantsAmbientAudio && !isUserInPavilionOrModal();

  if (shouldPlayNow) {
    initAmbientAudioEngine();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        if (userWantsAmbientAudio && !isUserInPavilionOrModal()) {
          audioMasterGain.gain.setTargetAtTime(0.66, audioCtx.currentTime, 0.65);
          isAudioPlaying = true;
          setTimeout(() => playMelodicBirdPhrase(), 350);
        }
      }).catch(() => {});
    } else {
      const wasPlaying = isAudioPlaying;
      audioMasterGain.gain.setTargetAtTime(0.66, audioCtx.currentTime, 0.65);
      isAudioPlaying = true;
      if (!wasPlaying) {
        setTimeout(() => playMelodicBirdPhrase(), 380);
      }
    }
  } else {
    if (audioCtx && isAudioPlaying) {
      audioMasterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.32);
    }
    isAudioPlaying = false;
  }
}

function setupAmbientAudioAutoStart() {
  syncAmbientAudioState();

  // 若瀏覽器因自動播放政策先暫停了 AudioContext，在使用者首次與島嶼互動（滑動、點擊、滾輪、按鍵）時立即無縫喚醒
  const unlockEvents = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click'];
  const unlockHandler = () => {
    if (userWantsAmbientAudio && !isUserInPavilionOrModal()) {
      initAmbientAudioEngine();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          syncAmbientAudioState();
        }).catch(() => {});
      } else {
        syncAmbientAudioState();
      }
    }
    if (audioCtx && audioCtx.state === 'running') {
      unlockEvents.forEach(evt => window.removeEventListener(evt, unlockHandler));
    }
  };

  unlockEvents.forEach(evt => window.addEventListener(evt, unlockHandler, { passive: true }));
}

function toggleAmbientAudio() {
  userWantsAmbientAudio = !userWantsAmbientAudio;
  syncAmbientAudioState();
}

// ==========================================================================
// 彩蛋彈窗：島主處方籤 & 薛丁格的橘貓 (#fortune-modal)
// ==========================================================================
function openFortuneModal() {
  drawNewFortune();
  document.getElementById('fortune-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function drawNewFortune() {
  const quoteEl = document.getElementById('fortune-quote-text');
  const workBox = document.getElementById('fortune-work-box');
  const openBtn = document.getElementById('fortune-open-work-btn');

  const randomQuote = FORTUNE_QUOTES[Math.floor(Math.random() * FORTUNE_QUOTES.length)];
  if (quoteEl) quoteEl.innerText = randomQuote;

  if (!allData || allData.length === 0) {
    workBox.innerHTML = '<div style="color:#94a3b8;">正在載入島嶼作品庫...</div>';
    return;
  }

  const randomItem = allData[Math.floor(Math.random() * allData.length)];
  let realId = randomItem.id.includes('@') ? randomItem.id.split('@')[0] : randomItem.id;
  let thumbUrl = (randomItem.type || '').toLowerCase() === 'video'
    ? `https://img.youtube.com/vi/${realId}/hqdefault.jpg`
    : `https://drive.google.com/thumbnail?id=${realId}&sz=w400`;

  const typeLabelMap = {
    image: '🎨 雲巔美術館 · 視覺畫作',
    video: '🎬 星光醫學劇院 · 科普與洞察影片',
    comic: '💬 慢畫樹屋 · 幽默漫畫',
    novel: '🌱 薛丁格蘭花溫室 · 連載小說',
    apps: '⚡ 量子創客實驗室 · AI 應用程式'
  };
  const badgeText = typeLabelMap[(randomItem.type || '').toLowerCase()] || '🌟 島嶼精選創作';

  workBox.innerHTML = `
    <img src="${thumbUrl}" class="fortune-work-thumb" alt="">
    <div class="fortune-work-info">
      <span>${badgeText}</span>
      <h4>${escapeHtml(randomItem.title)}</h4>
      <div style="font-size:0.8rem; color:#cbd5e1;">👁️ ${randomItem.viewCount || 0} 點閱 · ❤️ ${randomItem.likes || 0} 按讚</div>
    </div>
  `;

  const openAction = () => {
    closeFortuneModalDirect();
    currentList = allData;
    if ((randomItem.type || '').toLowerCase() === 'novel') {
      openNovelModal(randomItem);
    } else {
      openModal(randomItem);
    }
  };

  workBox.onclick = openAction;
  if (openBtn) openBtn.onclick = openAction;
}

function closeFortuneModalDirect() {
  document.getElementById('fortune-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function closeFortuneModal(e) {
  if (e.target.id === 'fortune-modal') closeFortuneModalDirect();
}

// ==========================================================================
// 主視圖切換 (島嶼地圖模式 vs 全島總覽列表模式)
// ==========================================================================
function switchMainView(mode) {
  const mapView = document.getElementById('island-map-view');
  const listView = document.getElementById('island-list-view');
  const btnMap = document.getElementById('btn-mode-map');
  const btnList = document.getElementById('btn-mode-list');

  if (mode === 'list') {
    mapView.classList.remove('active');
    listView.classList.add('active');
    btnMap.classList.remove('active');
    btnList.classList.add('active');
    closePavilion();
    updateGallery();
  } else {
    listView.classList.remove('active');
    mapView.classList.add('active');
    btnList.classList.remove('active');
    btnMap.classList.add('active');
  }
  syncAmbientAudioState();
}

// ==========================================================================
// 全島總覽瀑布流與卡片渲染 (與 My AI Works 相容)
// ==========================================================================
function setupObserver() {
  const options = { root: null, rootMargin: '100px', threshold: 0.1 };
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) loadMoreItems();
  }, options);
  sentinel = document.createElement('div');
  sentinel.id = 'scroll-sentinel';
  sentinel.style.height = '20px';
}

function updateGallery() {
  currentList = allData.filter(item => {
    const matchType = (item.type || '').toLowerCase() === currentType;
    const content = ((item.title || '') + (item.desc || '') + (item.tag || '')).toLowerCase();
    const matchKeyword = currentKeyword === '' || content.includes(currentKeyword);
    return matchType && matchKeyword;
  });
  const sortEl = document.getElementById('sortSelect');
  const sortBy = sortEl ? sortEl.value : 'newest';
  currentList.sort((a, b) => {
    if (sortBy === 'popular') return (b.viewCount || 0) - (a.viewCount || 0);
    if (sortBy === 'liked') return (b.likes || 0) - (a.likes || 0);
    return 0;
  });
  const containerId = 'gallery-' + (currentType === 'apps' ? 'apps' : (currentType === 'novel' ? 'novels' : currentType + 's'));
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
    currentRenderedCount = 0;
    loadMoreItems();
  }
}

function loadMoreItems() {
  const containerId = 'gallery-' + (currentType === 'apps' ? 'apps' : (currentType === 'novel' ? 'novels' : currentType + 's'));
  const container = document.getElementById(containerId);
  if (!container) return;
  if (sentinel && sentinel.parentNode) sentinel.parentNode.removeChild(sentinel);
  const nextBatch = currentList.slice(currentRenderedCount, currentRenderedCount + CHUNK_SIZE);
  nextBatch.forEach(item => container.appendChild(createCard(item)));
  currentRenderedCount += nextBatch.length;
  if (currentRenderedCount < currentList.length && sentinel && observer) {
    container.appendChild(sentinel);
    observer.observe(sentinel);
  }
}

function createCard(item) {
  const div = document.createElement('div');
  div.className = 'card';
  let realId = item.id.includes('@') ? item.id.split('@')[0] : item.id;
  let thumbUrl = (item.type.toLowerCase() === 'video')
    ? 'https://img.youtube.com/vi/' + realId + '/hqdefault.jpg'
    : 'https://drive.google.com/thumbnail?id=' + realId + '&sz=w400';

  const isNovel = item.type.toLowerCase() === 'novel';
  const badgeHtml = isNovel ? '<div class="novel-card-badge">🌱 溫室連載小說</div>' : '';

  div.innerHTML = `
    ${badgeHtml}
    <div class="thumb-wrapper"><img src="${thumbUrl}" loading="lazy" alt="${escapeHtml(item.title)}"></div>
    <div class="info">
      <div class="card-meta">
        <h3>${escapeHtml(item.title)}</h3>
        <div class="card-meta-stats">
          <span class="view-count">${eyeIconSvg}${item.viewCount || 0}</span>
          <span class="like-count">${(localStorage.getItem('liked_' + item.id) === 'true' ? heartFilledSvg : heartOutlineSvg)}${item.likes || 0}</span>
          <span class="cmt-count">${commentIconSvg}${item.commentCount || 0}</span>
        </div>
      </div>
    </div>`;

  if (isNovel) {
    div.onclick = () => openNovelModal(item);
  } else {
    div.onclick = () => openModal(item);
  }
  return div;
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const btns = document.querySelectorAll('.tab-btn');
  if (tabName === 'images' && btns[0]) { btns[0].classList.add('active'); currentType = 'image'; }
  else if (tabName === 'videos' && btns[1]) { btns[1].classList.add('active'); currentType = 'video'; }
  else if (tabName === 'comics' && btns[2]) { btns[2].classList.add('active'); currentType = 'comic'; }
  else if (tabName === 'novels' && btns[3]) { btns[3].classList.add('active'); currentType = 'novel'; }
  else if (tabName === 'apps' && btns[4]) { btns[4].classList.add('active'); currentType = 'apps'; }

  document.querySelectorAll('.gallery-section').forEach(sec => sec.classList.remove('active'));
  const activeSec = document.getElementById('gallery-' + tabName);
  if (activeSec) activeSec.classList.add('active');
  updateGallery();
}

// ==========================================================================
// 單一作品鑑賞燈箱 (#modal) 與留言、按讚、訂閱功能
// ==========================================================================
function openModal(item) {
  if (!item) return;
  if (item.type && item.type.toLowerCase() === 'novel') {
    const chParam = urlParams.get('ch');
    openNovelModal(item, chParam ? parseInt(chParam, 10) : null);
    return;
  }
  if (!currentList || currentList.length === 0) {
    currentList = allData.filter(x => (x.type || '').toLowerCase() === (item.type || '').toLowerCase());
  }
  currentIndex = currentList.findIndex(x => String(x.id) === String(item.id));
  item.viewCount = (item.viewCount || 0) + 1;

  fetch(`${GAS_URL}?action=updateViewCount&resourceId=${item.id}`).catch(() => {});

  renderModalContent(item);
  document.getElementById('modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  syncAmbientAudioState();
}

function renderModalContent(explicitItem = null) {
  const item = (currentIndex >= 0 && currentList[currentIndex]) ? currentList[currentIndex] : (explicitItem || currentList[0]);
  if (!item) return;
  const container = document.getElementById('modal-media-container');
  const title = document.getElementById('modal-title');
  const desc = document.getElementById('modal-desc');
  const tag = document.getElementById('modal-tag');
  const actionsContainer = document.getElementById('modal-actions');

  title.innerHTML = `
    ${escapeHtml(item.title)}
    <span style="font-size: 1.05rem; color: var(--neon-blue); margin-left: 14px;">${eyeIconModal}${item.viewCount || 0}</span>
    <span id="modal-cmt-count" style="font-size: 1.05rem; color: var(--neon-yellow); margin-left: 14px;">${commentIconModal}${item.commentCount || 0}</span>`;

  tag.innerText = item.tag || (item.type.toUpperCase() + ' WORK');
  container.innerHTML = '';
  desc.innerHTML = '';
  actionsContainer.innerHTML = '';

  let realId = item.id.includes('@') ? item.id.split('@')[0] : item.id;
  if (item.type.toLowerCase() === 'video') {
    container.innerHTML = `<iframe src="https://www.youtube.com/embed/${realId}?autoplay=1" allowfullscreen></iframe>`;
    desc.innerText = item.desc || "";
  } else {
    container.innerHTML = `<img src="https://drive.google.com/thumbnail?id=${realId}&sz=${getModalImageSize()}" alt="${escapeHtml(item.title)}">`;
    if (item.type.toLowerCase() === 'apps' && item.desc && item.desc.trim() !== "") {
      const docBtn = document.createElement('a');
      docBtn.href = item.desc;
      docBtn.target = "_blank";
      docBtn.className = "doc-btn";
      docBtn.innerText = "🚀 開啟應用程式 / 閱讀使用說明";
      actionsContainer.appendChild(docBtn);
      desc.innerText = "";
    } else {
      desc.innerText = item.desc || "";
    }
  }

  const likeBtn = document.createElement('button');
  likeBtn.className = 'modal-like-btn' + (localStorage.getItem('liked_' + item.id) === 'true' ? ' liked' : '');
  likeBtn.innerHTML = heartModalSvg(localStorage.getItem('liked_' + item.id) === 'true') + ' LIKE (' + (item.likes || 0) + ')';
  if (localStorage.getItem('liked_' + item.id) !== 'true') {
    likeBtn.onclick = () => handleLike(item.id);
  }
  actionsContainer.appendChild(likeBtn);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.innerHTML = shareIconSvg + 'SHARE';
  shareBtn.onclick = function() {
    const fullUrl = appUrl + "?id=" + encodeURIComponent(item.id);
    copyToClipboardSafe(fullUrl).then(() => {
      shareBtn.innerHTML = '✅ COPIED!';
      setTimeout(() => { shareBtn.innerHTML = shareIconSvg + 'SHARE'; }, 2000);
    });
  };
  actionsContainer.appendChild(shareBtn);

  fetchComments(item.id);
}

function handleLike(itemId) {
  if (localStorage.getItem('liked_' + itemId) === 'true') return;
  localStorage.setItem('liked_' + itemId, 'true');
  const item = allData.find(x => String(x.id) === String(itemId));
  if (item) {
    item.likes = (item.likes || 0) + 1;
    renderModalContent(item);
    updateIslandStatsAndBubbles();
    fetch(`${GAS_URL}?action=addLike&resourceId=${itemId}`).catch(() => {});
  }
}

function fetchComments(resourceId) {
  document.getElementById('comments-list').innerHTML = '讀取島嶼留言中...';
  safeFetchJson(`${GAS_URL}?action=getComments&resourceId=${resourceId}`, {}, 1, 1200)
    .then(json => {
      if (json.status === 'success') {
        currentComments = (json.data || []).reverse();
        renderedCommentCount = 0;
        document.getElementById('comments-list').innerHTML = '';
        if (currentComments.length === 0) {
          document.getElementById('comments-list').innerHTML = '尚無留言，歡迎成為第一位留下足跡的登島訪客！';
        } else {
          renderComments();
        }
      } else {
        document.getElementById('comments-list').innerHTML = '讀取留言失敗。';
      }
    })
    .catch(() => {
      document.getElementById('comments-list').innerHTML = '讀取留言失敗（伺服器忙碌），請稍候重試。';
    });
}

function renderComments() {
  const list = document.getElementById('comments-list');
  const oldBtn = document.getElementById('load-more-btn');
  if (oldBtn) oldBtn.remove();

  const batch = currentComments.slice(renderedCommentCount, renderedCommentCount + COMMENT_CHUNK_SIZE);
  batch.forEach(cmt => {
    const div = document.createElement('div');
    div.className = 'comment-card';
    let replyHtml = '';
    if (cmt.adminReply) {
      replyHtml = '<div class="admin-reply"><div class="admin-reply-header"><span>⤷ ISLAND DOCTOR REPLY // 島主回覆</span></div><div class="admin-reply-body">' + escapeHtml(cmt.adminReply) + '</div></div>';
    }
    div.innerHTML = '<div class="comment-header"><span class="comment-nick">' + escapeHtml(cmt.nickname) + '</span><span class="comment-time">' + escapeHtml(cmt.timestamp) + '</span></div><div class="comment-body">' + escapeHtml(cmt.content) + '</div>' + replyHtml;
    list.appendChild(div);
  });

  renderedCommentCount += batch.length;

  if (renderedCommentCount < currentComments.length) {
    const moreBtn = document.createElement('div');
    moreBtn.id = 'load-more-btn';
    moreBtn.className = 'load-more-comments';
    moreBtn.innerText = 'LOAD MORE LOGS / 載入更多留言';
    moreBtn.onclick = renderComments;
    list.appendChild(moreBtn);
  }
}

function submitComment() {
  const item = currentList[currentIndex];
  if (!item) return;
  const nickInput = document.getElementById('comment-nick');
  const contentInput = document.getElementById('comment-content');
  const submitBtn = document.getElementById('comment-submit');
  const nick = nickInput.value.trim() || "匿名登島訪客";
  const content = contentInput.value.trim();

  if (!content) { alert("請輸入留言內容"); return; }

  submitBtn.disabled = true;
  submitBtn.innerText = 'WAIT...';

  const payload = { action: 'addComment', resourceId: item.id, nickname: nick, content: content };

  safeFetchJson(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }, 1, 1500)
  .then(json => {
    submitBtn.disabled = false;
    submitBtn.innerText = 'TRANSMIT / 傳送留言';
    if (json.status === 'success' && json.data.success) {
      contentInput.value = '';
      fetchComments(item.id);
      item.commentCount = (item.commentCount || 0) + 1;
      renderModalContent(item);
    } else {
      alert("傳送失敗: " + (json.message || "請稍候重試"));
    }
  })
  .catch(err => {
    submitBtn.disabled = false;
    submitBtn.innerText = 'TRANSMIT / 傳送留言';
    alert("連線忙碌中，請稍候再試 (" + (err.message || err) + ")");
  });
}

function subscribeNewsletter() {
  const emailInput = document.getElementById('sub-email');
  const btn = document.getElementById('sub-btn');
  const msg = document.getElementById('sub-msg');
  const email = emailInput.value.trim();

  if (!email || !email.includes('@')) {
    msg.style.color = 'var(--neon-pink)';
    msg.innerText = ">> 請輸入有效的 Email 信箱地址";
    return;
  }

  btn.disabled = true;
  btn.innerText = '傳送中...';
  msg.style.color = 'var(--neon-blue)';
  msg.innerText = ">> 燈塔電波發射中...";

  const payload = { action: 'addSubscriber', email: email };

  safeFetchJson(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }, 1, 1500)
  .then(json => {
    btn.disabled = false;
    btn.innerText = '📡 立即訂閱 (SUBSCRIBE)';
    if (json.status === 'success' && json.data.success) {
      msg.style.color = '#4ef2d2';
      msg.innerText = ">> " + json.data.message;
      emailInput.value = '';
    } else {
      msg.style.color = 'var(--neon-pink)';
      msg.innerText = ">> " + (json.data.message || '訂閱失敗，請稍候重試');
    }
    setTimeout(() => { msg.innerText = ""; }, 5000);
  })
  .catch(() => {
    btn.disabled = false;
    btn.innerText = '📡 立即訂閱 (SUBSCRIBE)';
    msg.style.color = 'var(--neon-pink)';
    msg.innerText = ">> 連線逾時或伺服器忙碌，請稍候重試";
  });
}

function checkSubscribeIntent() {
  const hash = (window.location.hash || "").toLowerCase();
  const currentParams = new URLSearchParams(window.location.search);
  const isSubscribe = hash === '#subscribe' ||
                      currentParams.get('subscribe') === 'true' ||
                      currentParams.get('action') === 'subscribe';
  if (isSubscribe) {
    setTimeout(() => {
      openPavilion('lighthouse');
      const emailInput = document.getElementById('sub-email');
      const msg = document.getElementById('sub-msg');
      if (emailInput) {
        emailInput.focus();
        if (msg) {
          msg.style.color = 'var(--neon-blue)';
          msg.innerText = ">> 歡迎登陸跨維度通訊燈塔！請輸入 Email 接收島上最新作品通知";
        }
      }
    }, 450);
  }
}

function copyToClipboardSafe(text) {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
  return Promise.resolve();
}

function changeSlide(n) {
  if (!currentList || currentList.length === 0) return;
  currentIndex = (currentIndex + n + currentList.length) % currentList.length;
  openModal(currentList[currentIndex]);
}

function closeModalDirect() {
  document.getElementById('modal').style.display = 'none';
  document.body.style.overflow = '';
  const container = document.getElementById('modal-media-container');
  if (container) container.innerHTML = '';
  syncAmbientAudioState();
}

function closeModal(e) {
  if (e.target.id === 'modal') closeModalDirect();
}

function filterData() {
  currentKeyword = document.getElementById('searchInput').value.toLowerCase();
  updateGallery();
}

// ==========================================================================
// 薛丁格蘭花溫室：沉浸式小說閱讀器 (#novel-modal)
// ==========================================================================
function openNovelModal(item, targetChapterIndex = null) {
  currentNovel = item;
  currentNovel.viewCount = (currentNovel.viewCount || 0) + 1;
  fetch(`${GAS_URL}?action=updateViewCount&resourceId=${item.id}`).catch(() => {});

  document.getElementById('novel-toolbar-title').innerText = item.title;
  let realId = item.id.includes('@') ? item.id.split('@')[0] : item.id;
  document.getElementById('novel-cover-img').src = `https://drive.google.com/thumbnail?id=${realId}&sz=${getModalImageSize()}`;
  document.getElementById('novel-overview-title').innerText = item.title;
  document.getElementById('novel-overview-tag').innerText = item.tag || '#連載小說';

  const descText = item.desc || "暫無簡介";
  const descEl = document.getElementById('novel-overview-desc');
  const spoilerNotice = document.getElementById('novel-spoiler-notice');
  const toggleBtn = document.getElementById('novel-desc-toggle-btn');

  descEl.innerText = descText;
  descEl.classList.remove('expanded');

  const isDetailedOrSpoiler = descText.length > 160 || /大綱|設定|反轉|劇透|企劃|Logline/i.test(descText);
  if (isDetailedOrSpoiler) {
    if (spoilerNotice) spoilerNotice.style.display = 'flex';
    if (toggleBtn) {
      toggleBtn.style.display = 'inline-flex';
      toggleBtn.innerText = '展開完整設定大綱 ▾';
    }
  } else {
    if (spoilerNotice) spoilerNotice.style.display = 'none';
    if (toggleBtn) toggleBtn.style.display = 'none';
    descEl.classList.add('expanded');
  }

  document.getElementById('novel-overview-views').innerHTML = `${eyeIconSvg} 閱讀 ${item.viewCount || 0}`;
  document.getElementById('novel-overview-likes').innerHTML = `${heartFilledSvg} 按讚 ${item.likes || 0}`;

  const chapters = item.chapters || [];
  document.getElementById('novel-overview-chapters-count').innerHTML = `📑 共 ${chapters.length} 章`;

  populateChapterSelectAndTOC(chapters);

  if (targetChapterIndex && chapters.some(c => c.index === targetChapterIndex)) {
    loadChapter(targetChapterIndex);
  } else {
    showNovelOverview();
  }

  document.getElementById('novel-modal').style.display = 'block';
  document.body.style.overflow = 'hidden';
  syncAmbientAudioState();
}

function getCleanChapterTitle(index, rawTitle) {
  if (!rawTitle) return `第 ${index} 章`;
  let trimmed = String(rawTitle).trim();
  const chMatch = trimmed.match(/^第\s*\d+\s*[章講回節集話][:：\s]*(.*)$/i);
  if (chMatch) {
    const subTitle = chMatch[1].trim();
    return subTitle ? `第 ${index} 章：${subTitle}` : `第 ${index} 章`;
  }
  const numMatch = trimmed.match(/^\d+[_.\s]+(.*)$/);
  if (numMatch) {
    const subTitle = numMatch[1].trim();
    return subTitle ? `第 ${index} 章：${subTitle}` : `第 ${index} 章`;
  }
  return `第 ${index} 章：${trimmed}`;
}

function populateChapterSelectAndTOC(chapters) {
  const select = document.getElementById('novel-chapter-select');
  const tocList = document.getElementById('novel-toc-list');
  select.innerHTML = '<option value="0">📑 書籍概覽與目錄</option>';
  tocList.innerHTML = '';

  if (chapters.length === 0) {
    tocList.innerHTML = '<div style="color: #888; grid-column: 1 / -1; text-align: center; padding: 20px;">作者目前正準備上架各章節，敬請期待！</div>';
    return;
  }

  chapters.forEach(ch => {
    const cleanTitle = getCleanChapterTitle(ch.index, ch.title);
    const opt = document.createElement('option');
    opt.value = ch.index;
    opt.text = ch.isUnlocked
      ? cleanTitle
      : `${cleanTitle} 🔒 (${ch.publishDate ? ch.publishDate.substring(5) : '即將解鎖'})`;
    select.appendChild(opt);

    const tocItem = document.createElement('div');
    tocItem.className = 'novel-toc-item' + (ch.isUnlocked ? '' : ' locked');
    tocItem.innerHTML = `
      <div class="toc-item-title">${escapeHtml(cleanTitle)}</div>
      <span class="toc-item-badge ${ch.isUnlocked ? 'toc-badge-unlocked' : 'toc-badge-locked'}">
        ${ch.isUnlocked ? '閱讀' : ('🔒 ' + (ch.publishDate ? ch.publishDate.substring(5) : '鎖定'))}
      </span>
    `;
    tocItem.onclick = () => loadChapter(ch.index);
    tocList.appendChild(tocItem);
  });
}

function toggleNovelDesc() {
  const descEl = document.getElementById('novel-overview-desc');
  const toggleBtn = document.getElementById('novel-desc-toggle-btn');
  if (!descEl) return;
  const isExpanded = descEl.classList.toggle('expanded');
  if (toggleBtn) {
    toggleBtn.innerText = isExpanded ? '收合大綱 ▴' : '展開完整設定大綱 ▾';
  }
}

function showNovelOverview() {
  document.getElementById('novel-overview-section').style.display = 'block';
  document.getElementById('novel-reading-section').style.display = 'none';
  document.getElementById('novel-chapter-select').value = "0";
}

function startReadingLatest() {
  if (!currentNovel || !currentNovel.chapters || currentNovel.chapters.length === 0) return;
  const unlocked = currentNovel.chapters.filter(c => c.isUnlocked);
  const target = unlocked.length > 0 ? unlocked[unlocked.length - 1] : currentNovel.chapters[0];
  loadChapter(target.index);
}

function onChapterSelectChange(val) {
  const idx = parseInt(val, 10);
  if (idx === 0) showNovelOverview();
  else loadChapter(idx);
}

function loadChapter(chapterIndex) {
  if (!currentNovel || !currentNovel.chapters) return;
  const chapter = currentNovel.chapters.find(c => c.index === chapterIndex);
  if (!chapter) return;

  currentChapterIndex = chapterIndex;
  document.getElementById('novel-chapter-select').value = String(chapterIndex);
  document.getElementById('novel-overview-section').style.display = 'none';
  document.getElementById('novel-reading-section').style.display = 'block';
  document.getElementById('novel-modal').scrollTo({ top: 0, behavior: 'smooth' });

  document.getElementById('chapter-num').innerText = `CHAPTER // ${chapter.index}`;
  document.getElementById('chapter-date').innerText = chapter.publishDate ? `發布日期：${chapter.publishDate}` : '';
  document.getElementById('chapter-title').innerText = getCleanChapterTitle(chapter.index, chapter.title);

  const contentBox = document.getElementById('chapter-content-box');
  if (chapter.isUnlocked) {
    const paragraphs = (chapter.content || "").split(/\n+/).filter(p => p.trim() !== "");
    if (paragraphs.length > 0) {
      contentBox.innerHTML = paragraphs.map(p => `<p>${escapeHtml(p.trim())}</p>`).join('');
    } else {
      contentBox.innerHTML = '<p style="text-align:center; color: #888;">（本章暫無內文）</p>';
    }
  } else {
    contentBox.innerHTML = `
      <div class="chapter-locked-card">
        <div class="locked-card-icon">🔒</div>
        <div class="locked-card-title">本章於溫室培育中 · 尚未開放</div>
        <div class="locked-card-date">預計解鎖日期：${chapter.publishDate || '即將上線'}</div>
        <div class="locked-card-tip">
          島主 Famidoc 正在全力以赴創作中！<br>
          親友們歡迎在下方提前留言預測劇情或催更～
        </div>
      </div>
    `;
  }

  document.getElementById('btn-prev-chapter').disabled = (chapterIndex <= 1);
  document.getElementById('btn-next-chapter').disabled = (chapterIndex >= currentNovel.chapters.length);

  renderChapterLikeBtn(chapter);
  const shareBtn = document.getElementById('chapter-share-btn');
  shareBtn.innerHTML = shareIconSvg + 'SHARE CHAPTER';

  fetchChapterComments(chapter.id);
  fetch(`${GAS_URL}?action=updateViewCount&resourceId=${chapter.id}`).catch(() => {});
}

function navigateChapter(delta) {
  loadChapter(currentChapterIndex + delta);
}

function renderChapterLikeBtn(chapter) {
  const likeBtn = document.getElementById('chapter-like-btn');
  const isLiked = localStorage.getItem('liked_' + chapter.id) === 'true';
  likeBtn.className = 'modal-like-btn' + (isLiked ? ' liked' : '');
  likeBtn.innerHTML = heartModalSvg(isLiked) + ' LIKE (' + (chapter.likes || 0) + ')';
}

function handleChapterLike() {
  if (!currentNovel || !currentNovel.chapters) return;
  const chapter = currentNovel.chapters.find(c => c.index === currentChapterIndex);
  if (!chapter) return;
  if (localStorage.getItem('liked_' + chapter.id) === 'true') return;

  localStorage.setItem('liked_' + chapter.id, 'true');
  chapter.likes = (chapter.likes || 0) + 1;
  currentNovel.likes = (currentNovel.likes || 0) + 1;

  renderChapterLikeBtn(chapter);
  document.getElementById('novel-overview-likes').innerHTML = `${heartFilledSvg} 按讚 ${currentNovel.likes}`;
  fetch(`${GAS_URL}?action=addLike&resourceId=${chapter.id}`).catch(() => {});
}

function handleChapterShare() {
  if (!currentNovel) return;
  const shareBtn = document.getElementById('chapter-share-btn');
  const fullUrl = `${appUrl}?id=${encodeURIComponent(currentNovel.id)}&ch=${currentChapterIndex}`;
  copyToClipboardSafe(fullUrl).then(() => {
    shareBtn.innerHTML = '✅ COPIED CHAPTER LINK!';
    setTimeout(() => { shareBtn.innerHTML = shareIconSvg + 'SHARE CHAPTER'; }, 2000);
  });
}

function cycleReaderTheme() {
  const themes = ['reader-theme-dark', 'reader-theme-sepia', 'reader-theme-light'];
  const icons = { 'reader-theme-dark': '🌙', 'reader-theme-sepia': '📜', 'reader-theme-light': '☀️' };
  let currentIdx = themes.indexOf(currentReaderTheme);
  currentReaderTheme = themes[(currentIdx + 1) % themes.length];

  const contentBox = document.getElementById('chapter-content-box');
  const section = document.getElementById('novel-reading-section');

  themes.forEach(t => {
    contentBox.classList.remove(t);
    section.classList.remove(t);
  });
  contentBox.classList.add(currentReaderTheme);
  section.classList.add(currentReaderTheme);
  document.getElementById('reader-theme-btn').innerText = icons[currentReaderTheme];
}

function adjustFontSize(delta) {
  currentReaderFontSize = Math.max(0.95, Math.min(1.6, currentReaderFontSize + delta * 0.1));
  document.getElementById('chapter-content-box').style.setProperty('--novel-font-size', `${currentReaderFontSize}rem`);
}

function closeNovelModal(event) {
  if (event.target === document.getElementById('novel-modal')) closeNovelModalDirect();
}

function closeNovelModalDirect() {
  document.getElementById('novel-modal').style.display = 'none';
  document.body.style.overflow = '';
  syncAmbientAudioState();
}

function fetchChapterComments(chapterId) {
  const listEl = document.getElementById('chapter-comments-list');
  listEl.innerHTML = '<div class="comments-status">讀取本章留言中...</div>';
  safeFetchJson(`${GAS_URL}?action=getComments&resourceId=${chapterId}`, {}, 1, 1200)
    .then(data => {
      const comments = Array.isArray(data) ? data : (data.data || []);
      renderChapterComments(comments);
    })
    .catch(() => {
      listEl.innerHTML = '<div class="comments-status">暫無留言，歡迎搶頭香！</div>';
    });
}

function renderChapterComments(comments) {
  const listEl = document.getElementById('chapter-comments-list');
  listEl.innerHTML = '';
  if (!comments || comments.length === 0) {
    listEl.innerHTML = '<div class="comments-status">目前尚無留言，歡迎發表您對本章的想法！</div>';
    return;
  }
  comments.forEach(c => {
    const div = document.createElement('div');
    div.className = 'comment-card';
    let adminReplyHtml = '';
    if (c.adminReply && c.adminReply.trim() !== '') {
      adminReplyHtml = `
        <div class="admin-reply">
          <div class="admin-reply-header">
            站長回覆 // FAMIDOC CHANG
          </div>
          <div class="admin-reply-body">${escapeHtml(c.adminReply)}</div>
        </div>`;
    }
    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-nick">${escapeHtml(c.nickname)}</span>
        <span class="comment-time">${escapeHtml(c.timestamp)}</span>
      </div>
      <div class="comment-body">${escapeHtml(c.content)}</div>
      ${adminReplyHtml}
    `;
    listEl.appendChild(div);
  });
}

function submitChapterComment() {
  if (!currentNovel || !currentNovel.chapters) return;
  const chapter = currentNovel.chapters.find(c => c.index === currentChapterIndex);
  if (!chapter) return;

  const nickInput = document.getElementById('chapter-comment-nick');
  const contentInput = document.getElementById('chapter-comment-content');
  const submitBtn = document.getElementById('chapter-comment-submit');

  const nick = nickInput.value.trim() || '匿名親友';
  const content = contentInput.value.trim();
  if (!content) { alert('請輸入留言內容！'); return; }

  submitBtn.disabled = true;
  submitBtn.innerText = 'TRANSMITTING...';

  fetch(GAS_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'addComment', resourceId: chapter.id, nickname: nick, content: content })
  }).then(() => {
    contentInput.value = '';
    submitBtn.disabled = false;
    submitBtn.innerText = 'TRANSMIT / 傳送';
    chapter.commentCount = (chapter.commentCount || 0) + 1;
    setTimeout(() => fetchChapterComments(chapter.id), 1200);
  }).catch(() => {
    submitBtn.disabled = false;
    submitBtn.innerText = 'TRANSMIT / 傳送';
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ==========================================================================
// PWA 安裝管理與離線巡島狀態引擎
// ==========================================================================
let deferredPwaPrompt = null;
let pwaToastTimer = null;

function isRunningStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function setupPwaManager() {
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn && isRunningStandalone()) {
    installBtn.style.display = 'none';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    if (installBtn && !isRunningStandalone()) {
      installBtn.style.display = 'inline-flex';
      installBtn.classList.add('pwa-ready-pulse');
    }
    const nativeBtn = document.getElementById('pwa-native-trigger-btn');
    if (nativeBtn) nativeBtn.style.display = 'inline-flex';
  });

  window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    if (installBtn) {
      installBtn.classList.remove('pwa-ready-pulse');
      installBtn.style.display = 'none';
    }
    closePwaModalDirect();
    showPwaToast('🎉 恭喜！「我的AI島」已成功安裝至您的裝置桌面！', 4200);
  });

  window.addEventListener('offline', () => {
    showPwaToast('📡 已切換至離線巡島模式（使用島嶼本地快取運作中）', 4000);
  });

  window.addEventListener('online', () => {
    showPwaToast('🌐 已恢復跨維度網路連線，正在同步最新島嶼狀態', 3200);
  });
}

function handleInstallPwaClick() {
  if (deferredPwaPrompt) {
    triggerNativePwaPrompt();
    return;
  }
  openPwaInstallModal();
}

function triggerNativePwaPrompt() {
  if (!deferredPwaPrompt) {
    openPwaInstallModal();
    return;
  }
  deferredPwaPrompt.prompt();
  deferredPwaPrompt.userChoice.then((choiceResult) => {
    if (choiceResult.outcome === 'accepted') {
      deferredPwaPrompt = null;
      closePwaModalDirect();
    }
  });
}

function openPwaInstallModal() {
  const modal = document.getElementById('pwa-install-modal');
  const stepsBox = document.getElementById('pwa-guide-steps');
  const nativeBtn = document.getElementById('pwa-native-trigger-btn');
  if (!modal || !stepsBox) return;

  if (nativeBtn) {
    nativeBtn.style.display = deferredPwaPrompt ? 'inline-flex' : 'none';
  }

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  if (isRunningStandalone()) {
    stepsBox.innerHTML = `
      <div class="pwa-step-item">
        <span class="pwa-step-num">✓</span>
        <div>您目前已經在<strong>「我的AI島」獨立 App 模式</strong>中巡島！長按桌面圖示還可快速傳送至四大主題展館。</div>
      </div>
    `;
  } else if (isIOS) {
    stepsBox.innerHTML = `
      <div class="pwa-step-item">
        <span class="pwa-step-num">1</span>
        <div>在 iPhone / iPad 的 <strong>Safari 瀏覽器</strong>底部（或右上角），點擊<strong>「分享」按鈕 📤</strong>。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">2</span>
        <div>向下滑動選單，點選<strong>「加入主畫面 (Add to Home Screen) ➕」</strong>。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">3</span>
        <div>點擊右上角<strong>「新增」</strong>，即可在主畫面擁有專屬的「我的AI島」App 圖示！</div>
      </div>
    `;
  } else if (isAndroid) {
    stepsBox.innerHTML = `
      <div class="pwa-step-item">
        <span class="pwa-step-num">1</span>
        <div>點擊 Chrome 瀏覽器右上角的<strong>「選單 ⋮」</strong>按鈕。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">2</span>
        <div>點選<strong>「安裝應用程式 (Install app)」</strong>或<strong>「加到主畫面」</strong>。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">3</span>
        <div>確認安裝後，即可從手機桌面全螢幕一鍵登島！</div>
      </div>
    `;
  } else {
    stepsBox.innerHTML = `
      <div class="pwa-step-item">
        <span class="pwa-step-num">1</span>
        <div>請查看電腦瀏覽器（Chrome / Edge）<strong>網址列最右側</strong>的<strong>「安裝我的AI島 📥 / 🖥️」</strong>小圖示並點擊它。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">2</span>
        <div>或點擊瀏覽器右上角<strong>「⋮ 選單」➔「投放、儲存及分享」➔「安裝頁面為應用程式」</strong>。</div>
      </div>
      <div class="pwa-step-item">
        <span class="pwa-step-num">3</span>
        <div>安裝完成後，即可在桌面或工作列釘選獨立視窗版的「我的AI島」！</div>
      </div>
    `;
  }

  modal.style.display = 'block';
}

function closePwaModal(event) {
  if (event.target === document.getElementById('pwa-install-modal')) {
    closePwaModalDirect();
  }
}

function closePwaModalDirect() {
  const modal = document.getElementById('pwa-install-modal');
  if (modal) modal.style.display = 'none';
}

function showPwaToast(message, durationMs = 3500) {
  const toast = document.getElementById('pwa-toast');
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add('show');
  if (pwaToastTimer) clearTimeout(pwaToastTimer);
  pwaToastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, durationMs);
}
