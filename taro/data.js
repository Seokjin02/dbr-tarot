// 카드 데이터를 다루는 단일 창구입니다.
// 지금은 브라우저 localStorage에 저장하지만, 나중에 실제 서버/DB로 옮기게 되면
// 이 파일의 getCards/saveCards 내부 구현만 바꾸면 되고 dbr_taro.html, admin.html 쪽 코드는 그대로 둘 수 있습니다.

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
    frontImage: '',
    backImage: '',
  },
  {
    id: 2,
    numeral: 'II',
    category: '리더십',
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
    frontImage: '',
    backImage: '',
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
    frontImage: '',
    backImage: '',
  },
];

function tarotGetCards() {
  try {
    const raw = localStorage.getItem(TAROT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length === 3) {
        // 이미지 필드가 추가되기 전에 저장된 데이터도 깨지지 않도록 기본값을 채워줍니다.
        return parsed.map((card) => {
          const fallback = TAROT_DEFAULT_CARDS.find((d) => d.id === card.id) || {};
          return { frontImage: '', backImage: '', ...fallback, ...card };
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
