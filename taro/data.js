// 카드 데이터를 다루는 단일 창구입니다.
// 지금은 브라우저 localStorage에 저장하지만, 나중에 실제 서버/DB로 옮기게 되면
// 이 파일의 getCards/saveCards 내부 구현만 바꾸면 되고 dbr_taro.html, admin.html 쪽 코드는 그대로 둘 수 있습니다.

// 카테고리는 이 6개로 고정합니다. 카드 앞면 아이콘은 이미지가 따로 없으면
// 여기 매핑된 심볼을 자동으로 씁니다 (직접 그린 SVG 선 그림, viewBox 0 0 100 140 기준).
const TAROT_CATEGORIES = [
  {
    name: '경영일반 · 경영전략',
    icon: '<circle cx="50" cy="65" r="30"/><path d="M50 40 L58 65 L50 90 L42 65 Z" stroke-linejoin="round"/><path d="M50 28 L50 35 M50 95 L50 102 M18 65 L25 65 M75 65 L82 65" stroke-linecap="round"/>',
  },
  {
    name: '인사 · 조직',
    icon: '<circle cx="50" cy="24" r="10"/><circle cx="26" cy="92" r="9"/><circle cx="74" cy="92" r="9"/><circle cx="50" cy="60" r="6"/><path d="M50 34 L50 60 M50 60 L26 83 M50 60 L74 83" stroke-linecap="round"/>',
  },
  {
    name: '마케팅 · 세일즈',
    icon: '<path d="M22 68 L58 44 L58 96 L22 82 Z" stroke-linejoin="round"/><path d="M22 68 L22 82 L14 82 L14 68 Z" stroke-linejoin="round"/><path d="M58 54 C74 57 74 83 58 86" stroke-linecap="round"/><path d="M33 84 L38 106" stroke-linecap="round"/>',
  },
  {
    name: '리더십 · 자기계발',
    icon: '<path d="M18 106 L18 90 L34 90 L34 74 L50 74 L50 58 L66 58 L66 42" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 20 L69.3 29.5 L79.3 29.7 L71.3 35.7 L74.2 45.3 L66 39.6 L57.8 45.3 L60.7 35.7 L52.7 29.7 L62.7 29.5 Z" stroke-linejoin="round"/>',
  },
  {
    name: '인문',
    icon: '<path d="M50 38 C40 30 24 30 18 35 L18 98 C24 93 40 93 50 101 C60 93 76 93 82 98 L82 35 C76 30 60 30 50 38 Z" stroke-linejoin="round"/><path d="M50 38 L50 101" stroke-linecap="round"/>',
  },
  {
    name: 'AI · DT',
    icon: '<path d="M55.2 35.5 A30 30 0 0 1 73 45.7" stroke-linecap="round"/><path d="M78.2 54.7 A30 30 0 0 1 78.2 75.3" stroke-linecap="round"/><path d="M73 84.3 A30 30 0 0 1 55.2 94.5" stroke-linecap="round"/><path d="M44.8 94.5 A30 30 0 0 1 27 84.3" stroke-linecap="round"/><path d="M21.8 75.3 A30 30 0 0 1 21.8 54.7" stroke-linecap="round"/><path d="M27 45.7 A30 30 0 0 1 44.8 35.5" stroke-linecap="round"/><circle cx="50" cy="35" r="5"/><circle cx="76" cy="50" r="5"/><circle cx="76" cy="80" r="5"/><circle cx="50" cy="95" r="5"/><circle cx="24" cy="80" r="5"/><circle cx="24" cy="50" r="5"/><path d="M63.9 35.5 L67.3 40.4 L61.4 39.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M82.5 62.3 L80 67.7 L77.5 62.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M68.6 91.8 L62.7 92.3 L66.1 87.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M36.1 94.5 L32.7 89.6 L38.6 90.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 67.7 L20 62.3 L22.5 67.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M31.4 38.2 L37.3 37.7 L33.9 42.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="42" y="57" width="16" height="16" rx="2"/><path d="M46 57 L46 53 M54 57 L54 53 M46 73 L46 77 M54 73 L54 77 M42 61 L38 61 M42 69 L38 69 M58 61 L62 61 M58 69 L62 69" stroke-linecap="round"/>',
  },
];

function tarotCategoryIcon(name) {
  const found = TAROT_CATEGORIES.find((c) => c.name === name);
  return found ? found.icon : null;
}

const TAROT_STORAGE_KEY = 'dbrTarotCards.v1';

