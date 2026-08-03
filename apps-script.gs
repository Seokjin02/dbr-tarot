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
    // 날짜가 바뀌면 새 탭이 맨 앞에 생깁니다.
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(name);
    const created = !sheet;
    if (created) {
      sheet = ss.insertSheet(name, 0);
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
  try {
    return respond(readLatest(), callback);
  } catch (err) {
    return respond({ ok: false, error: String(err) }, callback);
  }
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
