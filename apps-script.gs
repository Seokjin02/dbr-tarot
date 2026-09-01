/**
 * DBR 비즈니스 타로 · 관리자 페이지 → 구글 시트 기록용 Apps Script
 *
 * 이 파일은 사이트에 배포되지 않습니다. 아래 절차로 구글 시트에 붙여서 씁니다.
 *
 *  1. 시트 열기 → 상단 메뉴 [확장 프로그램] → [Apps Script]
 *  2. 기본으로 열리는 Code.gs 내용을 지우고 이 파일 전체를 붙여넣기
 *  3. 아래 SHEET_SYNC_TOKEN 값을 원하는 비밀 문자열로 바꾸고 저장 (Ctrl+S)
 *  4. 우측 상단 [배포] → [새 배포] → 유형 [웹 앱] 선택
 *       - 실행 사용자: 나
 *       - 액세스 권한이 있는 사용자: 모든 사용자
 *  5. [배포] 누르고 권한 승인 → 발급된 웹 앱 URL 복사
 *       (https://script.google.com/macros/s/.../exec 형태)
 *  6. 관리자 페이지 → "구글 시트 연동"에 URL과 토큰 입력 후 저장
 *
 * 코드를 수정하면 [배포] → [배포 관리] → 연필 아이콘 → 버전 "새 버전"으로
 * 다시 배포해야 반영됩니다. URL은 그대로 유지됩니다.
 */

// ⚠️ 반드시 바꾸세요. 관리자 페이지에 입력할 토큰과 똑같아야 합니다.
const SHEET_SYNC_TOKEN = 'CHANGE_ME_비밀토큰';


function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: '요청 본문이 비어 있습니다.' });
    }

    const body = JSON.parse(e.postData.contents);

    // 비밀번호 변경은 시트 기록과 전혀 다른 일이라 먼저 갈라냅니다.
    if (String(body.action || '') === 'setpw') {
      return jsonOut(adminChangePassword(body));
    }

    if (String(body.token || '') !== SHEET_SYNC_TOKEN) {
      return jsonOut({ ok: false, error: '토큰이 일치하지 않습니다.' });
    }

    const name = String(body.sheetName || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) {
      return jsonOut({ ok: false, error: '시트 탭 이름 형식이 올바르지 않습니다: ' + name });
    }

    const rows = body.rows;
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonOut({ ok: false, error: '기록할 데이터가 없습니다.' });
    }

    // 같은 주에 여러 번 저장하면 같은 날짜 탭을 덮어씁니다.
    // 날짜가 바뀌면 새 탭이 생기는데, "누적통계"·"일별통계" 탭은 항상 맨 앞에 고정해두고
    // 그 바로 다음 자리에 새 날짜 탭을 끼워 넣습니다.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    const created = !sheet;
    if (created) {
      const pinned = [STATS_SHEET_NAME, STATS_DAILY_SHEET_NAME]
        .filter(function (n) { return !!ss.getSheetByName(n); }).length;
      sheet = ss.insertSheet(name, pinned);
    }

    writeRows(sheet, rows);

    return jsonOut({
      ok: true,
      sheetName: name,
      created: created,
      rowCount: rows.length,
    });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

/**
 * 방문자 화면이 최신 내용을 읽어가는 통로입니다.
 * 날짜(YYYY-MM-DD) 형식 탭 중 가장 최근 것을 골라 key/value로 돌려줍니다.
 *
 * 브라우저에서 바로 부르면 CORS에 막힐 수 있어 JSONP(?callback=)를 지원합니다.
 * 토큰이 없어도 읽을 수 있습니다. 어차피 공개 페이지에 뿌려지는 내용입니다.
 */
function doGet(e) {
  const callback = (e && e.parameter && e.parameter.callback) || '';
  const action = (e && e.parameter && e.parameter.action) || '';
  try {
    if (action === 'hit') {
      const key = String((e.parameter && e.parameter.key) || '').trim();
      statsIncrement(key);
      return respond({ ok: true }, callback);
    }
    if (action === 'stats') {
      return respond(Object.assign({ ok: true }, statsRead()), callback);
    }
    if (action === 'login') {
      // 비밀번호 원문은 오지 않습니다. 브라우저가 해시한 값만 받아 대조합니다.
      const given = String((e.parameter && e.parameter.h) || '');
      return respond({ ok: true, action: 'login', match: adminCheckHash(given) }, callback);
    }
    return respond(readLatest(), callback);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, callback);
  }
}

