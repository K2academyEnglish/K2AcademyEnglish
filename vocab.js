/* ===================== 단어장 ===================== */
// 메인 단어장과 드로어가 같은 VOCAB_CACHE(app-core.js)를 공유합니다.
function vocabList(){ return Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : []; }
let VOCAB_TYPO = {};
let VOCAB_TYPO_READY = false;

function vocabInitTypoOnce(){
  if(VOCAB_TYPO_READY) return;
  if(!hasGsRun()) return;
  google.script.run.withSuccessHandler(function(data){
    VOCAB_TYPO = data || {};
    VOCAB_TYPO_READY = true;
  }).getTypoCorrections();
}
function vocabCorrectTypo(word){
  const lower = String(word||'').toLowerCase();
  return VOCAB_TYPO[lower] || word;
}
let ADMIN_TARGET_VOCAB_USER = null;

function getActiveVocabUser() {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && ADMIN_TARGET_VOCAB_USER) {
    return ADMIN_TARGET_VOCAB_USER;
  }
  return CURRENT_USER;
}

function initAdminVocabMode() {
  const bar = document.getElementById('adminVocabBar');
  const addSec = document.getElementById('vocabAddWordSection');
  
  if (CURRENT_USER && CURRENT_USER.role === 'manager') {
    if (bar) bar.style.display = 'flex';
    // 관리자도 단어를 직접 추가/수정할 수 있도록 단어 추가 섹션 노출
    if (addSec) addSec.style.display = 'block';
    
    // 관리 학생 드롭다운 채우기
    const sel = document.getElementById('adminVocabStudentSelect');
    if (sel && MANAGED_STUDENTS.length > 0 && sel.children.length <= 1) {
      sel.innerHTML = '<option value="">학생 선택</option>' + 
        MANAGED_STUDENTS.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name} (${s.id})</option>`).join('');
    }
    
    // 만약 선택된 학생이 없다면 빈 상태 유지
    if (!ADMIN_TARGET_VOCAB_USER) {
      document.getElementById('wordList').innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">조회할 학생을 선택해주세요.</div>';
      document.getElementById('vocabStats').style.display = 'none';
      return;
    }
    // 이미 고른 학생이 있으면 그 학생 단어장을 다시 표시 (불러온 데이터 재사용)
    vocabLoadWordList();
  } else {
    if (bar) bar.style.display = 'none';
    if (addSec) addSec.style.display = 'block';
    vocabLoadWordList();
  }
}

function onAdminVocabStudentChange(id) {
  if (!id) {
    ADMIN_TARGET_VOCAB_USER = null;
    document.getElementById('wordList').innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">조회할 학생을 선택해주세요.</div>';
    document.getElementById('vocabStats').style.display = 'none';
    return;
  }
  const sel = document.getElementById('adminVocabStudentSelect');
  const opt = sel.options[sel.selectedIndex];
  const name = opt.getAttribute('data-name');
  
  ADMIN_TARGET_VOCAB_USER = { id: id, name: name };
  VOCAB_CACHE = null; // 캐시 초기화 후 새로 로드
  vocabLoadWordList(true);
}

// 학생 본인 또는 관리자가 선택한 학생의 단어장을 불러오는 통합 함수
function vocabLoadWordList(forceReload){
  const targetUser = getActiveVocabUser();
  if(!targetUser) return;
  vocabInitTypoOnce();
  VOCAB_CURRENT_PAGE = 1;
  // 시험 도중 다른 화면에 갔다 오거나 학생을 바꾸면 목록 화면으로 복귀
  const studyBox = document.getElementById('vocabStudy');
  if (studyBox && studyBox.style.display !== 'none' && typeof _vtShowStudy === 'function') { _vtShowStudy(false); studyBox.innerHTML = ''; }

  // 1. 이미 불러온 데이터(캐시)가 있으면 재요청 없이 바로 렌더링
  if(!forceReload && VOCAB_CACHE) {
      const statsEl = document.getElementById('vocabStats');
      const addSecEl = document.getElementById('vocabAddWordSection');
      if(statsEl) statsEl.style.display = 'block';
      if(addSecEl) addSecEl.style.display = 'block';

      renderVocabTableFromData(VOCAB_CACHE);
      vocabUpdateStats();
      return;
  }

  // 2. 로그인 직후 미리 받기가 진행 중이면 그 결과를 기다립니다(중복 요청 방지)
  if(!forceReload && typeof VOCAB_PREFETCH !== 'undefined' && VOCAB_PREFETCH && targetUser === CURRENT_USER) {
    const box = document.getElementById('wordList');
    if (box) box.innerHTML = inlineLoadingHTML('단어장을 펼치는 중...');
    VOCAB_PREFETCH.then(() => { if (getActiveVocabUser() === targetUser) vocabLoadWordList(); });
    return;
  }

  // 3. 서버에서 단어 목록 로드 (화면 전체를 막지 않고 목록 자리에만 로딩 표시)
  if(!hasGsRun()){ showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

  const loadEl = null;
  const listBox = document.getElementById('wordList');
  if (listBox) { listBox.style.display = 'block'; listBox.innerHTML = inlineLoadingHTML('단어장을 펼치는 중...'); }

  const statsEl = document.getElementById('vocabStats');
  const addSecEl = document.getElementById('vocabAddWordSection');
  if(statsEl) statsEl.style.display = 'block';
  if(addSecEl) addSecEl.style.display = 'block';

  vocabUpdateStats();

  google.script.run.withSuccessHandler(function(data) {
    if(loadEl) loadEl.classList.remove('active');
    if (getActiveVocabUser() !== targetUser) return; // 그 사이 학생 변경/로그아웃
    VOCAB_CACHE = data; 
    renderVocabTableFromData(data);
  }).withFailureHandler(err => {
    if(loadEl) loadEl.classList.remove('active');
    showCustomAlert('단어장 불러오기 오류: ' + err);
  }).getVocabulary(targetUser);
}

let _vocabNewWordTimer = null;

function vocabCheckDuplicateInput(el) {
    clearTimeout(_vocabNewWordTimer);
    const statusBox = document.getElementById('newWordStatus');
    if (!statusBox) return;

    _vocabNewWordTimer = setTimeout(() => {
        const rawQuery = el.value.trim().toLowerCase();
        if (!rawQuery) {
            statusBox.innerText = '';
            return;
        }

        // 오타 보정 적용 (응답 도착 시 비교는 보정 전 입력값으로 합니다)
        const query = String(vocabCorrectTypo(rawQuery)).toLowerCase();

        if (!VOCAB_CACHE || !Array.isArray(VOCAB_CACHE)) return;

        // 대소문자 무시하고 정확히 일치하는 단어 찾기
        const duplicate = VOCAB_CACHE.find(item => String(item.word || '').toLowerCase() === query);

        if (duplicate) {
            statusBox.innerHTML = `💡 이미 등록된 단어입니다. (기존 뜻: <b>${escapeHTML(duplicate.meaning)}</b>)`;
            statusBox.style.color = '#d97706'; // 주황색 경고 텍스트
        } else {
            statusBox.innerHTML = '<span style="color:#6b7280; font-size:13px;">추천 뜻을 불러오는 중...</span>';
            if (hasGsRun()) {
                google.script.run
                    .withSuccessHandler(function(translated) {
                        if (translated && document.getElementById('newWord').value.trim().toLowerCase() === rawQuery) {
                            const meanings = translated.split(',').map(s => s.trim()).filter(Boolean);
                            let html = '<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin-top:4px;">' + 
                                       '<span style="color:#2b6cb0; font-size:13px; font-weight:bold; margin-right:4px;">추천 뜻: </span>';
                            
                            meanings.forEach(m => {
                                const safeM = m.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                html += `<button type="button" style="padding:4px 8px; font-size:13px; background:#eff6ff; color:#2b6cb0; border:1px solid #2b6cb0; border-radius:6px; cursor:pointer;" ` +
                                        `onclick="const inp = document.getElementById('newMeaning'); let val = inp.value.trim(); ` +
                                        `if(val) { if(!val.includes('${safeM}')) inp.value = val + ', ' + '${safeM}'; } else { inp.value = '${safeM}'; } ` +
                                        `this.style.background='#dbeafe';">` +
                                        escapeHTML(m) + `</button>`;
                            });
                            html += '</div>';
                            statusBox.innerHTML = html;
                        } else {
                            statusBox.innerText = '';
                        }
                    })
                    .withFailureHandler(function(err) {
                        statusBox.innerText = '';
                    })
                    .getWordTranslation(query);
            } else {
                statusBox.innerText = '';
            }
        }
    }, 300);
}

/* ===================== 단어 수정/저장 기능 ===================== */