const TAROT_DEFAULT_CARDS = [
  {
    id: 1,
    numeral: 'I',
    category: '인사 · 조직',
    title: '삐딱한 인재',
    hook:
      '💡 주어진 일을 남들보다 빨리, 성실하게<br>처리하는 데만 집중하고 계시나요?<br><br>' +
      'AI가 시키는 일을 더 잘하는 시대, ‘없는 문제’를 새롭게<br>찾아내는 삐딱한 텐션이 당신의 무기가 됩니다.',
    body:
      '주어진 일을 남들보다 조금 더 빠르고 성실하게 처리하는 것만으로 스스로를 충분히 유능하고 대체 불가능한 인재라고 믿고 계시나요?<br><br>' +
      '과거엔 성실함이 무기였지만, 잠도 자지 않고 완벽하게 최적화된 전략을 쏟아내는 AI 앞에서는 오히려 가장 취약한 능력이 될 수 있습니다.<br><br>' +
      '지금 조직에 가장 필요한 사람은 정해진 관습과 흐름에 제동을 걸고 ‘없는 문제’를 새롭게 발견하고 정의하는 삐딱하고 창의적인 인재입니다.<br><br>' +
      '안정된 관성에 기대지 말고, 집요한 호기심으로 백지 위에 새로운 질문을 던지며 AI 시대에도 흔들림 없는 나만의 서사를 완성해 보세요.',
    dbrLink: 'https://dbr.donga.com/article/view/1201/article_no/12146',
    color: '#5c2a63',
  },
  {
    id: 2,
    numeral: 'II',
    category: '리더십 · 자기계발',
    title: '책임 경영 리더십',
    hook:
      '🤝 성과 압박에 쫓겨 겉보기에 화려한<br>무리수를 두고 있진 않나요?<br><br>' +
      '진심으로 타인을 배려하며 결과에 온전히 책임지는<br>‘친화적 리더’가 위기 속에서 진짜 신뢰를 얻습니다.',
    body:
      '하반기 실적 압박에 쫓기거나 자신의 권력과 자리를 지키기 위해 회사의 핵심 역량과 무관한 무리한 사업 확장을 시도하고 있진 않나요?<br><br>' +
      '경영학의 새로운 연구에 따르면 타인의 이익을 배려하는 친화성과 도덕적 의무감이 높은 성실한 리더일수록 이런 이기적인 행동을 자제합니다.<br><br>' +
      '이들은 단기적인 성과나 변명으로 자신의 연봉을 방어하기보다는 기꺼이 희생을 감수하고 결과에 온전히 책임지는 단단한 태도를 보입니다.<br><br>' +
      '위기의 순간, 겉보기에 화려한 전략보다 내면의 진정성과 책임감으로 하반기 조직을 든든하게 이끌어갈 진짜 리더의 품격을 증명해 보세요.',
    dbrLink: 'https://dbr.donga.com/article/view/1306/article_no/12155',
    color: '#1f3a52',
  },
  {
    id: 3,
    numeral: 'III',
    category: 'AI · DT',
    title: '곡괭이와 삽',
    hook:
      '⛏️ 화려한 신기술 완제품 경쟁에만 눈이 팔려 있진 않나요?<br><br>골드러시의 진짜 승자는<br>금을 캐러 간 사람이 아니라 도구를 판 사람입니다.',
    body:
      '세상을 뒤흔들 화려한 로봇과 신기술 완제품 경쟁에만 시선을 뺏겨 당장 우리 조직이 수익을 낼 수 있는 진짜 기회를 놓치고 있진 않나요?<br><br>' +
      '19세기 캘리포니아 골드러시의 진짜 승자는 금맥을 좇았던 광부가 아니라 그들의 작업복인 청바지와 채굴 도구를 팔았던 철저한 비즈니스맨이었습니다.<br><br>' +
      '지금의 피지컬 AI 시대에도 화려한 로봇의 외형과 완제품에 집착하기보다 이 생태계를 뒷받침할 핵심 부품과 인프라에서 수익의 기회를 찾아야 합니다.<br><br>' +
      '크고 막연한 한탕을 노리기보다, 더 작고 더 싸게 제품을 다듬어 온 우리만의 단단한 기술력으로 하반기 시장에 확실한 돌파구를 뚫어보세요.',
    dbrLink: 'https://dbr.donga.com/article/view/1904/article_no/12134',
    color: '#5a3a1d',
  },
];