/**
 * 방문/클릭 카운터. counterapi.dev(무료 익명 카운터)가 v1을 종료하면서
 * 이 시트를 그대로 카운터 저장소로 씁니다. "누적통계"라는 별도 탭에 키마다
 * 한 행을 두고, 요청이 올 때마다 그 행만 갱신합니다.
 * A열(key)은 코드가 찾아가는 내부용이라 숨겨져 있고, 나머지 열이 사람이 보는 값입니다.
 */
const STATS_SHEET_NAME = '누적통계';
const STATS_SHEET_LEGACY_NAMES = ['_stats']; // 예전 이름. 있으면 데이터 유지한 채 새 이름으로 바꿉니다.
const STATS_KEY_PATTERN = /^[a-z0-9]{1,30}$/;
const STATS_TIMEZONE = 'Asia/Seoul';

// 관리자 페이지 통계 카드와 같은 순서·이름을 씁니다.
const STATS_KEY_ORDER = ['visits', 'card1', 'card2', 'card3', 'dbr1', 'dbr2', 'dbr3'];
const STATS_KEY_LABELS = {
  visits: '이번 주 방문 수',
  card1: '카드 I 클릭',
  card2: '카드 II 클릭',
  card3: '카드 III 클릭',
  dbr1: 'DBR 아티클 클릭 (I)',
  dbr2: 'DBR 아티클 클릭 (II)',
  dbr3: 'DBR 아티클 클릭 (III)',
};

// 시트 칸 배치: A=key(내부용, 숨김) B=항목 C=이번 주 D=누적 E=마지막 갱신 주(내부용)
const STATS_COL = { KEY: 1, LABEL: 2, WEEK: 3, TOTAL: 4, WEEKKEY: 5 };

// 그 주 월요일 날짜(YYYY-MM-DD)를 주간 키로 씁니다. 월요일이 되면 자동으로 새로 시작됩니다.
function statsWeekKey(date) {
  const d = date ? new Date(date) : new Date();
  const day = (d.getDay() + 6) % 7; // 월=0 … 일=6
  d.setDate(d.getDate() - day);
  return 'w' + Utilities.formatDate(d, STATS_TIMEZONE, 'yyyy-MM-dd');
}

function getStatsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATS_SHEET_NAME);

  if (!sheet) {
    for (let i = 0; i < STATS_SHEET_LEGACY_NAMES.length; i++) {
      const legacy = ss.getSheetByName(STATS_SHEET_LEGACY_NAMES[i]);
      if (legacy) { legacy.setName(STATS_SHEET_NAME); sheet = legacy; break; }
    }
  }

  const needsInit = !sheet || String(sheet.getRange(1, STATS_COL.LABEL).getValue()) !== '항목';

  if (!sheet) {
    sheet = ss.insertSheet(STATS_SHEET_NAME);
  }

  if (needsInit) {
    sheet.clear();
    sheet.getRange(1, 1, 1, 5).setValues([['key', '항목', '이번 주', '누적', '마지막 갱신 주']]);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#efe7d4');
    const rows = STATS_KEY_ORDER.map(function (key) {
      return [key, STATS_KEY_LABELS[key] || key, 0, 0, ''];
    });
    sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 90);
    sheet.setColumnWidth(4, 90);
    sheet.setColumnWidth(5, 140);
    try { sheet.hideColumns(STATS_COL.KEY); } catch (err) { /* 이미 숨겨져 있으면 무시 */ }
  }

  return sheet;
}