// 1. [수정] 버튼 클릭 시: 텍스트를 입력창(input)으로 변환
// 1. 수정 버튼 클릭 시: 텍스트 → 입력창 변환
function vocabEnableEdit(btn, oldWord, oldMeaning) {
  // 1. 버튼이 div 안에 있으므로, 확실하게 표의 칸(td)을 찾기 위해 closest 사용
  const tdAction = btn.closest('td'); 
  
  // 2. 그 앞 칸(뜻), 그 전 칸(영어) 찾기
  const tdMeaning = tdAction.previousElementSibling; 
  const tdWord = tdMeaning.previousElementSibling;

  // 3. 입력창으로 교체 (기존 값 유지)
  tdWord.innerHTML = `<input type="text" value="${escapeHTML(oldWord)}" style="width:100%; box-sizing:border-box; padding:4px; font-size:14px;">`;
  tdMeaning.innerHTML = `<input type="text" value="${escapeHTML(oldMeaning)}" style="width:100%; box-sizing:border-box; padding:4px; font-size:14px;">`;

  // 4. [수정] 버튼을 [저장] 버튼으로 바꿈
  const safeOldWord = String(oldWord).replace(/'/g, "\\'");
  btn.textContent = '저장';
  
  // 스타일 변경 (파란색 저장 버튼)
  btn.className = ''; 
  btn.style.cssText = 'background:#2b6cb0; color:#fff; border:none; padding:4px 8px; font-size:12px; border-radius:4px; cursor:pointer; height:28px; width:auto;';
  
  // 저장 버튼 클릭 이벤트 연결
  btn.onclick = function() { vocabSaveEdit(this, safeOldWord); };
}

// [수정됨] 수정 내용 저장 (DOM 구조 변경 대응)
function vocabSaveEdit(btn, oldWord) {
  const targetUser = getActiveVocabUser();
  if (!targetUser || (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER)) {
    showCustomAlert('조회할 학생을 먼저 선택해주세요.');
    return;
  }

  // 1. 위와 마찬가지로 부모 td 찾기
  const tdAction = btn.closest('td');
  const tdMeaning = tdAction.previousElementSibling;
  const tdWord = tdMeaning.previousElementSibling;

  // 2. 입력된 값 가져오기
  const inputWord = tdWord.querySelector('input');
  const inputMeaning = tdMeaning.querySelector('input');
  
  const newWord = inputWord ? inputWord.value.trim() : '';
  const newMeaning = inputMeaning ? inputMeaning.value.trim() : '';

  if (!newWord || !newMeaning) {
    showCustomAlert('단어와 뜻을 모두 입력해주세요.');
    return;
  }

  // 3. 낙관적 업데이트: 브라우저 캐시 즉시 변경 및 화면 재렌더링
  if (Array.isArray(VOCAB_CACHE)) {
    const itemIndex = VOCAB_CACHE.findIndex(w => w.word === oldWord);
    if (itemIndex > -1) {
      VOCAB_CACHE[itemIndex].word = newWord;
      VOCAB_CACHE[itemIndex].meaning = newMeaning;
    }
  }
  
  // 곧바로 화면 다시 그리기 (로딩창 없음)
  renderVocabTableFromData(VOCAB_CACHE, false);
  
  // 사용자에게 시각적 피드백 제공 (토스트 알림)
  showToast('단어가 수정되었습니다.', 'info');

  // 4. 백그라운드 서버 전송
  google.script.run
    .withFailureHandler(function(err) {
      console.log("단어 수정 백그라운드 실패", err);
      showToast('서버 저장 지연 발생: ' + err, 'error');
    })
    .editWord(targetUser, oldWord, newWord, newMeaning);
}

function vocabSubmitWordToBoth(){
  const targetUser = getActiveVocabUser();
  if(!targetUser || (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER)){
    showCustomAlert('단어를 추가할 학생을 먼저 선택해 주세요.');
    return;
  }
  let word = document.getElementById('newWord').value.trim();
  const meaning = document.getElementById('newMeaning').value.trim();
  if (!word || !meaning) {
    document.getElementById('submitStatus').innerText = '❗ 모든 항목을 입력하세요.';
    return;
  }

  // 1. 입력창 즉시 초기화 및 커서 복귀 (학생 학습 흐름 유지)
  document.getElementById('newWord').value = '';
  document.getElementById('newMeaning').value = '';
  document.getElementById('newWordStatus').innerText = '';
  document.getElementById('submitStatus').innerText = '';
  document.getElementById('newWord').focus();

  word = vocabCorrectTypo(word);
  
  const safeCache = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : [];
  const duplicateEntry = safeCache.find(entry => String(entry.word||'').toLowerCase() === String(word).toLowerCase());

  // 2) 중복 단어라 뜻을 합치는 경우 (낙관적 업데이트)
  if (duplicateEntry) {
    const existingMeanings = String(duplicateEntry.meaning||'').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
    const uniqueMeanings = new Set([...existingMeanings, meaning.toLowerCase()]);
    const updatedMeaning = Array.from(uniqueMeanings).join(', ');
    
    // 메모리 및 화면 즉시 갱신
    duplicateEntry.meaning = updatedMeaning;
    renderVocabTableFromData(VOCAB_CACHE, false);
    vocabUpdateStats();
    
    showToast('이미 있는 단어라 뜻이 병합되었습니다.', 'info');
    
    // 백그라운드 서버 전송
    google.script.run
      .withFailureHandler(function(err){
        console.log("뜻 병합 백그라운드 실패", err);
      })
      .updateWordMeaning(targetUser, word, updatedMeaning);
    return;
  }

  // 3) 새로운 단어 추가하는 경우 (낙관적 업데이트)
  if (!Array.isArray(VOCAB_CACHE)) {
    VOCAB_CACHE = [];
  }
  VOCAB_CACHE.push({
    number: VOCAB_CACHE.length + 1,
    word: word,
    meaning: meaning,
    memorized: false
  });
  
  // 메모리 및 화면 즉시 갱신
  renderVocabTableFromData(VOCAB_CACHE, false);
  vocabUpdateStats();
  
  showToast('단어가 저장되었습니다.', 'success');

  // 백그라운드 서버 전송
  google.script.run
    .withFailureHandler(function(err){
        console.log("새 단어 추가 백그라운드 실패", err);
    })
    .addWordToFormAndSheet(targetUser, word, meaning);
}

function vocabToggleTestMenu() {
  const testSection = document.getElementById('vocabTestInputs');
  const btn = document.getElementById('btnToggleVocabTest');
  if (!testSection || !btn) return;
  
  if (testSection.style.display === 'none') {
    testSection.style.display = 'block';
    btn.innerText = '단어 시험 메뉴 닫기 ▲';
  } else {
    testSection.style.display = 'none';
    btn.innerText = '단어 시험 메뉴 열기 ▼';
  }
}

function vocabStartInlineTest(direction){
  const start = parseInt(document.getElementById('startNum').value, 10);
  const end = parseInt(document.getElementById('endNum').value, 10);
  const count = parseInt(document.getElementById('quizCount').value, 10);

  if (isNaN(start) || isNaN(end) || isNaN(count) || start > end) {
    showCustomAlert('범위를 올바르게 입력하세요.');
    return;
  }

  const sourceList = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : [];
  const rangeData = sourceList.filter(d => d.number >= start && d.number <= end && !d.memorized);
  const selected = rangeData.sort(() => Math.random() - 0.5).slice(0, count);

  document.getElementById('wordList').style.display = 'none';
  document.getElementById('showListBtn').style.display = 'inline-block';

  const quizDiv = document.getElementById('quiz');
  quizDiv.innerHTML = '';

  selected.forEach((item, idx) => {
    const question = (direction === 'engToKor') ? item.word : item.meaning;
    quizDiv.innerHTML += '<div style="margin:10px 0;">' + '<div style="font-weight:700; margin-bottom:6px;">' + (idx + 1) + '. ' + escapeHTML(question) + '</div>' + '<input type="text" id="vq' + idx + '" placeholder="정답 입력">' + '<span id="va' + idx + '" style="margin-left:8px;"></span>' + '</div>';
  });

  quizDiv.innerHTML += '<button type="button" onclick="vocabGrade(\'' + direction + '\')">채점하기</button>';
  quizDiv.dataset.items = JSON.stringify(selected);
}
function vocabGrade(direction){
  const data = JSON.parse(document.getElementById('quiz').dataset.items || '[]');
  let correct = 0;

  data.forEach((item, idx) => {
    const input = document.getElementById('vq' + idx);
    const answer = (input.value || '').trim().toLowerCase();
    const span = document.getElementById('va' + idx);

    if (direction === 'engToKor') {
      const meanings = String(item.meaning||'').toLowerCase().split(',').map(m => m.trim()).filter(Boolean);
      if (answer && meanings.some(m => m === answer || m.includes(answer) || answer.includes(m))) {
        span.textContent = ' ⭑ 정답';
        span.style.color = 'green';
        correct++;
      } else {
        span.textContent = ' → 정답: ' + item.meaning;
        span.style.color = 'red';
      }
    } else {
      if (answer === String(item.word||'').toLowerCase()) {
        span.textContent = ' ⭑ 정답';
        span.style.color = 'green';
        correct++;
      } else {
        span.textContent = ' → 정답: ' + item.word;
        span.style.color = 'red';
      }
    }
  });

  document.getElementById('score').innerText = '✅ ' + correct + ' / ' + data.length + ' 정답!';
  vocabUpdateQuizStats(correct, data.length);
}
function vocabShowWordList(){
  document.getElementById('wordList').style.display = 'block';
  document.getElementById('quiz').innerHTML = '';
  document.getElementById('score').innerText = '';
  document.getElementById('showListBtn').style.display = 'none';
}
function vocabSetupCheckboxListeners(){
  const wordList = document.getElementById('wordList');
  if (!wordList) return;

  // 중복 등록 방지: 최초 1회만 이벤트 위임 설정
  if (!wordList.dataset.listenerAttached) {
    wordList.addEventListener('change', function (event) {
      const target = event.target;
      
      // 이벤트 발생 대상이 '외움' 체크박스인지 확인
      if (target && target.classList.contains('memorized-checkbox')) {
        const targetUser = getActiveVocabUser();
        if (!targetUser) return;

        const word = target.dataset.word;
        const isChecked = target.checked;
        
        // 1. 낙관적 업데이트: 브라우저 캐시(메모리) 즉시 변경
        if (Array.isArray(VOCAB_CACHE)) {
           const item = VOCAB_CACHE.find(w => w.word === word);
           if (item) item.memorized = isChecked;
        }

        // 2. UI 즉시 변경 (행 배경색)
        const tr = target.closest('tr');
        if (tr) {
           tr.style.background = isChecked ? '#f0fdf4' : '';
        }
        
        // 3. 백그라운드 서버 전송 (실패 시 콘솔에 로그만 남기고 화면은 멈추지 않음)
        google.script.run
          .withFailureHandler(function(err) {
             console.log("외움 상태 백그라운드 저장 지연", err);
          })
          .setWordMemorized(targetUser, word, isChecked);
      }
    });
    
    // 리스너가 등록되었음을 표시
    wordList.dataset.listenerAttached = 'true';
  }
}
function vocabUpdateStats(){
  const targetUser = getActiveVocabUser();
  if(!targetUser) return;

  // 브라우저 환경 표준 KST 날짜 계산 (Utilities 참조 오류 제거)
  const now = new Date();
  const kstDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

  google.script.run.withSuccessHandler(function(logData) {
    const arr = Array.isArray(logData) ? logData : [];
    const todayAdded = arr.filter(d => d.action === 'add' && d.date === kstDateStr).length;
    const todayMemorized = arr.filter(d => d.action === 'memorize' && d.date === kstDateStr).length;

    const todayQuiz = parseInt(sessionStorage.getItem('vocab_todayQuiz') || '0', 10);
    const todayCorrect = parseInt(sessionStorage.getItem('vocab_todayCorrect') || '0', 10);

    const addEl = document.getElementById('todayAdded');
    const memoEl = document.getElementById('todayMemorized');
    const qEl = document.getElementById('todayQuiz');
    const cEl = document.getElementById('todayCorrect');

    if(addEl) addEl.innerText = todayAdded;
    if(memoEl) memoEl.innerText = todayMemorized;
    if(qEl) qEl.innerText = todayQuiz;
    if(cEl) cEl.innerText = todayCorrect;
  }).getDailyLogs(targetUser, kstDateStr); // 오늘 기록만 받아 전송량을 줄입니다
}
  
function vocabUpdateQuizStats(correct, total){
  const todayQuiz = parseInt(sessionStorage.getItem('vocab_todayQuiz') || '0', 10) + total;
  const todayCorrect = parseInt(sessionStorage.getItem('vocab_todayCorrect') || '0', 10) + correct;
  sessionStorage.setItem('vocab_todayQuiz', String(todayQuiz));
  sessionStorage.setItem('vocab_todayCorrect', String(todayCorrect));

  document.getElementById('todayQuiz').innerText = todayQuiz;
  document.getElementById('todayCorrect').innerText = todayCorrect;
}
function vocabSearchNaverDict(){
  const word = document.getElementById('newWord').value.trim();
  if (!word) { showCustomAlert('검색할 단어를 입력하세요!'); return; }
  const iframe = document.getElementById('dictFrame');
  const container = document.getElementById('dictContainer');
  const searchUrl = 'https://en.dict.naver.com/#/search?query=' + encodeURIComponent(word);
  iframe.src = searchUrl;
  container.style.display = 'block';
}
function vocabToggleDict(){
  // [수정] 높이 토글 대상을 iframe에서 래퍼(dictFrameWrap)로 변경
  const wrap = document.getElementById('dictFrameWrap');
  const btn = document.getElementById('dictToggleBtn');
  if (wrap.style.height === '0px') {
    wrap.style.height = '400px';
    wrap.style.border = '1px solid #d1d5db';
    btn.innerText = '사전 최소화';
  } else {
    wrap.style.height = '0px';
    wrap.style.border = 'none';
    btn.innerText = '사전 펼치기';
  }
}

function setVocabFabVisible(visible){
  const fab = document.getElementById('btnVocabDrawerFab');
  if (fab) fab.style.display = visible ? 'block' : 'none';
}

function openNavDrawer() {
  const d = document.getElementById('navDrawer'); // 아까 만든 aside 태그 찾기
  const o = document.getElementById('drawerOverlay'); // 검은 배경 찾기
  if(d) d.classList.add('open'); // 'open' 클래스를 붙여서 화면에 보이게 함
  if(o) o.style.display = 'block'; // 배경을 어둡게 처리
}

/* [신규 추가] 좌측 메뉴바 닫기 함수 */
function closeNavDrawer() {
  const d = document.getElementById('navDrawer');
  const o = document.getElementById('drawerOverlay');
  if(d) d.classList.remove('open'); // 'open' 클래스를 떼서 숨김
  if(o) o.style.display = 'none'; // 배경 어두운 것 제거
}

// opts: { word, resultEl, onPick(word) } — 단어장 펼침 영역처럼 입력칸 없이 호출할 때 사용
function fetchDatamuse(type, isMain, opts) {
  opts = opts || {};
  const inputId = isMain ? 'newWord' : 'drawerDictWord';
  const resultId = isMain ? 'datamuseResultMain' : 'datamuseResult';
  
  const inputEl = document.getElementById(inputId);
  const word = (opts.word != null ? String(opts.word) : (inputEl ? inputEl.value : '')).trim();
  const resultBox = opts.resultEl || document.getElementById(resultId);
  if (!resultBox) return;
  if (!word) {
    resultBox.innerHTML = '<span style="color:#dc2626;">단어를 먼저 입력하세요.</span>';
    return;
  }

  resultBox.innerHTML = '검색 중...';

  // [수정] 1순위: 자체 DB 기반 연관어(혼동어휘) 탐색
  if (type === 'trg') {
    const lowerWord = word.toLowerCase();
    let foundGroup = null;
    
  // 혼동어휘 DB가 아직 로드되지 않았다면 최초 1회 로드 후 재실행
    if ((!CONFUSING_WORDS_DB || CONFUSING_WORDS_DB.length === 0) && hasGsRun()) {
      google.script.run.withSuccessHandler(data => {
        CONFUSING_WORDS_DB = data || [];
        fetchDatamuse(type, isMain, opts);
      }).getConfusingWordsFromSheet();
      return;
    }
    if (typeof CONFUSING_WORDS_DB !== 'undefined' && Array.isArray(CONFUSING_WORDS_DB)) {
      foundGroup = CONFUSING_WORDS_DB.find(group => group.some(w => w.toLowerCase() === lowerWord));
    }
    
    if (foundGroup) {
      resultBox.innerHTML = '';
      // 본인 단어를 제외한 짝꿍 단어들만 추출
      const displayData = foundGroup.filter(w => w.toLowerCase() !== lowerWord);
      
      displayData.forEach(w => {
        const chip = document.createElement('span');
        chip.textContent = w;
        chip.style.cssText = 'background:#f3f4f6; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid #2b6cb0; font-weight:bold; color:#2b6cb0;';
        
        chip.onmouseover = function() { this.style.background = '#e5e7eb'; };
        chip.onmouseout = function() { this.style.background = '#f3f4f6'; };
        chip.onclick = function() {
          if (opts.onPick) { opts.onPick(w, chip); return; }
          document.getElementById(inputId).value = w;
          if (isMain) vocabSearchNaverDict();
          else drawerSearchDict(w);
          resultBox.innerHTML = ''; 
        };
        resultBox.appendChild(chip);
      });
      return; // 자체 DB에서 결과를 찾은 경우 API 호출 우회 및 종료
    }
  }

  // [수정] 2순위: 자체 DB에 없거나 type이 다른 경우 외부 API 우회 (Fallback)
  let endpoints = [];
  if (type === 'syn') {
      endpoints.push('https://api.datamuse.com/words?rel_syn=' + encodeURIComponent(word) + '&max=15');
  } else if (type === 'ant') {
      endpoints.push('https://api.datamuse.com/words?rel_ant=' + encodeURIComponent(word) + '&max=15');
  } else if (type === 'trg') {
      const rootLen = Math.max(3, word.length - 2);
      const rootSp = word.substring(0, rootLen) + '*';
      endpoints.push('https://api.datamuse.com/words?sp=' + encodeURIComponent(rootSp) + '&max=15');
      endpoints.push('https://api.datamuse.com/words?rel_cns=' + encodeURIComponent(word) + '&max=15');
      endpoints.push('https://api.datamuse.com/words?sl=' + encodeURIComponent(word) + '&max=15');
  }

  Promise.all(endpoints.map(url => fetch(url).then(res => res.json())))
    .then(results => {
      resultBox.innerHTML = '';
      
      let combined = [];
      results.forEach(arr => {
          if(arr && arr.length) combined = combined.concat(arr);
      });
      
      const uniqueWords = new Set();
      const finalData = [];
      const lowerWord = word.toLowerCase();

      combined.forEach(item => {
          const w = item.word.toLowerCase();
          if (w !== lowerWord && !w.includes(' ') && !uniqueWords.has(w)) {
              uniqueWords.add(w);
              finalData.push(item);
          }
      });

      finalData.sort((a, b) => (b.score || 0) - (a.score || 0));
      const displayData = finalData.slice(0, 15);

      if (displayData.length === 0) {
        resultBox.innerHTML = '결과 없음';
        return;
      }
      
      displayData.forEach(item => {
        const chip = document.createElement('span');
        chip.textContent = item.word;
        chip.style.cssText = 'background:#f3f4f6; padding:6px 12px; border-radius:8px; cursor:pointer; border:1px solid #d1d5db; font-weight:bold; color:#1f2937;';
        
        chip.onmouseover = function() { this.style.background = '#e5e7eb'; };
        chip.onmouseout = function() { this.style.background = '#f3f4f6'; };

        chip.onclick = function() {
          if (opts.onPick) { opts.onPick(item.word, chip); return; }
          document.getElementById(inputId).value = item.word;
          if (isMain) {
            vocabSearchNaverDict(); 
          } else {
            drawerSearchDict(item.word); 
          }
          resultBox.innerHTML = ''; 
        };
        
        resultBox.appendChild(chip);
      });
    })
    .catch(err => {
      resultBox.innerHTML = '<span style="color:#dc2626;">API 호출 오류</span>';
    });
}

let _drawerNewWordTimer = null;
function drawerCheckDuplicateInput(el) {
    clearTimeout(_drawerNewWordTimer);
    const statusBox = document.getElementById('drawerWordStatus');
    if (!statusBox) return;

    _drawerNewWordTimer = setTimeout(() => {
        const rawQuery = el.value.trim().toLowerCase();
        if (!rawQuery) {
            statusBox.innerText = '';
            return;
        }

        const query = String(vocabCorrectTypo(rawQuery)).toLowerCase();
        const cacheToUse = vocabList();
        const duplicate = cacheToUse.find(item => String(item.word || '').toLowerCase() === query);

        if (duplicate) {
            statusBox.innerHTML = `💡 이미 등록된 단어 (뜻: <b>${escapeHTML(duplicate.meaning)}</b>)`;
            statusBox.style.color = '#d97706';
        } else {
            statusBox.innerHTML = '<span style="color:#6b7280;">추천 뜻을 불러오는 중...</span>';
            if (hasGsRun()) {
                google.script.run
                    .withSuccessHandler(function(translated) {
                        if (translated && document.getElementById('drawerWord').value.trim().toLowerCase() === rawQuery) {
                            const meanings = translated.split(',').map(s => s.trim()).filter(Boolean);
                            let html = '<div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center;">' + 
                                       '<span style="color:#2b6cb0; font-weight:bold; margin-right:4px;">추천: </span>';
                            
                            meanings.forEach(m => {
                                const safeM = m.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                html += `<button type="button" style="padding:4px 8px; font-size:12px; background:#eff6ff; color:#2b6cb0; border:1px solid #2b6cb0; border-radius:6px; cursor:pointer;" ` +
                                        `onclick="const inp = document.getElementById('drawerMeaning'); let val = inp.value.trim(); ` +
                                        `if(val) { if(!val.includes('${safeM}')) inp.value = val + ', ' + '${safeM}'; } else { inp.value = '${safeM}'; } ` +
                                        `this.style.background='#dbeafe';">` +
                                        escapeHTML(m) + `</button>`;
                            });
                            html += '</div>';
                            statusBox.innerHTML = html;
                        } else {
                            statusBox.innerText = '';
                        }
                    })
                    .withFailureHandler(function(err) {
                        statusBox.innerText = '';
                    })
                    .getWordTranslation(query);
            } else {
                statusBox.innerText = '';
            }
        }
    }, 300);
}



/* =====================================================================
 * 미니 단어장 (문제 풀이 중) — 오른쪽 고정 패널(PC) / 아래 시트(휴대폰)
 * - 지문 단어 더블클릭/길게 누르기 → 단어 카드(추천 뜻 → 저장)
 * - 저장은 화면에 즉시 반영하고 서버 저장은 뒤에서 순서대로 처리
 * - '이번에 저장한 단어'는 학생별로 이 탭(sessionStorage)에 보관
 * ===================================================================== */
let VOCAB_SAVE_CHAIN = Promise.resolve();
const MINI_DICT_URL = 'https://en.dict.naver.com/#/search?query=';
const MEANING_SUGGEST_CACHE = new Map();

function _miniWordsKey() { return 'k2_mini_words:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function getMiniWords() {
  try { return JSON.parse(sessionStorage.getItem(_miniWordsKey()) || '[]'); } catch (e) { return []; }
}
function setMiniWords(list) {
  try { sessionStorage.setItem(_miniWordsKey(), JSON.stringify(list.slice(0, 200))); } catch (e) {}
}
function rememberMiniWord(word, meaning) {
  const list = getMiniWords().filter(x => x.word !== word);
  list.unshift({ word: word, meaning: meaning, ts: Date.now() });
  setMiniWords(list);
  renderMiniWordList();
}

// 서버 순서 보장 저장 (실패 시 안내)
function _queueVocabServer(funcName, args, failMsg) {
  VOCAB_SAVE_CHAIN = VOCAB_SAVE_CHAIN
    .then(() => gsCall(funcName, args))
    .then(res => { if (typeof res === 'string' && res.indexOf('오류') === 0) throw res; })
    .catch(err => { showToast((failMsg || '단어 저장 실패') + ': ' + escapeHTML(String(err)), 'error'); });
}

/**
 * 단어 빠른 저장 (미니 단어장·단어 카드 공통)
 * 반환: { ok, status:'new'|'merged'|'exists', word, meaning, msg }
 * 서버(addWordToFormAndSheet)가 중복 단어의 뜻 합치기를 직접 처리하므로 항상 같은 함수로 보냅니다.
 */
function vocabQuickSave(rawWord, rawMeaning) {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) {
    return { ok: false, msg: '단어를 추가할 학생을 먼저 선택해 주세요.' };
  }
  const user = getActiveVocabUser(); // 학생 본인 또는 관리자가 고른 학생
  if (!user || !user.id) return { ok: false, msg: '로그인이 필요합니다.' };
  const word = String(vocabCorrectTypo(String(rawWord || '').trim()) || '').trim().toLowerCase();
  const inputMeanings = String(rawMeaning || '').split(',').map(m => m.trim()).filter(Boolean);
  if (!word || !inputMeanings.length) return { ok: false, msg: '단어와 뜻을 모두 입력해주세요.' };

  let merged = inputMeanings.join(', '), status = 'new';
  if (Array.isArray(VOCAB_CACHE)) {
    const dup = VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === word);
    if (dup) {
      const existing = String(dup.meaning || '').split(',').map(m => m.trim()).filter(Boolean);
      const lowerSet = new Set(existing.map(m => m.toLowerCase()));
      const added = inputMeanings.filter(m => !lowerSet.has(m.toLowerCase()));
      if (!added.length) {
        if (user === CURRENT_USER) rememberMiniWord(word, dup.meaning);
        return { ok: true, status: 'exists', word: word, meaning: dup.meaning };
      }
      merged = existing.concat(added).join(', ');
      dup.meaning = merged;
      status = 'merged';
    } else {
      VOCAB_CACHE.push({ number: VOCAB_CACHE.length + 1, word: word, meaning: merged, memorized: false });
    }
  }
  if (user === CURRENT_USER) rememberMiniWord(word, merged);
  _queueVocabServer('addWordToFormAndSheet', [user, word, inputMeanings.join(', ')], '단어 저장 실패');
  if (status === 'new') { const el = document.getElementById('todayAdded'); if (el) el.textContent = (parseInt(el.textContent, 10) || 0) + 1; }
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: { word: word } }));
  return { ok: true, status: status, word: word, meaning: merged };
}