function tarotGetCards() {
  try {
    const raw = localStorage.getItem(TAROT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed.map((card) => {
          const fallback = TAROT_DEFAULT_CARDS.find((d) => d.id === card.id) || {};
          return { ...fallback, ...card };
        });
      }
    }
  } catch (err) {
    console.warn('저장된 카드 데이터를 읽지 못해 기본값을 사용합니다.', err);
  }
  return TAROT_DEFAULT_CARDS;
}

function tarotSaveCards(cards) {
  localStorage.setItem(TAROT_STORAGE_KEY, JSON.stringify(cards));
}

function tarotResetCards() {
  localStorage.removeItem(TAROT_STORAGE_KEY);
}

const TAROT_PASSWORD_KEY = 'dbrTarotAdminPassword.v1';
const TAROT_DEFAULT_PASSWORD = '1234';

function tarotGetPassword() {
  return localStorage.getItem(TAROT_PASSWORD_KEY) || TAROT_DEFAULT_PASSWORD;
}

function tarotSavePassword(newPassword) {
  localStorage.setItem(TAROT_PASSWORD_KEY, newPassword);
}

const TAROT_SITE_STORAGE_KEY = 'dbrTarotSite.v1';

const TAROT_DEFAULT_SITE = {
  title: '7월 1주 차 비즈니스 타로\n“하반기 돌파의 무기”',
  lede1: '본격적인 하반기 레이스가 막을 올리는 7월의 첫 시작.\n실전 현장에서 돌파구를 뚫고 승기를 꽂아줄 하반기 돌파의 무기는 무엇일까요?',
  lede2: '정답은 없습니다. 가장 먼저 시선이 멈추는 카드를 딱 하나만 골라보세요.',
  instructionSub: '나를 레벨업 시켜줄 DBR 인사이트가 기다립니다',
  instagramUrl: '',
  openChatUrl: '',
};