// 동시에 여러 방문자가 클릭해도 카운트가 씹히지 않도록 잠금을 걸고 한 번에 하나씩 처리합니다.
function statsIncrement(key) {
  if (!STATS_KEY_PATTERN.test(key)) {
    throw new Error('허용되지 않는 통계 키입니다: ' + key);
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getStatsSheet();
    const lastRow = sheet.getLastRow();
    const data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 5).getValues() : [];
    const wk = statsWeekKey();

    // 모든 항목의 "지금까지 누적" 값을 미리 모아둡니다 (일별통계에 스냅샷으로 남기기 위해).
    const totalsMap = {};
    STATS_KEY_ORDER.forEach(function (k) {
      const row = data.find(function (r) { return r[STATS_COL.KEY - 1] === k; });
      totalsMap[k] = row ? (Number(row[STATS_COL.TOTAL - 1]) || 0) : 0;
    });

    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (data[i][STATS_COL.KEY - 1] === key) { rowIndex = i; break; }
    }

    if (rowIndex === -1) {
      // 미리 정의되지 않은 키는 맨 아래에 새로 추가합니다.
      sheet.appendRow([key, STATS_KEY_LABELS[key] || key, 1, 1, wk]);
      totalsMap[key] = 1;
    } else {
      const rowNum = rowIndex + 2;
      const total = (Number(data[rowIndex][STATS_COL.TOTAL - 1]) || 0) + 1;
      let weekKey = data[rowIndex][STATS_COL.WEEKKEY - 1];
      let weekCount = Number(data[rowIndex][STATS_COL.WEEK - 1]) || 0;
      if (weekKey === wk) {
        weekCount += 1;
      } else {
        weekKey = wk;
        weekCount = 1;
      }
      sheet.getRange(rowNum, STATS_COL.WEEK, 1, 3).setValues([[weekCount, total, weekKey]]);
      totalsMap[key] = total;
    }

    statsDailyIncrement(key, totalsMap);
  } finally {
    lock.releaseLock();
  }
}

// 날짜별 집계. "일별통계" 탭에 날짜(행) x 항목(열) 표로 쌓입니다.
// 항목마다 그날의 "신규" 건수와, 그 시점까지의 "누적" 스냅샷을 함께 남깁니다.
const STATS_DAILY_SHEET_NAME = '일별통계';
const STATS_DAILY_SHEET_LEGACY_NAMES = ['_stats_daily']; // 예전 이름. 있으면 데이터 유지한 채 새 이름으로 바꿉니다.

// 일별통계 표에서만 쓰는 짧은 이름 ("이번 주" 접두어를 빼서 날짜별 표와 헷갈리지 않게 합니다).
const STATS_KEY_LABELS_PLAIN = {
  visits: '방문 수',
  card1: '카드 I 클릭',
  card2: '카드 II 클릭',
  card3: '카드 III 클릭',
  dbr1: 'DBR 아티클 클릭 (I)',
  dbr2: 'DBR 아티클 클릭 (II)',
  dbr3: 'DBR 아티클 클릭 (III)',
};

function statsDailyDateString(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, STATS_TIMEZONE, 'yyyy-MM-dd');
  }
  return String(value || '');
}

// 오늘 자정(한국 시간) 기준 Date 객체. 문자열 대신 실제 날짜 타입으로 저장해야
// 시트에서 정렬·필터가 자연스럽게 됩니다.
function statsTodayDate() {
  const formatted = Utilities.formatDate(new Date(), STATS_TIMEZONE, 'yyyy-MM-dd');
  const parts = formatted.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getStatsDailySheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(STATS_DAILY_SHEET_NAME);

  if (!sheet) {
    for (let i = 0; i < STATS_DAILY_SHEET_LEGACY_NAMES.length; i++) {
      const legacy = ss.getSheetByName(STATS_DAILY_SHEET_LEGACY_NAMES[i]);
      if (legacy) { legacy.setName(STATS_DAILY_SHEET_NAME); sheet = legacy; break; }
    }
  }

  const expectedCols = 1 + STATS_KEY_ORDER.length * 2; // 날짜 + 신규 n개 + 누적 n개
  const needsInit = !sheet
    || String(sheet.getRange(1, 1).getValue()) !== '날짜'
    || sheet.getLastColumn() < expectedCols;

  if (!sheet) {
    sheet = ss.insertSheet(STATS_DAILY_SHEET_NAME);
  }

  if (needsInit) {
    sheet.clear();
    const n = STATS_KEY_ORDER.length;
    const newLabels = STATS_KEY_ORDER.map(function (key) {
      return (STATS_KEY_LABELS_PLAIN[key] || key) + ' (신규)';
    });
    const cumLabels = STATS_KEY_ORDER.map(function (key) {
      return (STATS_KEY_LABELS_PLAIN[key] || key) + ' (누적)';
    });
    const header = ['날짜'].concat(newLabels).concat(cumLabels);
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, 1 + n).setBackground('#efe7d4');
    sheet.getRange(1, 2 + n, 1, n).setBackground('#e4ecf7');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(1);
    sheet.setColumnWidth(1, 100);
    sheet.getRange('A2:A').setNumberFormat('yyyy-mm-dd');
  }

  return sheet;
}