// 이번에 저장한 단어 수정 (단어·뜻 전체 교체)
function vocabQuickEdit(oldWord, newWordRaw, newMeaningRaw) {
  const user = getActiveVocabUser();
  const newWord = String(newWordRaw || '').trim().toLowerCase();
  const newMeaning = String(newMeaningRaw || '').split(',').map(m => m.trim()).filter(Boolean).join(', ');
  if (!user || !newWord || !newMeaning) return false;
  if (Array.isArray(VOCAB_CACHE)) {
    const item = VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === oldWord);
    if (item) { item.word = newWord; item.meaning = newMeaning; }
  }
  if (user === CURRENT_USER) {
    setMiniWords(getMiniWords().map(x => x.word === oldWord ? { word: newWord, meaning: newMeaning, ts: x.ts } : x));
    renderMiniWordList();
  }
  _queueVocabServer('editWord', [user, oldWord, newWord, newMeaning], '단어 수정 실패');
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: { word: newWord } }));
  return true;
}

function renderMiniWordList() {
  const box = document.getElementById('drawerSessionList');
  const cnt = document.getElementById('drawerSessionCount');
  if (!box) return;
  const list = getMiniWords();
  if (cnt) cnt.textContent = list.length;
  if (!list.length) {
    box.innerHTML = '<div class="drawer-muted">아직 저장한 단어가 없어요.</div>';
    return;
  }
  box.innerHTML = list.map(x => `
    <div class="vd-item" data-word="${escapeHTML(x.word).replace(/"/g, '&quot;')}">
      <div class="vd-item-main"><b>${escapeHTML(x.word)}</b><span>${escapeHTML(x.meaning)}</span></div>
      <button type="button" class="vd-btn vd-btn-mini" data-act="edit">수정</button>
    </div>`).join('');
}