function tarotGetSite() {
  try {
    const raw = localStorage.getItem(TAROT_SITE_STORAGE_KEY);
    if (raw) {
      return { ...TAROT_DEFAULT_SITE, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('저장된 메인 화면 문구를 읽지 못해 기본값을 사용합니다.', err);
  }
  return TAROT_DEFAULT_SITE;
}

function tarotSaveSite(site) {
  localStorage.setItem(TAROT_SITE_STORAGE_KEY, JSON.stringify(site));
}

function tarotResetSite() {
  localStorage.removeItem(TAROT_SITE_STORAGE_KEY);
}

// ---------- 구글 시트 연동 ----------
// 구글 시트가 원본입니다.
//   · 관리자가 저장하면  → 오늘 날짜 탭에 기록됩니다 (쓰기, 토큰 필요)
//   · 방문자가 접속하면  → 가장 최근 날짜 탭을 읽어 화면에 반영합니다 (읽기, 토큰 불필요)
//
// ⚠️ 아래 URL은 반드시 채워야 방문자 화면에 반영됩니다.
//    Apps Script를 웹앱으로 배포하고 받은 https://script.google.com/macros/s/.../exec 주소를
//    여기에 붙여넣은 뒤 커밋·배포하세요. 방문자 브라우저에는 localStorage가 없으므로
//    이 주소가 코드에 들어 있어야만 시트를 읽어올 수 있습니다.
const TAROT_SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyRXgkeS340NJ5RLpGkBhTR-twoYkHkAuVDtMzdk8UWpzmqHe4aWWyDFIW-P7hwmP7Www/exec';

// 쓰기용 토큰만 관리자 브라우저에 둡니다. 저장소에는 커밋되지 않습니다.
const TAROT_SHEET_CONFIG_KEY = 'dbrTarotSheetSync.v1';

// 관리자 페이지에서 아직 수정할 수 없는 항목들입니다.
// dbr_taro.html에 하드코딩된 현재 값을 그대로 시트에 남깁니다.
const TAROT_SHEET_STATIC = {
  pageTitle: 'DBR 비즈니스 타로',
  instruction: '✦ 카드를 클릭하면 뒤집힙니다 ✦',
  footer: '✦ DBR 비즈니스 타로 · 카드를 뒤집어 하반기 인사이트를 확인하세요 ✦',
};

function tarotGetSheetConfig() {
  try {
    const raw = localStorage.getItem(TAROT_SHEET_CONFIG_KEY);
    // url은 항상 코드의 상수를 씁니다. 예전에 저장해 둔 주소가 남아 있어도 무시합니다.
    if (raw) return { token: '', ...JSON.parse(raw), url: TAROT_SHEET_WEBAPP_URL };
  } catch (err) {
    console.warn('시트 연동 설정을 읽지 못했습니다.', err);
  }
  return { url: TAROT_SHEET_WEBAPP_URL, token: '' };
}

function tarotSaveSheetConfig(config) {
  localStorage.setItem(TAROT_SHEET_CONFIG_KEY, JSON.stringify({
    url: TAROT_SHEET_WEBAPP_URL,
    token: (config.token || '').trim(),
  }));
}

// 시트 탭 이름은 저장한 날짜로 정합니다 (예: 2026-07-30).
function tarotSheetTabName(date) {
  return tarotTodayKey(date);
}

// 카드 본문은 <br>이 섞인 HTML로 저장돼 있어 시트에는 사람이 읽는 줄바꿈으로 풀어 씁니다.
function tarotHtmlToText(html) {
  const div = document.createElement('div');
  div.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, '\n');
  return div.textContent || '';
}

// 기존 시트 탭들과 같은 key 이름을 씁니다.
function tarotBuildSheetRows(site, cards) {
  const rows = [
    ['page_title', TAROT_SHEET_STATIC.pageTitle, '브라우저 탭에 뜨는 제목 (관리자 페이지에서 수정 불가)'],
    ['h1', site.title || '', '페이지 맨 위 큰 제목'],
    ['lede1', site.lede1 || '', '첫 번째 리드 문단'],
    ['lede2', site.lede2 || '', '두 번째 리드 문단'],
    ['instruction', TAROT_SHEET_STATIC.instruction, '카드 위 안내 문구 (관리자 페이지에서 수정 불가)'],
    ['instruction_sub', site.instructionSub || '', '안내 문구 아래 작은 글씨'],
    ['footer', TAROT_SHEET_STATIC.footer, '페이지 맨 아래 문구 (관리자 페이지에서 수정 불가)'],
    ['instagram_url', site.instagramUrl || '', '하단 "DBR 인스타그램" 링크 주소'],
    ['openchat_url', site.openChatUrl || '', '하단 "DBR 오픈채팅방" 링크 주소'],
  ];

  cards.forEach((card, i) => {
    const n = i + 1;
    rows.push([n + '번 카드', '', '─────────────────']);
    rows.push(['card' + n + '_cat', card.category || '', n + '번 카드 분류']);
    rows.push(['card' + n + '_title', card.title || '', n + '번 카드 제목']);
    rows.push(['card' + n + '_hook', tarotHtmlToText(card.hook), n + '번 카드 훅 (줄바꿈=Alt+Enter)']);
    rows.push(['card' + n + '_body', tarotHtmlToText(card.body), n + '번 카드 본문 (빈 줄=문단 나눔)']);
    rows.push(['card' + n + '_link', card.dbrLink || '', n + '번 카드 DBR 아티클 링크']);
    rows.push(['card' + n + '_color', card.color || '', n + '번 카드 색상']);
  });

  return rows;
}

// 현재 저장된 카드/문구 전체를 오늘 날짜 탭에 기록합니다.
// 성공하면 { ok:true, sheetName, created }, 실패하면 { ok:false, error }를 돌려줍니다.
async function tarotSyncToSheet() {
  const config = tarotGetSheetConfig();
  if (!config.url) {
    return { ok: false, skipped: true, error: '시트 연동이 설정되지 않았습니다.' };
  }

  const payload = {
    token: config.token,
    sheetName: tarotSheetTabName(),
    rows: tarotBuildSheetRows(tarotGetSite(), tarotGetCards()),
  };

  try {
    // Apps Script 웹앱은 CORS 사전 요청(preflight)에 응답하지 못합니다.
    // text/plain으로 보내면 '단순 요청'이 되어 사전 요청 없이 통과합니다.
    const res = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ok: false, error: '서버 응답 오류 (HTTP ' + res.status + ')' };
    }
    return await res.json();
  } catch (err) {
    return { ok: false, error: '시트에 연결하지 못했습니다. URL을 확인해 주세요. (' + err.message + ')' };
  }
}

// ---------- 시트 → 화면 (방문자에게 최신 내용을 보여주는 경로) ----------

// 시트에 저장된 평문을 다시 카드용 HTML로 되돌립니다.
function tarotTextToHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text || '');
  return div.innerHTML.replace(/\n/g, '<br>');
}