// key: 이번에 발생한 이벤트. totalsMap: 7개 항목 모두의 "지금까지 누적" 값(이 이벤트 반영 후 기준).
function statsDailyIncrement(key, totalsMap) {
  const colIndex = STATS_KEY_ORDER.indexOf(key);
  if (colIndex === -1) return; // 미리 정의된 7개 항목이 아니면 날짜별 표는 건너뜁니다.

  const sheet = getStatsDailySheet();
  const today = statsTodayDate();
  const todayStr = statsDailyDateString(today);
  const n = STATS_KEY_ORDER.length;
  const newCol = colIndex + 2; // A열(날짜) 다음부터 "신규" 열들
  const cumStartCol = 2 + n; // 그 다음부터 "누적" 열들

  const lastRow = sheet.getLastRow();
  let rowNum = -1;
  if (lastRow > 1) {
    const dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < dates.length; i++) {
      if (statsDailyDateString(dates[i][0]) === todayStr) { rowNum = i + 2; break; }
    }
  }

  if (rowNum === -1) {
    const newRow = [today]
      .concat(STATS_KEY_ORDER.map(function () { return 0; }))
      .concat(STATS_KEY_ORDER.map(function (k) { return totalsMap[k] || 0; }));
    sheet.appendRow(newRow);
    rowNum = sheet.getLastRow();
  }

  const newCell = sheet.getRange(rowNum, newCol);
  newCell.setValue((Number(newCell.getValue()) || 0) + 1);

  // 누적 열은 매번 "지금까지의 최신 총계"로 전부 덮어써서, 그날 활동이 없던 항목도 스냅샷이 비지 않게 합니다.
  const cumValues = STATS_KEY_ORDER.map(function (k) { return totalsMap[k] || 0; });
  sheet.getRange(rowNum, cumStartCol, 1, n).setValues([cumValues]);
}

// 관리자 페이지가 한 번에 모든 키의 이번 주/누적 값을 읽어갑니다.
// getStatsSheet()를 거치므로, 옛날 형식 시트가 남아 있으면 여기서도 새 형식으로 정리됩니다.
function statsRead() {
  const sheet = getStatsSheet();
  const wk = statsWeekKey();
  const data = {};

  if (sheet) {
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
      values.forEach(function (row) {
        const key = row[STATS_COL.KEY - 1];
        if (!key) return;
        const total = Number(row[STATS_COL.TOTAL - 1]) || 0;
        const weekKey = row[STATS_COL.WEEKKEY - 1];
        const weekCount = weekKey === wk ? (Number(row[STATS_COL.WEEK - 1]) || 0) : 0;
        data[key] = { total: total, week: weekCount };
      });
    }
  }

  return { weekKey: wk, data: data };
}

function readLatest() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dated = ss.getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) { return /^\d{4}-\d{2}-\d{2}$/.test(n); })
    .sort();

  if (!dated.length) {
    return { ok: false, error: '날짜(YYYY-MM-DD) 형식의 탭이 아직 없습니다. 관리자 페이지에서 한 번 저장해 주세요.' };
  }

  // 문자열 정렬만으로 YYYY-MM-DD는 날짜순이 됩니다. 맨 뒤가 가장 최근입니다.
  const name = dated[dated.length - 1];
  const values = ss.getSheetByName(name).getDataRange().getValues();

  return { ok: true, sheetName: name, data: rowsToMap(values) };
}

// 손으로 만든 기존 탭들은 시작 열이 다를 수 있어, 행마다 key처럼 생긴 칸을 찾고
// 바로 오른쪽 칸을 값으로 읽습니다.
function rowsToMap(values) {
  const KEY = /^(page_title|h1|lede1|lede2|instruction|instruction_sub|footer|instagram_url|openchat_url|card[1-9]_[a-z]+)$/;
  const map = {};

  values.forEach(function (row) {
    for (let i = 0; i < row.length - 1; i++) {
      const key = String(row[i] == null ? '' : row[i]).trim();
      if (KEY.test(key)) {
        map[key] = String(row[i + 1] == null ? '' : row[i + 1]);
        break;
      }
    }
  });

  return map;
}