function _onMiniListClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const item = btn.closest('.vd-item');
  const word = item ? item.dataset.word : '';
  if (!item) return;
  if (btn.dataset.act === 'edit') {
    const cur = getMiniWords().find(x => x.word === word) || { word: word, meaning: '' };
    item.classList.add('editing');
    item.innerHTML = `
      <div class="vd-edit">
        <input type="text" class="vd-edit-word" value="${escapeHTML(cur.word).replace(/"/g, '&quot;')}">
        <input type="text" class="vd-edit-meaning" value="${escapeHTML(cur.meaning).replace(/"/g, '&quot;')}">
        <div class="vd-edit-actions">
          <button type="button" class="vd-btn vd-btn-ghost" data-act="cancel">취소</button>
          <button type="button" class="vd-btn vd-btn-primary" data-act="save">저장</button>
        </div>
      </div>`;
  } else if (btn.dataset.act === 'cancel') {
    renderMiniWordList();
  } else if (btn.dataset.act === 'save') {
    const w = item.querySelector('.vd-edit-word').value;
    const m = item.querySelector('.vd-edit-meaning').value;
    if (!vocabQuickEdit(word, w, m)) showToast('단어와 뜻을 모두 입력해주세요.', 'error');
    else showToast('단어를 수정했어요.', 'info');
  }
}

// 단어장 원본(중복 확인용)이 없으면 뒤에서 한 번 받아 둡니다.
function drawerEnsureLoaded() {
  if (!CURRENT_USER || Array.isArray(VOCAB_CACHE)) return;
  if (typeof VOCAB_PREFETCH !== 'undefined' && VOCAB_PREFETCH) return;
  const user = CURRENT_USER;
  gsCall('getVocabulary', [user]).then(data => {
    if (CURRENT_USER === user && !Array.isArray(VOCAB_CACHE) && Array.isArray(data)) VOCAB_CACHE = data;
  }).catch(() => {});
}

function isVocabDrawerOpen() {
  const d = document.getElementById('vocabDrawer');
  return !!(d && d.classList.contains('open'));
}
function openVocabDrawer() {
  const d = document.getElementById('vocabDrawer');
  if (!d) return;
  d.classList.add('open');
  document.body.classList.add('vocab-dock-open');
  renderMiniWordList();
  drawerEnsureLoaded();
  vocabInitTypoOnce();
}
function closeVocabDrawer() {
  const d = document.getElementById('vocabDrawer');
  if (d) d.classList.remove('open');
  document.body.classList.remove('vocab-dock-open');
  closeDrawerDict();
}
function toggleVocabDrawer() { isVocabDrawerOpen() ? closeVocabDrawer() : openVocabDrawer(); }

// 사전: PC는 미니 단어장 안에서, 휴대폰은 새 탭으로 크게 엽니다.
function openDictionary(word) {
  const w = String(word || '').trim();
  if (!w) { showToast('사전에서 찾을 단어를 입력하세요.', 'info'); return; }
  const url = MINI_DICT_URL + encodeURIComponent(w);
  const quizActive = document.getElementById('quizPage') && document.getElementById('quizPage').classList.contains('active');
  if (window.innerWidth < 821 || !quizActive) { window.open(url, '_blank', 'noopener'); return; }
  if (!isVocabDrawerOpen()) openVocabDrawer();
  const wrap = document.getElementById('drawerDictWrap');
  const frame = document.getElementById('drawerDictFrame');
  const title = document.getElementById('drawerDictTitle');
  if (title) title.textContent = '네이버 사전: ' + w;
  if (frame) frame.src = url;
  if (wrap) wrap.style.display = 'block';
}
function closeDrawerDict() {
  const wrap = document.getElementById('drawerDictWrap');
  const frame = document.getElementById('drawerDictFrame');
  if (wrap) wrap.style.display = 'none';
  if (frame && frame.src && frame.src !== 'about:blank') frame.src = 'about:blank';
}
// 기존 호출부 호환 (fetchDatamuse 등)
function drawerSearchDict(word) {
  const wEl = document.getElementById('drawerWord');
  if (wEl && word) wEl.value = String(word).trim();
  openDictionary(word);
}

// 미니 단어장 '저장' 버튼
function drawerSaveWord() {
  const wEl = document.getElementById('drawerWord');
  const mEl = document.getElementById('drawerMeaning');
  const st = document.getElementById('drawerSaveStatus');
  const r = vocabQuickSave(wEl ? wEl.value : '', mEl ? mEl.value : '');
  if (!r.ok) { if (st) st.textContent = r.msg; return; }
  if (st) {
    st.textContent = r.status === 'exists' ? `'${r.word}'은(는) 이미 같은 뜻으로 저장되어 있어요.`
                   : r.status === 'merged' ? `'${r.word}'에 새 뜻을 추가했어요.`
                   : `'${r.word}' 저장했어요.`;
    clearTimeout(drawerSaveWord._t);
    drawerSaveWord._t = setTimeout(() => { st.textContent = ''; }, 2500);
  }
  if (wEl) wEl.value = '';
  if (mEl) mEl.value = '';
  const sBox = document.getElementById('drawerWordStatus');
  if (sBox) sBox.innerHTML = '';
  if (wEl) wEl.focus();
}

function vocabResetMiniDrawer() {
  closeVocabDrawer();
  hideWordPopover();
  ['drawerWord', 'drawerMeaning'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['drawerWordStatus', 'drawerSaveStatus', 'drawerSessionList'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
  const cnt = document.getElementById('drawerSessionCount'); if (cnt) cnt.textContent = '0';
}

/* ---------------- 지문 단어 카드 (더블클릭 / 길게 누르기) ---------------- */
const WORD_PICK_RE = /^[A-Za-z][A-Za-z'\-]*(?: [A-Za-z][A-Za-z'\-]*){0,3}$/;
let _wordPickTimer = null;
let _wordPopRange = null;

function fetchMeaningSuggestions(word) {
  const key = word.toLowerCase();
  if (MEANING_SUGGEST_CACHE.has(key)) return MEANING_SUGGEST_CACHE.get(key);
  const p = gsCall('getWordTranslation', [key])
    .then(t => String(t || '').split(',').map(x => x.trim()).filter(Boolean))
    .catch(() => []);
  MEANING_SUGGEST_CACHE.set(key, p);
  return p;
}

function _ensureWordPopover() {
  let pop = document.getElementById('wordPopover');
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'wordPopover';
  pop.className = 'word-popover no-print';
  pop.setAttribute('role', 'dialog');
  pop.innerHTML = `
    <div class="wp-head">
      <input type="text" class="wp-word" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="단어">
      <button type="button" class="wp-btn wp-close" aria-label="닫기">✕</button>
    </div>
    <div class="wp-status"></div>
    <div class="wp-chips"></div>
    <input type="text" class="wp-meaning" placeholder="뜻 (추천 뜻을 누르거나 직접 입력)" autocomplete="off">
    <div class="wp-actions">
      <button type="button" class="wp-btn wp-dict">사전</button>
      <button type="button" class="wp-btn wp-save">단어장에 저장</button>
    </div>`;
  document.body.appendChild(pop);

  pop.addEventListener('mousedown', e => e.stopPropagation());
  pop.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  pop.querySelector('.wp-close').addEventListener('click', hideWordPopover);
  pop.querySelector('.wp-dict').addEventListener('click', () => openDictionary(pop.querySelector('.wp-word').value));
  pop.querySelector('.wp-save').addEventListener('click', _saveFromPopover);
  pop.querySelector('.wp-meaning').addEventListener('keydown', e => { if (e.key === 'Enter') _saveFromPopover(); });
  let editTimer = null;
  pop.querySelector('.wp-word').addEventListener('input', e => {
    clearTimeout(editTimer);
    editTimer = setTimeout(() => _fillWordPopover(e.target.value.trim()), 400);
  });
  pop.querySelector('.wp-chips').addEventListener('click', e => {
    const chip = e.target.closest('.wp-chip');
    if (!chip) return;
    const inp = pop.querySelector('.wp-meaning');
    const parts = inp.value.split(',').map(x => x.trim()).filter(Boolean);
    const m = chip.dataset.m;
    const idx = parts.indexOf(m);
    if (idx >= 0) parts.splice(idx, 1); else parts.push(m);
    inp.value = parts.join(', ');
    chip.classList.toggle('on', idx < 0);
  });
  return pop;
}

function _fillWordPopover(word) {
  const pop = _ensureWordPopover();
  const status = pop.querySelector('.wp-status');
  const chips = pop.querySelector('.wp-chips');
  pop.querySelector('.wp-meaning').value = '';
  chips.innerHTML = '';
  if (!word) { status.innerHTML = '<span class="wp-sub">영어 단어를 입력하면 추천 뜻이 나와요.</span>'; return; }
  const lower = String(vocabCorrectTypo(word) || word).toLowerCase();
  const dup = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === lower) : null;
  status.innerHTML = dup
    ? `📘 이미 저장된 단어: <b>${escapeHTML(dup.meaning)}</b><br><span class="wp-sub">새 뜻을 고르면 추가돼요.</span>`
    : '<span class="wp-sub">추천 뜻을 불러오는 중...</span>';
  fetchMeaningSuggestions(lower).then(list => {
    if (pop.querySelector('.wp-word').value.trim().toLowerCase() !== word.toLowerCase()) return; // 그 사이 단어 변경
    if (!dup) status.innerHTML = list.length ? '<span class="wp-sub">추천 뜻을 눌러 고르세요.</span>' : '<span class="wp-sub">추천 뜻이 없어요. 직접 입력해 주세요.</span>';
    chips.innerHTML = list.map(m => `<button type="button" class="wp-chip" data-m="${escapeHTML(m).replace(/"/g, '&quot;')}">${escapeHTML(m)}</button>`).join('');
  });
}