// Apps Script 웹앱은 CORS 응답이 불안정해서, 읽기는 <script> 태그로 불러옵니다.
// 공개된 문구만 오가므로 JSONP로도 안전합니다.
function tarotJsonp(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const name = 'tarotCb' + Date.now() + Math.floor(Math.random() * 1e6);
    const script = document.createElement('script');
    let settled = false;

    function cleanup() {
      settled = true;
      delete window[name];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      reject(new Error('시트 응답 시간이 초과되었습니다.'));
    }, timeoutMs || 8000);

    window[name] = (data) => {
      if (settled) return;
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      clearTimeout(timer);
      cleanup();
      reject(new Error('시트에 연결하지 못했습니다. 웹앱 URL과 배포 상태를 확인해 주세요.'));
    };

    // 캐시된 옛 응답을 받지 않도록 매번 다른 주소로 요청합니다.
    script.src = url + (url.indexOf('?') === -1 ? '?' : '&')
      + 'callback=' + name + '&t=' + Date.now();
    document.head.appendChild(script);
  });
}

// 시트에서 읽은 key/value를 앱이 쓰는 형태로 바꿔 저장합니다.
// 시트에 없는 항목(이미지, 숫자 기호 등)은 기존 값을 그대로 둡니다.
function tarotApplySheetData(map) {
  const site = { ...tarotGetSite() };
  if (map.h1) site.title = map.h1;
  if (map.lede1) site.lede1 = map.lede1;
  if (map.lede2) site.lede2 = map.lede2;
  if (map.instruction_sub) site.instructionSub = map.instruction_sub;
  if (map.instagram_url !== undefined) site.instagramUrl = map.instagram_url;
  if (map.openchat_url !== undefined) site.openChatUrl = map.openchat_url;
  tarotSaveSite(site);

  const cards = tarotGetCards().map((card, i) => {
    const prefix = 'card' + (i + 1) + '_';
    const pick = (suffix, fallback) => {
      const value = map[prefix + suffix];
      return value === undefined || value === '' ? fallback : value;
    };
    return {
      ...card,
      category: pick('cat', card.category),
      title: pick('title', card.title),
      hook: tarotTextToHtml(pick('hook', tarotHtmlToText(card.hook))),
      body: tarotTextToHtml(pick('body', tarotHtmlToText(card.body))),
      dbrLink: pick('link', card.dbrLink),
      color: pick('color', card.color),
    };
  });
  tarotSaveCards(cards);
}

// 가장 최근 날짜 탭을 읽어와 화면에 반영합니다.
// 실패하면 직전에 받아둔 내용(localStorage)이나 기본값이 그대로 쓰입니다.
async function tarotLoadFromSheet() {
  if (!TAROT_SHEET_WEBAPP_URL) {
    return { ok: false, skipped: true, error: 'data.js의 TAROT_SHEET_WEBAPP_URL이 비어 있습니다.' };
  }
  try {
    const res = await tarotJsonp(TAROT_SHEET_WEBAPP_URL, 25000);
    if (!res || !res.ok) {
      return { ok: false, error: (res && res.error) || '시트를 읽지 못했습니다.' };
    }
    tarotApplySheetData(res.data || {});
    return { ok: true, sheetName: res.sheetName };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function tarotTodayKey(date) {
  const d = date || new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

// 방문/클릭 수는 콘텐츠와 같은 구글 시트("_stats" 탭)에 기록합니다.
// (예전엔 counterapi.dev라는 무료 익명 카운터를 썼지만 v1이 종료되어 더 이상 못 씁니다.)
// 집계 요청만 보내고 응답은 읽지 않으므로 CORS로 막혀도 상관없습니다 —
// Apps Script는 /exec가 호출되는 시점에 이미 실행되고 시트에 반영됩니다.
function tarotHitStat(key) {
  if (!TAROT_SHEET_WEBAPP_URL) return;
  const url = TAROT_SHEET_WEBAPP_URL
    + (TAROT_SHEET_WEBAPP_URL.indexOf('?') === -1 ? '?' : '&')
    + 'action=hit&key=' + encodeURIComponent(key);
  fetch(url).catch(() => {});
}

// 관리자 페이지에서 이번 주/누적 값을 한 번에 읽어옵니다. (읽기라 JSONP로 불러옵니다)
async function tarotGetStats() {
  if (!TAROT_SHEET_WEBAPP_URL) return { ok: false, error: 'data.js의 TAROT_SHEET_WEBAPP_URL이 비어 있습니다.' };
  const url = TAROT_SHEET_WEBAPP_URL
    + (TAROT_SHEET_WEBAPP_URL.indexOf('?') === -1 ? '?' : '&')
    + 'action=stats';
  try {
    const res = await tarotJsonp(url, 25000);
    if (!res || !res.ok) return { ok: false, error: (res && res.error) || '통계를 읽지 못했습니다.' };
    return res;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