/**
 * 관리자 비밀번호.
 *
 * 브라우저(localStorage)에 두면 바꿔도 그 컴퓨터에만 적용돼서, 여기 시트에 보관합니다.
 * 이렇게 하면 누가 바꾸든 모든 사람에게 똑같이 적용됩니다.
 *
 * 비밀번호 원문은 브라우저 밖으로 나오지 않습니다.
 *   브라우저: 해시A = SHA256(비밀번호 + 소금)  ← 이 값만 전송
 *   시트    : 해시B = SHA256(해시A)            ← 이 값만 저장
 * 그래서 시트를 들여다봐도 비밀번호를 알 수 없고, 시트 값을 그대로 흉내 내도 로그인되지 않습니다.
 *
 * 비밀번호를 잊었다면 "관리자설정" 탭의 B2 칸을 비우세요. 기본값(1234)으로 돌아갑니다.
 */
const ADMIN_SHEET_NAME = '관리자설정';
const ADMIN_PW_LABEL = '관리자 비밀번호 (해시 · 직접 수정하지 마세요)';
// ⚠️ data.js의 TAROT_PASSWORD_SALT와 반드시 같아야 합니다.
const ADMIN_PW_SALT = 'dbr-tarot-admin';
const ADMIN_DEFAULT_PASSWORD = '1234';

function sha256Hex(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function getAdminSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ADMIN_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_SHEET_NAME, 0);
    sheet.getRange(1, 1, 1, 2).setValues([['항목', '값']]).setFontWeight('bold');
    sheet.getRange(2, 1).setValue(ADMIN_PW_LABEL);
    sheet.setColumnWidth(1, 280);
    sheet.setColumnWidth(2, 460);
  }
  return sheet;
}

// 저장된 값이 없으면 기본 비밀번호를 쓴 것으로 봅니다. 새 시트에서도 잠기지 않도록.
function adminStoredHash() {
  const saved = String(getAdminSheet().getRange(2, 2).getValue() || '').trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(saved)) return saved;
  return sha256Hex(sha256Hex(ADMIN_DEFAULT_PASSWORD + ADMIN_PW_SALT));
}

function adminCheckHash(clientHash) {
  const given = String(clientHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(given)) return false;
  return sha256Hex(given) === adminStoredHash();
}

// 응답에는 항상 action:'setpw'를 넣습니다.
// 예전 버전 Apps Script는 이 표시가 없으므로, 브라우저가 "아직 재배포 안 됨"을 구분할 수 있습니다.
function adminChangePassword(body) {
  if (String(body.token || '') !== SHEET_SYNC_TOKEN) {
    return { ok: false, action: 'setpw', error: '토큰이 일치하지 않습니다.' };
  }
  if (!adminCheckHash(body.currentHash)) {
    return { ok: false, action: 'setpw', error: '현재 비밀번호가 올바르지 않습니다.' };
  }
  const next = String(body.nextHash || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(next)) {
    return { ok: false, action: 'setpw', error: '새 비밀번호를 읽지 못했습니다.' };
  }
  getAdminSheet().getRange(2, 2).setValue(sha256Hex(next));
  return { ok: true, action: 'setpw' };
}

function respond(obj, callback) {
  const body = JSON.stringify(obj);
  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

// 기존 탭과 같은 모양으로 씁니다: B2에 머리글, B3부터 데이터.
function writeRows(sheet, rows) {
  sheet.clear();

  const header = sheet.getRange(2, 2, 1, 3);
  header.setValues([['key', 'value', '설명 (이 열은 건드리지 마세요)']]);
  header.setFontWeight('bold');
  header.setBackground('#efe7d4');

  sheet.getRange(3, 2, rows.length, 3).setValues(rows);

  sheet.setColumnWidth(2, 150);
  sheet.setColumnWidth(3, 620);
  sheet.setColumnWidth(4, 300);
  sheet.getRange(3, 3, rows.length, 1).setWrap(true);
  sheet.getRange(3, 2, rows.length, 1).setFontFamily('Courier New');
  sheet.setFrozenRows(2);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