function _positionWordPopover() {
  const pop = document.getElementById('wordPopover');
  if (!pop || pop.style.display === 'none') return;
  const vv = window.visualViewport;
  const viewH = vv ? vv.height : window.innerHeight;
  const viewTop = vv ? vv.offsetTop : 0;
  if (window.innerWidth < 821) {
    // 휴대폰: 화면 아래쪽 카드 (키보드가 올라오면 그 위로)
    pop.classList.add('wp-sheet');
    pop.style.left = ''; pop.style.top = '';
    pop.style.bottom = Math.max(8, window.innerHeight - (viewH + viewTop) + 8) + 'px';
    return;
  }
  pop.classList.remove('wp-sheet');
  pop.style.bottom = '';
  if (!_wordPopRange) return;
  const rect = _wordPopRange.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let top = rect.bottom + 8;
  if (top + h > viewH - 8) top = rect.top - h - 8;
  let left = rect.left + rect.width / 2 - w / 2;
  left = Math.min(Math.max(8, left), window.innerWidth - w - 8);
  pop.style.top = Math.max(8, top) + 'px';
  pop.style.left = left + 'px';
}

// anchor: 선택 범위(Range) 또는 기준 요소(버튼 등). 단어가 비어 있으면 단어 입력부터 시작합니다.
function showWordPopover(word, anchor) {
  const pop = _ensureWordPopover();
  _wordPopRange = anchor ? (anchor.cloneRange ? anchor.cloneRange() : anchor) : null;
  pop.querySelector('.wp-word').value = word || '';
  pop.style.display = 'block';
  _fillWordPopover(word || '');
  _positionWordPopover();
  vocabInitTypoOnce();
  drawerEnsureLoaded();
  if (!word) setTimeout(() => pop.querySelector('.wp-word').focus(), 0);
}
// 카드를 닫을 때 지문의 단어 선택도 해제합니다(휴대폰에서 선택이 남아 카드가 다시 뜨는 것 방지).
function hideWordPopover() {
  const pop = document.getElementById('wordPopover');
  const wasOpen = pop && pop.style.display !== 'none';
  if (pop) pop.style.display = 'none';
  _wordPopRange = null;
  if (wasOpen) {
    try {
      const sel = window.getSelection();
      const node = sel && sel.anchorNode;
      const el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (el && el.closest('#quizPage')) sel.removeAllRanges();
    } catch (e) {}
  }
}

function _saveFromPopover() {
  const pop = _ensureWordPopover();
  const word = pop.querySelector('.wp-word').value;
  const meaning = pop.querySelector('.wp-meaning').value;
  const r = vocabQuickSave(word, meaning);
  if (!r.ok) { showToast(r.msg, 'error'); return; }
  showToast(r.status === 'exists' ? `'${escapeHTML(r.word)}'은(는) 이미 저장되어 있어요.`
          : r.status === 'merged' ? `'${escapeHTML(r.word)}'에 새 뜻을 추가했어요.`
          : `'${escapeHTML(r.word)}' 단어장에 저장했어요.`, r.status === 'exists' ? 'info' : 'success');
  hideWordPopover();
}

// 지문(문제 풀이 화면) 안에서 영어 단어가 선택되면 단어 카드를 띄웁니다.
function _checkWordSelection() {
  if (!CURRENT_USER || CURRENT_USER.role === 'manager') return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
  const text = sel.toString().replace(/[’‘]/g, "'").trim().replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
  if (!text || text.length > 40 || !WORD_PICK_RE.test(text)) return;
  const node = sel.anchorNode;
  const el = node && (node.nodeType === 1 ? node : node.parentElement);
  if (!el || !el.closest('#quizPage') || el.closest('input, textarea, button, .omr-options-wrap, .op-opt, .op-font-bar')) return;
  showWordPopover(text, sel.getRangeAt(0));
}

function initPassageWordPicker() {
  const schedule = (delay) => { clearTimeout(_wordPickTimer); _wordPickTimer = setTimeout(_checkWordSelection, delay); };
  document.addEventListener('mouseup', e => { if (!e.target.closest || !e.target.closest('#wordPopover')) schedule(200); });
  document.addEventListener('touchend', () => schedule(450));
  // 휴대폰에서 길게 눌러 선택 범위를 조정할 때
  document.addEventListener('selectionchange', () => { if (window.innerWidth < 821) schedule(600); });
  // 카드 밖을 누르면 닫기
  const outside = e => { if (!e.target.closest || !e.target.closest('#wordPopover')) hideWordPopover(); };
  document.addEventListener('mousedown', outside);
  document.addEventListener('touchstart', outside, { passive: true });
  window.addEventListener('scroll', _positionWordPopover, { passive: true });
  window.addEventListener('resize', _positionWordPopover);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', _positionWordPopover);
  const list = document.getElementById('drawerSessionList');
  if (list) list.addEventListener('click', _onMiniListClick);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideWordPopover(); });
}
initPassageWordPicker();


/* =====================================================================
 * 단어장 페이지 목록 (검색 · 보기 탭 · 정렬 · 가리기 · 펼쳐 보기 · 이어서 보기)
 * 데이터는 VOCAB_CACHE(학생 본인 또는 관리자가 고른 학생)를 사용합니다.
 * ===================================================================== */
const VP_PAGE = 80;
const VP = { filter: 'all', sort: 'recent', hideMeaning: false, hideWord: false, query: '', shown: VP_PAGE, open: null };
let _vpBound = false, _vpObserver = null;

function _escAttr(v) { return escapeHTML(String(v == null ? '' : v)).replace(/"/g, '&quot;'); }
function _vpPrefsKey() { return 'k2_vocab_view:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function _vpLoadPrefs() {
  try {
    const o = JSON.parse(localStorage.getItem(_vpPrefsKey()) || '{}');
    if (['all', 'learning', 'done'].includes(o.filter)) VP.filter = o.filter;
    if (['recent', 'old', 'abc'].includes(o.sort)) VP.sort = o.sort;
    VP.hideMeaning = !!o.hideMeaning; VP.hideWord = !!o.hideWord;
  } catch (e) {}
}
function _vpSavePrefs() {
  try { localStorage.setItem(_vpPrefsKey(), JSON.stringify({ filter: VP.filter, sort: VP.sort, hideMeaning: VP.hideMeaning, hideWord: VP.hideWord })); } catch (e) {}
}

function _vpSyncControls() {
  document.querySelectorAll('#vpTabs .vp-tab').forEach(b => b.classList.toggle('on', b.dataset.filter === VP.filter));
  const sort = document.getElementById('vpSort'); if (sort) sort.value = VP.sort;
  document.querySelectorAll('#vocabPage .vp-toggle').forEach(b => {
    b.classList.toggle('on', b.dataset.hide === 'meaning' ? VP.hideMeaning : VP.hideWord);
  });
}

function _vpFiltered(data) {
  const q = VP.query;
  let list = data.filter(x => {
    if (VP.filter === 'learning' && x.memorized) return false;
    if (VP.filter === 'done' && !x.memorized) return false;
    if (!q) return true;
    return String(x.word || '').toLowerCase().includes(q) || String(x.meaning || '').toLowerCase().includes(q);
  });
  const num = x => Number(x.number) || 0;
  if (VP.sort === 'recent') list.sort((a, b) => num(b) - num(a));
  else if (VP.sort === 'old') list.sort((a, b) => num(a) - num(b));
  else list.sort((a, b) => String(a.word || '').localeCompare(String(b.word || '')));
  return list;
}

function _vpRowHtml(x) {
  const w = String(x.word || '');
  const open = VP.open === w.toLowerCase();
  return `
  <div class="vw-row${x.memorized ? ' done' : ''}${open ? ' open' : ''}" data-word="${_escAttr(w)}">
    <div class="vw-num">${escapeHTML(String(x.number || ''))}</div>
    <div class="vw-main">
      <div class="vw-word" title="눌러서 펼치기">${escapeHTML(w)}</div>
      <div class="vw-meaning">${escapeHTML(String(x.meaning || ''))}</div>
    </div>
    <label class="vw-check" title="외움 표시">
      <input type="checkbox" class="vw-memo" ${x.memorized ? 'checked' : ''} aria-label="외움">
      <span>외움</span>
    </label>
    ${open ? _vpDetailHtml() : ''}
  </div>`;
}
function _vpDetailHtml() {
  return `
    <div class="vw-detail">
      <div class="vw-actions">
        <button type="button" class="vw-btn" data-act="dict">사전</button>
        <button type="button" class="vw-btn" data-act="syn">유의어</button>
        <button type="button" class="vw-btn" data-act="ant">반의어</button>
        <button type="button" class="vw-btn" data-act="trg">혼동어휘</button>
        <button type="button" class="vw-btn vw-btn-edit" data-act="edit">수정</button>
      </div>
      <div class="vw-related"></div>
      <div class="vw-editbox"></div>
    </div>`;
}

function _vpUpdateCounts(data) {
  const done = data.filter(x => x.memorized).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('vpCntAll', data.length); set('vpCntLearning', data.length - done); set('vpCntDone', done);
}

function renderVocabPage(keepShown) {
  const box = document.getElementById('wordList');
  if (!box) return;
  _vpBindOnce();
  _vpSyncControls();
  box.classList.toggle('vp-hide-meaning', VP.hideMeaning);
  box.classList.toggle('vp-hide-word', VP.hideWord);

  const data = VOCAB_CACHE;
  if (data && data.error) { box.innerHTML = '<div class="vw-empty">⚠️ ' + escapeHTML(data.error) + '</div>'; return; }
  if (!Array.isArray(data)) return;
  _vpUpdateCounts(data);
  if (!keepShown) VP.shown = VP_PAGE;

  const list = _vpFiltered(data);
  if (!list.length) {
    box.innerHTML = data.length === 0
      ? '<div class="vw-empty">아직 저장한 단어가 없어요.<br><span>[+ 단어 추가] 또는 문제 풀이 중 지문의 단어를 더블클릭해서 모아 보세요.</span></div>'
      : '<div class="vw-empty">조건에 맞는 단어가 없어요.</div>';
  } else {
    const rows = list.slice(0, VP.shown).map(_vpRowHtml).join('');
    const rest = list.length - VP.shown;
    box.innerHTML = '<div class="vw-head"><span></span><span>영어</span><span>뜻</span><span>외움</span></div>' + rows +
      (rest > 0 ? `<button type="button" class="vw-more vw-btn" data-act="more">더 보기 (${rest}개 남음)</button>` : '');
  }
  box.style.display = 'block';
  const elQuiz = document.getElementById('quiz'); if (elQuiz) elQuiz.innerHTML = '';
  const elScore = document.getElementById('score'); if (elScore) elScore.innerText = '';
  const elShowBtn = document.getElementById('showListBtn'); if (elShowBtn) elShowBtn.style.display = 'none';
  _vpObserveMore();
}

// 기존 호출부 호환: 데이터 인자는 무시하고 VOCAB_CACHE 기준으로 다시 그립니다.
function renderVocabTableFromData() { renderVocabPage(false); }

// '더 보기' 버튼이 화면에 들어오면 자동으로 이어서 표시
function _vpObserveMore() {
  if (!('IntersectionObserver' in window)) return;
  if (_vpObserver) _vpObserver.disconnect();
  const more = document.querySelector('#wordList .vw-more');
  if (!more) return;
  _vpObserver = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { VP.shown += VP_PAGE; renderVocabPage(true); }
  }, { rootMargin: '300px 0px' });
  _vpObserver.observe(more);
}

