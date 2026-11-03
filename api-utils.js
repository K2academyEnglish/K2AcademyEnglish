/* ===================== 외부 호스팅용 GAS 통신 브릿지 ===================== */
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxT3cLH186aTrATC7ldGeMWqzrx5QlcieOE9YNqGAwebhmczRg-vZQFaxy2i15aiOy7/exec';

if (typeof google === 'undefined' || !google.script) {
  function createGasRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get: function(target, prop) {
        if (prop === 'withSuccessHandler') {
          return function(fn) { return createGasRunner(fn, failureHandler); };
        }
        if (prop === 'withFailureHandler') {
          return function(fn) { return createGasRunner(successHandler, fn); };
        }
        return function(...args) {
          // 구글 스크립트 doPost로 요청 전송 (CORS 사전 요청 방지를 위해 text/plain 사용)
          fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ func: prop, args: args })
          })
          .then(res => res.json())
          .then(res => {
            if (res && res.ok) {
              if (typeof successHandler === 'function') successHandler(res.data);
            } else {
              const errMsg = (res && res.error) ? res.error : 'Server Error';
              if (typeof failureHandler === 'function') failureHandler(errMsg);
              else console.error('GAS Error:', errMsg);
            }
          })
          .catch(err => {
            if (typeof failureHandler === 'function') failureHandler(err);
            else console.error('Fetch Error:', err);
          });
        };
      }
    });
  }

  window.google = {
    script: {
      run: createGasRunner(null, null),
      url: {
        getLocation: function(callback) {
          const params = new URLSearchParams(window.location.search);
          const parameters = {};
          const parameter = {};
          for (const [key, val] of params.entries()) {
            if (!parameters[key]) parameters[key] = [];
            parameters[key].push(val);
            if (parameter[key] === undefined) parameter[key] = val;
          }
          callback({
            href: window.location.href,
            hash: window.location.hash ? window.location.hash.replace(/^#/, '') : '',
            parameter: parameter,
            parameters: parameters
          });
        }
      }
    }
  };
}