let _vocabSearchTimer = null;
function vocabOnSearchInput(el) {
  clearTimeout(_vocabSearchTimer);
  _vocabSearchTimer = setTimeout(() => {
    VP.query = el.value.trim().toLowerCase();
    renderVocabPage(false);
  }, 200);
}

function _vpFindItem(word) {
  const lower = String(word || '').toLowerCase();
  return Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.find(x => String(x.word || '').toLowerCase() === lower) : null;
}

function _vpSetMemorized(row, checked) {
  const targetUser = getActiveVocabUser();
  const item = _vpFindItem(row.dataset.word);
  if (!targetUser || !item) return;
  item.memorized = checked;
  row.classList.toggle('done', checked);
  _vpUpdateCounts(VOCAB_CACHE);
  if (checked) { const el = document.getElementById('todayMemorized'); if (el) el.textContent = (parseInt(el.textContent, 10) || 0) + 1; }
  google.script.run
    .withFailureHandler(err => showToast('외움 표시 저장 실패: ' + escapeHTML(String(err)), 'error'))
    .setWordMemorized(targetUser, item.word, checked);
}

function _vpHandleAction(row, btn) {
  const word = row.dataset.word;
  const related = row.querySelector('.vw-related');   // 유의어·반의어·혼동어휘 결과
  const editBox = row.querySelector('.vw-editbox');   // 수정 입력칸 (늦게 오는 검색 결과가 덮어쓰지 않도록 분리)
  const act = btn.dataset.act;
  if (act === 'dict') { openDictionary(word); return; }
  if (act === 'syn' || act === 'ant' || act === 'trg') {
    related.style.display = 'flex';
    // 고른 연관어는 단어 카드로 열어 바로 저장할 수 있게
    fetchDatamuse(act, true, { word: word, resultEl: related, onPick: (w, chip) => showWordPopover(w, chip) });
    return;
  }
  if (act === 'edit') {
    const item = _vpFindItem(word) || { word: word, meaning: '' };
    editBox.innerHTML = `
      <div class="vw-edit">
        <input type="text" class="vw-edit-word" value="${_escAttr(item.word)}" aria-label="단어">
        <input type="text" class="vw-edit-meaning" value="${_escAttr(item.meaning)}" aria-label="뜻">
        <div class="vw-edit-actions">
          <button type="button" class="vw-btn" data-act="cancel">취소</button>
          <button type="button" class="vw-btn vw-btn-primary" data-act="save">저장</button>
        </div>
      </div>`;
    editBox.querySelector('.vw-edit-meaning').focus();
    return;
  }
  if (act === 'cancel') { editBox.innerHTML = ''; return; }
  if (act === 'save') {
    const nw = row.querySelector('.vw-edit-word').value;
    const nm = row.querySelector('.vw-edit-meaning').value;
    if (!vocabQuickEdit(String(word).toLowerCase(), nw, nm)) { showToast('단어와 뜻을 모두 입력해주세요.', 'error'); return; }
    VP.open = String(nw).trim().toLowerCase();
    showToast('단어를 수정했어요.', 'info');
  }
}

function _vpBindOnce() {
  if (_vpBound) return;
  _vpBound = true;
  _vpLoadPrefs();
  const box = document.getElementById('wordList');
  box.addEventListener('change', e => {
    if (e.target.classList.contains('vw-memo')) _vpSetMemorized(e.target.closest('.vw-row'), e.target.checked);
  });
  box.addEventListener('click', e => {
    const more = e.target.closest('[data-act="more"]');
    if (more) { VP.shown += VP_PAGE; renderVocabPage(true); return; }
    const row = e.target.closest('.vw-row');
    if (!row || e.target.closest('.vw-check')) return;
    const btn = e.target.closest('button[data-act]');
    if (btn) { _vpHandleAction(row, btn); return; }
    if (e.target.closest('.vw-detail')) return;
    // 가린 칸은 누르면 보이기
    const masked = e.target.closest(box.classList.contains('vp-hide-meaning') ? '.vw-meaning' : '.vw-none') ||
                   e.target.closest(box.classList.contains('vp-hide-word') ? '.vw-word' : '.vw-none');
    if (masked && !masked.classList.contains('revealed')) { masked.classList.add('revealed'); return; }
    // 그 외: 펼치기/접기
    const key = String(row.dataset.word || '').toLowerCase();
    const wasOpen = row.classList.contains('open');
    document.querySelectorAll('#wordList .vw-row.open').forEach(r => {
      r.classList.remove('open'); const d = r.querySelector('.vw-detail'); if (d) d.remove();
    });
    VP.open = wasOpen ? null : key;
    if (!wasOpen) { row.classList.add('open'); row.insertAdjacentHTML('beforeend', _vpDetailHtml()); }
  });

  document.querySelectorAll('#vpTabs .vp-tab').forEach(b => b.addEventListener('click', () => {
    VP.filter = b.dataset.filter; _vpSavePrefs(); renderVocabPage(false);
  }));
  const sort = document.getElementById('vpSort');
  if (sort) sort.addEventListener('change', () => { VP.sort = sort.value; _vpSavePrefs(); renderVocabPage(false); });
  document.querySelectorAll('#vocabPage .vp-toggle').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.hide === 'meaning') { VP.hideMeaning = !VP.hideMeaning; if (VP.hideMeaning) VP.hideWord = false; }
    else { VP.hideWord = !VP.hideWord; if (VP.hideWord) VP.hideMeaning = false; }
    _vpSavePrefs(); renderVocabPage(true);
  }));
  const addBtn = document.getElementById('btnVocabAdd');
  if (addBtn) addBtn.addEventListener('click', () => {
    if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) { showCustomAlert('단어를 추가할 학생을 먼저 선택해 주세요.'); return; }
    showWordPopover('', addBtn);
  });
  // 단어 카드·미니 단어장에서 저장/수정되면 목록 갱신 (현재 보던 개수 유지)
  document.addEventListener('vocab:changed', () => {
    const page = document.getElementById('vocabPage');
    if (page && page.classList.contains('active')) renderVocabPage(true);
  });
}


/* =====================================================================
 * 단어 시험 (설정 → 한 문제씩 → 결과)
 * 방식: card(카드 넘기기) / choice(객관식 4지선다) / write(주관식)
 * 방향: e2k(영어 → 뜻) / k2e(뜻 → 영어)
 * 객관식 오답 보기는 학생 본인 단어장의 다른 단어에서 뽑습니다.
 * ===================================================================== */
const VT = { items: [], idx: 0, mode: 'choice', dir: 'e2k', correct: 0, wrong: [], answered: false, markKnown: false, choices: [] };
const VT_DEFAULT = { scope: 'recent', recentN: 30, count: 10, mode: 'choice', dir: 'e2k', skipDone: true, markKnown: false };

function _vtPrefsKey() { return 'k2_vocab_test:' + ((CURRENT_USER && CURRENT_USER.id) || 'guest'); }
function _vtLoadPrefs() {
  try { return Object.assign({}, VT_DEFAULT, JSON.parse(localStorage.getItem(_vtPrefsKey()) || '{}')); }
  catch (e) { return Object.assign({}, VT_DEFAULT); }
}
function _vtSavePrefs(p) { try { localStorage.setItem(_vtPrefsKey(), JSON.stringify(p)); } catch (e) {} }
function _shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function _vtBox() { return document.getElementById('vocabStudy'); }

// 시험 화면 ↔ 목록 화면 전환
function _vtShowStudy(on) {
  const box = _vtBox();
  const controls = document.getElementById('vocabAddWordSection');
  const list = document.getElementById('wordList');
  if (box) box.style.display = on ? 'block' : 'none';
  if (controls) controls.classList.toggle('vt-hidden', on);
  if (list) list.classList.toggle('vt-hidden', on);
  if (on) window.scrollTo({ top: 0, behavior: 'smooth' });
}
function vocabStudyExit() {
  _vtShowStudy(false);
  const box = _vtBox(); if (box) box.innerHTML = '';
  renderVocabPage(true);
}

// 범위에 맞는 단어 모음
function _vtPool(p) {
  const data = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE.filter(x => String(x.word || '').trim() && String(x.meaning || '').trim()) : [];
  const num = x => Number(x.number) || 0;
  if (p.scope === 'learning') return data.filter(x => !x.memorized);
  if (p.scope === 'visible') {
    const visible = _vpFiltered(data);
    return p.skipDone ? visible.filter(x => !x.memorized) : visible;
  }
  const base = p.skipDone ? data.filter(x => !x.memorized) : data;
  return base.slice().sort((a, b) => num(b) - num(a)).slice(0, Math.max(1, p.recentN | 0));
}

function vocabStudyOpenSetup() {
  if (CURRENT_USER && CURRENT_USER.role === 'manager' && !ADMIN_TARGET_VOCAB_USER) { showCustomAlert('학생을 먼저 선택해 주세요.'); return; }
  if (!Array.isArray(VOCAB_CACHE)) { showToast('단어장을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.', 'info'); return; }
  const p = _vtLoadPrefs();
  const box = _vtBox();
  const radio = (name, val, label, cur) => `<label class="vt-opt"><input type="radio" name="${name}" value="${val}" ${cur === val ? 'checked' : ''}><span>${label}</span></label>`;
  box.innerHTML = `
    <div class="vt-card vt-setup">
      <div class="vt-setup-head"><b>📝 단어 시험</b><button type="button" class="vt-btn" data-vt="exit">닫기</button></div>
      <div class="vt-field">
        <div class="vt-label">범위</div>
        <div class="vt-opts">
          ${radio('vtScope', 'recent', `최근 추가 <input type="number" id="vtRecentN" min="1" value="${p.recentN}">개`, p.scope)}
          ${radio('vtScope', 'learning', '외우는 중인 단어 전체', p.scope)}
          ${radio('vtScope', 'visible', '지금 목록에 보이는 단어 (검색·탭 기준)', p.scope)}
        </div>
        <label class="vt-check"><input type="checkbox" id="vtSkipDone" ${p.skipDone ? 'checked' : ''}> 외운 단어는 빼기</label>
      </div>
      <div class="vt-field">
        <div class="vt-label">방식</div>
        <div class="vt-opts vt-row">
          ${radio('vtMode', 'card', '카드 넘기기', p.mode)}
          ${radio('vtMode', 'choice', '객관식', p.mode)}
          ${radio('vtMode', 'write', '주관식', p.mode)}
        </div>
      </div>
      <div class="vt-field">
        <div class="vt-label">방향</div>
        <div class="vt-opts vt-row">
          ${radio('vtDir', 'e2k', '영어 → 뜻', p.dir)}
          ${radio('vtDir', 'k2e', '뜻 → 영어', p.dir)}
        </div>
      </div>
      <div class="vt-field vt-inline">
        <div class="vt-label">문제 수</div>
        <input type="number" id="vtCount" min="1" value="${p.count}"> <span class="vt-pool-info" id="vtPoolInfo"></span>
      </div>
      <label class="vt-check vt-known-opt"><input type="checkbox" id="vtMarkKnown" ${p.markKnown ? 'checked' : ''}> 카드 넘기기에서 '알아요'를 누르면 외움으로 표시</label>
      <div class="vt-start-row">
        <button type="button" class="vt-btn vt-btn-primary vt-start" data-vt="start">시작하기</button>
        <button type="button" class="vt-btn vt-print" data-vt="print">🖨️ 시험지 인쇄</button>
      </div>
      <div class="vt-print-note">인쇄: 카드 넘기기는 주관식(빈칸) 시험지로 만들어져요. 미리보기에서 정답지도 볼 수 있어요.</div>
    </div>`;
  const readPrefs = () => ({
    scope: (box.querySelector('input[name="vtScope"]:checked') || {}).value || 'recent',
    recentN: Math.max(1, parseInt(box.querySelector('#vtRecentN').value, 10) || VT_DEFAULT.recentN),
    count: Math.max(1, parseInt(box.querySelector('#vtCount').value, 10) || VT_DEFAULT.count),
    mode: (box.querySelector('input[name="vtMode"]:checked') || {}).value || 'choice',
    dir: (box.querySelector('input[name="vtDir"]:checked') || {}).value || 'e2k',
    skipDone: box.querySelector('#vtSkipDone').checked,
    markKnown: box.querySelector('#vtMarkKnown').checked
  });
  const refresh = () => {
    const pr = readPrefs();
    const n = _vtPool(pr).length;
    box.querySelector('#vtPoolInfo').textContent = `(범위 안 단어 ${n}개 중 ${Math.min(n, pr.count)}문제)`;
    box.querySelector('.vt-known-opt').style.display = pr.mode === 'card' ? 'flex' : 'none';
    box.querySelector('#vtSkipDone').closest('.vt-check').style.display = pr.scope === 'learning' ? 'none' : 'flex';
  };
  box.querySelectorAll('input').forEach(el => { el.addEventListener('change', refresh); el.addEventListener('input', refresh); });
  // 범위 칸 안의 숫자 입력을 누르면 그 범위를 선택
  box.querySelector('#vtRecentN').addEventListener('focus', () => { box.querySelector('input[name="vtScope"][value="recent"]').checked = true; refresh(); });
  box.onclick = e => {
    const b = e.target.closest('[data-vt]'); if (!b) return;
    if (b.dataset.vt === 'exit') vocabStudyExit();
    if (b.dataset.vt === 'start') { const pr = readPrefs(); _vtSavePrefs(pr); vocabStudyStart(pr); }
    if (b.dataset.vt === 'print') { const pr = readPrefs(); _vtSavePrefs(pr); vocabStudyPrint(pr); }
  };
  refresh();
  _vtShowStudy(true);
}

function vocabStudyStart(p, itemsOverride) {
  const pool = itemsOverride || _vtPool(p);
  if (!pool.length) { showToast('범위 안에 시험 볼 단어가 없어요.', 'error'); return; }
  const all = Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : [];
  if (p.mode === 'choice') {
    const keyOf = x => String(p.dir === 'e2k' ? x.meaning : x.word).trim().toLowerCase();
    if (new Set(all.map(keyOf)).size < 4) { showToast('객관식은 서로 다른 단어가 4개 이상 있어야 해요.', 'error'); return; }
  }
  Object.assign(VT, {
    items: itemsOverride ? _shuffle(pool) : _shuffle(pool).slice(0, p.count),
    idx: 0, mode: p.mode, dir: p.dir, correct: 0, wrong: [], answered: false, markKnown: !!p.markKnown, prefs: p
  });
  _vtShowStudy(true);
  _vtRenderQuestion();
}

function _vtPrompt(item, dir) { return (dir || VT.dir) === 'e2k' ? item.word : item.meaning; }
function _vtAnswer(item, dir) { return (dir || VT.dir) === 'e2k' ? item.meaning : item.word; }
// 정답 1개 + 학생 단어장의 다른 단어 3개로 4지선다 보기 생성 (같은 뜻/철자는 중복 제외)
function _vtMakeChoices(item, dir) {
  const ans = String(_vtAnswer(item, dir)).trim();
  const used = new Set([ans.toLowerCase()]);
  const distract = [];
  _shuffle(Array.isArray(VOCAB_CACHE) ? VOCAB_CACHE : []).forEach(x => {
    const t = String(_vtAnswer(x, dir) || '').trim();
    const k = t.toLowerCase();
    if (distract.length < 3 && t && !used.has(k)) { used.add(k); distract.push(t); }
  });
  return _shuffle([ans].concat(distract));
}

function _vtRenderQuestion() {
  const box = _vtBox();
  const item = VT.items[VT.idx];
  VT.answered = false;
  const total = VT.items.length;
  const head = `
    <div class="vt-progress">
      <span>${VT.idx + 1} / ${total}</span>
      <span class="vt-score">맞힘 ${VT.correct}</span>
      <button type="button" class="vt-btn" data-vt="quit">그만하기</button>
    </div>
    <div class="vt-bar"><div style="width:${Math.round(VT.idx / total * 100)}%"></div></div>`;
  const promptCls = VT.dir === 'e2k' ? 'vt-prompt en' : 'vt-prompt ko';
  let body = '';
  if (VT.mode === 'card') {
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-reveal" hidden>${escapeHTML(_vtAnswer(item))}</div>
      <button type="button" class="vt-btn vt-btn-primary vt-wide" data-vt="flip">${VT.dir === 'e2k' ? '뜻 보기' : '단어 보기'}</button>
      <div class="vt-judge" hidden>
        <button type="button" class="vt-btn vt-btn-no" data-vt="dontknow">몰라요</button>
        <button type="button" class="vt-btn vt-btn-yes" data-vt="know">알아요</button>
      </div>`;
  } else if (VT.mode === 'choice') {
    VT.choices = _vtMakeChoices(item, VT.dir);
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-choices">
        ${VT.choices.map((c, i) => `<button type="button" class="vt-choice" data-vt="choose" data-i="${i}"><span>${'①②③④'[i]}</span>${escapeHTML(c)}</button>`).join('')}
      </div>
      <div class="vt-feedback"></div>`;
  } else {
    body = `
      <div class="${promptCls}">${escapeHTML(_vtPrompt(item))}</div>
      <div class="vt-write">
        <input type="text" id="vtInput" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${VT.dir === 'e2k' ? '뜻을 입력하세요' : '영어 단어를 입력하세요'}">
        <button type="button" class="vt-btn vt-btn-primary" data-vt="check">확인</button>
      </div>
      <div class="vt-feedback"></div>`;
  }
  box.innerHTML = `<div class="vt-card vt-run">${head}${body}</div>`;
  box.onclick = _vtOnClick;
  const inp = box.querySelector('#vtInput');
  if (inp) {
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (VT.answered) _vtNext(); else _vtCheckWrite();
    });
    setTimeout(() => inp.focus(), 50);
  }
}

function _vtOnClick(e) {
  const b = e.target.closest('[data-vt]'); if (!b) return;
  const act = b.dataset.vt;
  const box = _vtBox();
  if (act === 'quit') { _vtFinish(true); return; }
  if (act === 'next') { _vtNext(); return; }
  if (act === 'flip') {
    box.querySelector('.vt-reveal').hidden = false;
    box.querySelector('.vt-judge').hidden = false;
    b.hidden = true;
    return;
  }
  if (act === 'know' || act === 'dontknow') {
    if (VT.answered) return;
    VT.answered = true;
    const item = VT.items[VT.idx];
    if (act === 'know') {
      VT.correct++;
      if (VT.markKnown && !item.memorized) _vtMarkMemorized(item);
    } else VT.wrong.push(item);
    _vtNext();
    return;
  }
  if (act === 'choose') {
    if (VT.answered) { _vtNext(); return; }
    VT.answered = true;
    const item = VT.items[VT.idx];
    const ansKey = String(_vtAnswer(item)).trim().toLowerCase();
    const picked = VT.choices[+b.dataset.i];
    const ok = String(picked).trim().toLowerCase() === ansKey;
    box.querySelectorAll('.vt-choice').forEach((c, i) => {
      if (String(VT.choices[i]).trim().toLowerCase() === ansKey) c.classList.add('correct');
      else if (c === b) c.classList.add('wrong');
      c.classList.add('done');
    });
    _vtFeedback(ok, item);
    return;
  }
  if (act === 'check') { if (VT.answered) _vtNext(); else _vtCheckWrite(); }
}

// 주관식 채점: 영어→뜻은 여러 뜻 중 하나와 맞거나 포함하면 정답, 뜻→영어는 철자가 같아야 정답
function _vtCheckWrite() {
  const box = _vtBox();
  const inp = box.querySelector('#vtInput');
  const ans = String(inp.value || '').trim().toLowerCase();
  if (!ans) { inp.focus(); return; }
  VT.answered = true;
  const item = VT.items[VT.idx];
  let ok;
  if (VT.dir === 'e2k') {
    const ms = String(item.meaning || '').toLowerCase().split(',').map(m => m.trim()).filter(Boolean);
    ok = ms.some(m => m === ans || m.includes(ans) || ans.includes(m));
  } else {
    ok = ans === String(item.word || '').trim().toLowerCase();
  }
  inp.disabled = true;
  inp.classList.add(ok ? 'correct' : 'wrong');
  _vtFeedback(ok, item);
}