/* ===================== 공통 유틸 ===================== */
function syncLoginUI() { refreshHeaderAuth(); }
function escapeHTML(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function hasGsRun(){ try{ return typeof google!=='undefined' && google.script && google.script.run; }catch(e){ return false; } }
function toOneLine(html){ return String(html||'').replace(/^(?:\s|<br>)+/gi,'').replace(/(?:\s*<br>\s*)+/gi,' ').replace(/\s+/g,' ').trim(); }

let _globalToastTimer = null; // [신규] 타이머 중첩 방지용 전역 변수

// [신규] 화면 가림 없는 비동기 알림창 (Toast)
function showToast(message, type = 'info') {
    let toast = document.getElementById('globalToast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = 'position:fixed; bottom:80px; right:20px; padding:12px 20px; border-radius:8px; color:#fff; font-size:14px; font-weight:bold; z-index:9999; box-shadow:0 4px 12px rgba(0,0,0,0.15); transition:opacity 0.3s;';
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === 'success' ? '#059669' : (type === 'error' ? '#dc2626' : '#2b6cb0');
    toast.innerHTML = message;
    toast.style.opacity = '1';
    toast.style.display = 'block';

    // 1. 기존에 돌고 있던 숨김 타이머 강제 종료 (덮어쓰기 방지)
    if (_globalToastTimer) {
        clearTimeout(_globalToastTimer);
    }

    // 2. 타입에 따라 화면 노출 시간 차등 적용 (성공 시 4초, 그 외 2.5초)
    const duration = (type === 'success') ? 4000 : 2500;

    // 3. 새로운 단일 타이머 세팅
    _globalToastTimer = setTimeout(() => { 
        toast.style.opacity = '0'; 
        setTimeout(() => toast.style.display = 'none', 300); 
    }, duration);
}

// [추가] 해설 토글 기능
function toggleExplanation(btn, idx) {
    const parent = btn.closest('.question-card');
    const box = parent.querySelector('.explanation-box');
    if(!box) return;
    const isHidden = (window.getComputedStyle(box).display === 'none');
    box.style.display = isHidden ? 'block' : 'none';
    btn.textContent = isHidden ? '닫기' : '해설';
    btn.style.background = isHidden ? '#4b5563' : '#6b7280';
}

function normalizeImgSrc(u){
  if(!u) return ''; 
  var url = String(u).trim();
  if(/^(https?:|data:)/i.test(url)) return url; 
  return '';
}

    // [신규] 무지개 색상 적용 헬퍼 함수
    function applyRainbow(str) {
      var colors = ['#dc2626', '#d97706', '#eab308', '#059669', '#2b6cb0', '#4f46e5', '#7c3aed'];
      var res = '';
      var idx = 0;
      for (var i = 0; i < str.length; i++) {
        if (str[i].trim() === '') {
          res += str[i];
        } else {
          // 인쇄 시에도 색상이 유지되도록 !important 및 print-color-adjust 속성 추가
          res += '<span style="color:' + colors[idx % colors.length] + ' !important; -webkit-print-color-adjust: exact; print-color-adjust: exact;">' + str[i] + '</span>';
          idx++;
        }
      }
      return res;
    }

    function sanitizeInlineHTML(input) {
      // 1. 입력을 안전한 문자열로 변환
  var raw = String(input == null ? '' : input).trim().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

  // 2. 먼저 일반적인 이스케이프 처리를 수행 (표 내부의 태그까지 다 글자로 바뀜)
  var s = escapeHTML(raw.replace(/\r?\n/g, '<br>'))
          .replace(/&lt;br\s*\/?&gt;/gi, '<br>');

  // 3. 표(table) 태그는 이때 복구 (이스케이프 된 &lt;table&gt;을 진짜 <table>로 변경)
  // 이제 표를 파싱하면 표 안의 태그들도 안전하게 HTML로 처리됩니다.
  s = s.replace(/&lt;table&gt;([\s\S]*?)&lt;\/table&gt;/gi, function(match, content) {
      // &lt;와 &gt;를 원래대로 돌려놓고 파싱
      const realContent = content.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      return parseSimplifiedTable('<table>' + realContent + '</table>');
  });

  // 4. 나머지 기본 태그 처리
  s = s.replace(/&lt;(u|b|i|strong|em|sub|sup|center)\b[^&]*&gt;/gi, '<$1>')
       .replace(/&lt;\/(u|b|i|strong|em|sub|sup|center)\s*&gt;/gi, '</$1>');

  s = s.replace(/&lt;c&gt;/gi, '<center>').replace(/&lt;\/c&gt;/gi, '</center>');
  s = s.replace(/&lt;(?:right|r)&gt;/gi, '<div style="text-align:right; font-size:calc(1em - 1pt);">')
       .replace(/&lt;\/(?:right|r)&gt;/gi, '</div>');
  s = s.replace(/&lt;box&gt;/gi, '<div class="exam-q-box">')
       .replace(/&lt;\/box&gt;/gi, '</div>');
  
  // 색상 태그 처리 (클래스 기반으로 변경)
  s = s.replace(/&lt;red&gt;/gi, '<span class="txt-red">').replace(/&lt;\/red&gt;/gi, '</span>');
  s = s.replace(/&lt;blue&gt;/gi, '<span class="txt-blue">').replace(/&lt;\/blue&gt;/gi, '</span>');
  s = s.replace(/&lt;green&gt;/gi, '<span class="txt-green">').replace(/&lt;\/green&gt;/gi, '</span>');
  s = s.replace(/&lt;orange&gt;/gi, '<span class="txt-orange">').replace(/&lt;\/orange&gt;/gi, '</span>');
  s = s.replace(/&lt;rainbow&gt;([\s\S]*?)&lt;\/rainbow&gt;/gi, function(match, p1) { return applyRainbow(p1); });

  // 5. 이미지 태그 처리
  s = s.replace(/&lt;img\b[^&]*?src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s&>]+))[^&]*?&gt;/gi, function(_, g1, g2, g3) {
    var rawSrc = g1 || g2 || g3 || '', final = normalizeImgSrc(rawSrc) || rawSrc;
    return '<img src="' + final + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + (rawSrc.replace(/"/g, '&quot;')) + '">';
  });

  // 6. 드라이브 링크 처리
  s = s.replace(/drive:([A-Za-z0-9_-]{20,})/g, function(_, id) {
    return '<img src="' + normalizeImgSrc(id) + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + id + '">';
  });

  s = s.replace(/(^|[^"'])(https?:\/\/[^\s<"']+\.(?:jpe?g|png|gif|webp|bmp))/gi, function(match, prefix, url) {
    return prefix + '<img src="' + url + '" loading="lazy" referrerpolicy="no-referrer" data-src-original="' + url + '">';
  });

  return s;
}

/* [신규] 파이프(|) 구분자를 HTML 테이블로 자동 변환하는 파서 */
function parseSimplifiedTable(rawContent) {
  return rawContent.replace(/<table>([\s\S]*?)<\/table>/gi, (match, content) => {
    // 줄바꿈(<br>)을 기준으로 행을 구분하도록 변경
    const lines = content.trim().split(/<br\s*\/?>/gi);
    const validLines = lines.map(line => line.trim()).filter(line => line !== "");

    let maxCols = 0;
    const rows = validLines.map(line => {
      const cells = line.split('|').map(c => c.trim());
      if (cells.length > maxCols) maxCols = cells.length;
      return cells;
    });

    // 1. 셀 데이터 객체화 및 세로 병합(rowspan) 계산
        const cellData = rows.map(cells => {
            return cells.map(c => ({ text: c, rowspan: 1, skip: false }));
        });

        for (let r = 1; r < cellData.length; r++) {
            for (let c = 0; c < cellData[r].length; c++) {
                // 현재 칸이 비어있다면 세로 병합 대상일 가능성이 높음
                if (cellData[r][c] && cellData[r][c].text === "") {
                    let prevR = r - 1;
                    // 바로 위 칸이 이미 병합되어 숨겨진(skip) 상태라면 그 위로 계속 탐색
                    while (prevR >= 0 && cellData[prevR][c] && cellData[prevR][c].skip) {
                        prevR--;
                    }
                    // 유효한 윗칸을 찾았다면 높이를 1 늘리고, 현재 칸은 렌더링 생략(skip)
                    if (prevR >= 0 && cellData[prevR][c]) {
                        cellData[prevR][c].rowspan += 1;
                        cellData[r][c].skip = true;
                    }
                }
            }
        }

    // 2. HTML 렌더링
    let html = '<table style="width:100%; border-collapse:collapse; border:1px solid #ddd; margin:10px 0;">';
    cellData.forEach((cells, rowIndex) => {
      html += '<tr>';
      const colSpanValue = (maxCols - cells.length) + 1;
      cells.forEach((cellObj, index) => {
        if (cellObj.skip) return; // 세로 병합된 빈 칸은 렌더링 생략

        const isLastCell = (index === cells.length - 1);
        const colspanAttr = (isLastCell && colSpanValue > 1) ? `colspan="${colSpanValue}"` : '';
        const rowspanAttr = (cellObj.rowspan > 1) ? `rowspan="${cellObj.rowspan}"` : '';
        
        // 속성(Attribute) 조합
        const attrs = [colspanAttr, rowspanAttr].filter(Boolean).join(' ');

        // 표 내부의 태그를 HTML로 다시 변환
        let processedCell = cellObj.text
                    .replace(/<c>/gi, '<center>').replace(/<\/c>/gi, '</center>')
                    .replace(/<b>/gi, '<b>').replace(/<\/b>/gi, '</b>')
                    .replace(/<i>/gi, '<i>').replace(/<\/i>/gi, '</i>')
                    .replace(/<u>/gi, '<u>').replace(/<\/u>/gi, '</u>')
                    .replace(/<red>/gi, '<span class="txt-red">').replace(/<\/red>/gi, '</span>')
                    .replace(/<blue>/gi, '<span class="txt-blue">').replace(/<\/blue>/gi, '</span>')
                    .replace(/<green>/gi, '<span class="txt-green">').replace(/<\/green>/gi, '</span>')
                    .replace(/<orange>/gi, '<span class="txt-orange">').replace(/<\/orange>/gi, '</span>')
                    .replace(/<rainbow>([\s\S]*?)<\/rainbow>/gi, function(match, p1) { return applyRainbow(p1); })
                    .replace(/;;/g, '<br>'); // ;; 기호를 셀 내부 줄바꿈으로 처리
    
            html += `<td ${attrs} style="border:1px solid #ddd; padding:8px; text-align:left;">${processedCell}</td>`;
      });
        html += '</tr>';
      });
    html += '</table>';
    return html;
  });
}


// 서술형 괄호 [] 패턴 비교 함수
function compareWithBrackets(input, template) {
  // 템플릿(정답) 소문자화 및 기호 제거
  let pattern = template.toLowerCase().trim().replace(/[.,?!]/g, '');

  // [A/B] 패턴을 (A|B) 정규식 그룹으로 변환
  pattern = pattern.replace(/\[([^\]]+)\]/g, function(match, contents) {
    const alts = contents.split('/').map(s => s.trim()).join('|');
    return '(' + alts + ')';
  });

  // 공백 유연성 처리
  pattern = pattern.replace(/\s+/g, '\\s*');
  
  try {
    const reg = new RegExp('^' + pattern + '$', 'i');
    return reg.test(input);
  } catch (e) {
    return input === template.toLowerCase().trim().replace(/[.,?!]/g, '');
  }
}

/* ===================== [신규] 예쁜 커스텀 팝업 (URL 알림 제거용) ===================== */

// 1. 확인창 (Confirm 대체)
function showCustomConfirm(msg, yesCallback) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const box = document.createElement('div');
    box.className = 'popup-box confirm';
    
    const text = document.createElement('div');
    text.className = 'popup-text confirm-text';
    text.innerHTML = msg.replace(/\n/g, '<br>');
    
    const btnGroup = document.createElement('div');
    btnGroup.className = 'popup-btn-group';
    
    const btnNo = document.createElement('button');
    btnNo.className = 'popup-btn no';
    btnNo.innerText = "취소";
    btnNo.onclick = function() { document.body.removeChild(overlay); };
    
    const btnYes = document.createElement('button');
    btnYes.className = 'popup-btn yes';
    btnYes.innerText = "확인";
    btnYes.onclick = function() {
        document.body.removeChild(overlay);
        if(yesCallback) yesCallback();
    };
    
    btnGroup.appendChild(btnNo);
    btnGroup.appendChild(btnYes);
    box.appendChild(text);
    box.appendChild(btnGroup);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// 2. 알림창 (Alert 대체)
function showCustomAlert(msg) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';
    
    const box = document.createElement('div');
    box.className = 'popup-box alert';
    
    const text = document.createElement('div');
    text.className = 'popup-text';
    text.innerHTML = msg.replace(/\n/g, '<br>');
    
    const btn = document.createElement('button');
    btn.className = 'popup-btn yes full';
    btn.innerText = "확인";
    btn.onclick = function() { document.body.removeChild(overlay); };
    
    box.appendChild(text);
    box.appendChild(btn);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
}

// 3. 이미지 전용 팝업 및 난이도 가이드 호출 함수
function showImagePopup(imgUrl) {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay dark';
    
    const box = document.createElement('div');
    box.className = 'popup-box img';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'popup-close-btn';
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = function() { document.body.removeChild(overlay); };
    
    const img = document.createElement('img');
    img.className = 'popup-img-content';
    img.src = imgUrl;
    
    box.appendChild(closeBtn);
    box.appendChild(img);
    overlay.appendChild(box);
    
    overlay.onclick = function(e) {
        if (e.target === overlay) document.body.removeChild(overlay);
    };
    
    document.body.appendChild(overlay);
}

function showDifficultyGuide() {
    showImagePopup('https://i.imgur.com/aXAiKUV.jpeg');
}