function _vtFeedback(ok, item) {
  const box = _vtBox();
  if (ok) VT.correct++; else VT.wrong.push(item);
  const fb = box.querySelector('.vt-feedback');
  const btn = box.querySelector('[data-vt="check"]');
  if (btn) btn.textContent = '다음';
  fb.innerHTML = ok
    ? '<div class="vt-ok">⭕ 정답!</div>'
    : `<div class="vt-no">❌ 정답: <b>${escapeHTML(_vtAnswer(item))}</b></div><button type="button" class="vt-btn vt-btn-primary vt-wide" data-vt="next">다음</button>`;
  box.querySelector('.vt-score').textContent = '맞힘 ' + VT.correct;
  if (ok) setTimeout(() => { if (VT.answered && VT.items[VT.idx] === item) _vtNext(); }, 700);
  else { const nb = fb.querySelector('[data-vt="next"]'); if (nb) nb.focus(); }
}

function _vtNext() {
  if (VT.idx + 1 >= VT.items.length) { _vtFinish(false); return; }
  VT.idx++;
  _vtRenderQuestion();
}

function _vtMarkMemorized(item) {
  const targetUser = getActiveVocabUser();
  if (!targetUser) return;
  item.memorized = true;
  google.script.run
    .withFailureHandler(err => showToast('외움 표시 저장 실패: ' + escapeHTML(String(err)), 'error'))
    .setWordMemorized(targetUser, item.word, true);
}

function _vtFinish(quit) {
  const box = _vtBox();
  const solved = quit ? VT.idx + (VT.answered ? 1 : 0) : VT.items.length;
  if (solved > 0) vocabUpdateQuizStats(VT.correct, solved);
  const pct = solved ? Math.round(VT.correct / solved * 100) : 0;
  const wrongList = VT.wrong.length
    ? `<div class="vt-wrong-title">틀린 단어 ${VT.wrong.length}개</div>
       <div class="vt-wrong-list">${VT.wrong.map(x => `<div class="vt-wrong-item"><b>${escapeHTML(x.word)}</b><span>${escapeHTML(x.meaning)}</span></div>`).join('')}</div>`
    : (solved ? '<div class="vt-perfect">🎉 모두 맞혔어요!</div>' : '');
  box.innerHTML = `
    <div class="vt-card vt-result">
      <div class="vt-result-score">${VT.correct} / ${solved}<small>${solved ? pct + '점' : ''}</small></div>
      ${wrongList}
      <div class="vt-result-actions">
        ${VT.wrong.length ? '<button type="button" class="vt-btn vt-btn-primary" data-vt="retryWrong">틀린 단어 다시 풀기</button>' : ''}
        <button type="button" class="vt-btn" data-vt="again">새로 시험 보기</button>
        <button type="button" class="vt-btn" data-vt="exit">단어 목록으로</button>
      </div>
    </div>`;
  box.onclick = e => {
    const b = e.target.closest('[data-vt]'); if (!b) return;
    if (b.dataset.vt === 'retryWrong') vocabStudyStart(Object.assign({}, VT.prefs), VT.wrong.slice());
    if (b.dataset.vt === 'again') vocabStudyOpenSetup();
    if (b.dataset.vt === 'exit') vocabStudyExit();
  };
  document.dispatchEvent(new CustomEvent('vocab:changed', { detail: {} }));
}

(function bindVocabStudy() {
  const btn = document.getElementById('btnVocabStudy');
  if (btn) btn.addEventListener('click', () => {
    const box = _vtBox();
    if (box && box.style.display !== 'none') vocabStudyExit(); else vocabStudyOpenSetup();
  });
})();


/* =====================================================================
 * 단어 시험지 인쇄 (A4, 2단) — 기존 문제지 인쇄와 같은 미리보기 방식(#printSection)
 * 객관식: 4지선다 / 그 외: 빈칸에 쓰기. 미리보기에서 문제지 ↔ 정답지 전환.
 * ===================================================================== */
let VT_PRINT = null;

function vocabStudyPrint(p) {
  const pool = _vtPool(p);
  if (!pool.length) { showToast('범위 안에 시험지로 만들 단어가 없어요.', 'error'); return; }
  const mode = p.mode === 'choice' ? 'choice' : 'write';
  if (mode === 'choice') {
    const keyOf = x => String(_vtAnswer(x, p.dir)).trim().toLowerCase();
    if (new Set((VOCAB_CACHE || []).map(keyOf)).size < 4) { showToast('객관식은 서로 다른 단어가 4개 이상 있어야 해요.', 'error'); return; }
  }
  const items = _shuffle(pool).slice(0, p.count).map(it => ({
    item: it, choices: mode === 'choice' ? _vtMakeChoices(it, p.dir) : null
  }));
  const user = getActiveVocabUser() || {};
  const d = new Date();
  VT_PRINT = { items: items, mode: mode, dir: p.dir, name: user.name || '', date: `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.` };
  _vtRenderPrint('sheet');
}

function _vtPrintStyle() {
  return `<style>
    .vsheet { font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: #000; max-width: 190mm; margin: 0 auto; padding: 8mm 0 0; }
    .vs-head { border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
    .vs-title { text-align: center; font-size: 22px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px; }
    .vs-info { width: 100%; border-collapse: collapse; font-size: 13px; }
    .vs-info td { border: 1px solid #000; padding: 5px 8px; }
    .vs-info td.k { width: 1%; white-space: nowrap; font-weight: bold; background: #f3f4f6; text-align: center; }
    .vs-guide { font-size: 13px; margin-top: 8px; font-weight: bold; }
    .vs-cols { column-count: 2; column-gap: 10mm; column-rule: 0.5px solid #bbb; }
    .vs-item { break-inside: avoid; page-break-inside: avoid; display: flex; align-items: flex-end; gap: 6px; font-size: 14px; padding: 7px 0 5px; }
    .vs-no { flex: 0 0 auto; width: 2.2em; font-weight: bold; }
    .vs-q { flex: 0 1 auto; max-width: 58%; word-break: keep-all; overflow-wrap: break-word; }
    .vs-q.en { font-family: "Times New Roman", serif; font-size: 15px; font-weight: bold; }
    .vs-line { flex: 1 1 auto; min-width: 25mm; border-bottom: 1px solid #000; height: 1.2em; }
    .vs-item.ch { display: block; padding: 6px 0 7px; }
    .vs-item.ch .vs-qrow { display: flex; gap: 6px; align-items: baseline; }
    .vs-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 10px; margin: 4px 0 0 2.2em; font-size: 12.5px; }
    .vs-opts.en { font-family: "Times New Roman", serif; font-size: 13.5px; }
    .vs-key { column-count: 3; column-gap: 8mm; font-size: 13px; }
    .vs-key div { break-inside: avoid; padding: 3px 0; border-bottom: 0.5px dotted #999; }
    .vs-key b { display: inline-block; width: 2.4em; }
  </style>`;
}

function _vtSheetHtml(withKey) {
  const P = VT_PRINT;
  const n = P.items.length;
  const guide = P.mode === 'choice'
    ? (P.dir === 'e2k' ? '※ 영어 단어의 뜻으로 알맞은 것을 고르시오.' : '※ 우리말 뜻에 알맞은 영어 단어를 고르시오.')
    : (P.dir === 'e2k' ? '※ 영어 단어의 뜻을 쓰시오.' : '※ 우리말 뜻에 알맞은 영어 단어를 쓰시오.');
  const promptCls = P.dir === 'e2k' ? 'vs-q en' : 'vs-q';
  const optCls = P.dir === 'e2k' ? 'vs-opts' : 'vs-opts en';
  const head = `
    <div class="vs-head">
      <div class="vs-title">${withKey ? '영어 단어 시험 · 정답' : '영어 단어 시험'}</div>
      <table class="vs-info"><tr>
        <td class="k">이름</td><td>${escapeHTML(P.name)}</td>
        <td class="k">날짜</td><td>${escapeHTML(P.date)}</td>
        <td class="k">점수</td><td style="text-align:right; width:22%;">/ ${n}</td>
      </tr></table>
      ${withKey ? '' : `<div class="vs-guide">${guide}</div>`}
    </div>`;
  if (withKey) {
    const keys = P.items.map((x, i) => {
      const ans = _vtAnswer(x.item, P.dir);
      const mark = x.choices ? '①②③④'[x.choices.indexOf(String(ans).trim())] + ' ' : '';
      return `<div><b>${i + 1}.</b>${mark}${escapeHTML(ans)}</div>`;
    }).join('');
    return `<div class="vsheet">${head}<div class="vs-key">${keys}</div></div>`;
  }
  const body = P.items.map((x, i) => {
    const q = escapeHTML(_vtPrompt(x.item, P.dir));
    if (x.choices) {
      return `<div class="vs-item ch"><div class="vs-qrow"><span class="vs-no">${i + 1}.</span><span class="${promptCls}">${q}</span></div>
        <div class="${optCls}">${x.choices.map((c, k) => `<span>${'①②③④'[k]} ${escapeHTML(c)}</span>`).join('')}</div></div>`;
    }
    return `<div class="vs-item"><span class="vs-no">${i + 1}.</span><span class="${promptCls}">${q}</span><span class="vs-line"></span></div>`;
  }).join('');
  return `<div class="vsheet">${head}<div class="vs-cols">${body}</div></div>`;
}

function _vtRenderPrint(view) {
  if (!VT_PRINT) return;
  const zone = document.getElementById('printSection');
  zone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  const btn = 'border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; white-space:nowrap; color:#fff; width:auto;';
  const isKey = view === 'key';
  zone.innerHTML = `
    <div class="print-controls no-print" style="position:fixed; top:0; left:0; right:0; background:#374151; color:#fff; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; z-index:10000; box-shadow:0 2px 10px rgba(0,0,0,0.2); gap:10px; flex-wrap:wrap;">
      <div style="font-size:16px; font-weight:bold;">🖥️ 단어 ${isKey ? '정답지' : '시험지'} 미리보기 (${VT_PRINT.items.length}문항)</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" id="vsToggle" style="background:#059669; ${btn}">${isKey ? '📄 시험지 보기' : '📑 정답지 보기'}</button>
        <button type="button" id="vsReshuffle" style="background:#7c3aed; ${btn}">🔀 다시 섞기</button>
        <button type="button" id="vsPrint" style="background:#2563eb; ${btn}">🖨️ 인쇄하기</button>
        <button type="button" id="vsClose" style="background:#dc2626; ${btn}">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height:64px;"></div>
    ${_vtPrintStyle()}
    ${_vtSheetHtml(isKey)}`;
  zone.querySelector('#vsToggle').onclick = () => _vtRenderPrint(isKey ? 'sheet' : 'key');
  zone.querySelector('#vsReshuffle').onclick = () => {
    VT_PRINT.items = _shuffle(VT_PRINT.items).map(x => ({ item: x.item, choices: x.choices ? _vtMakeChoices(x.item, VT_PRINT.dir) : null }));
    _vtRenderPrint(view);
  };
  zone.querySelector('#vsPrint').onclick = () => window.print();
  zone.querySelector('#vsClose').onclick = () => closePrintPreview();
}
