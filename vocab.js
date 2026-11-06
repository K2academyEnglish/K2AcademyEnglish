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

  // 2. 서버에서 단어 목록 로드
  if(!hasGsRun()){ showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
    loadEl.querySelector('.loading-text').innerHTML = '단어장을 펼치는 중...';
    loadEl.classList.add('active');
  }

  const statsEl = document.getElementById('vocabStats');
  const addSecEl = document.getElementById('vocabAddWordSection');
  if(statsEl) statsEl.style.display = 'block';
  if(addSecEl) addSecEl.style.display = 'block';

  vocabUpdateStats();

  google.script.run.withSuccessHandler(function(data) {
    if(loadEl) loadEl.classList.remove('active');
    VOCAB_CACHE = data; 
    renderVocabTableFromData(data);
  }).withFailureHandler(err => {
    if(loadEl) loadEl.classList.remove('active');
    showCustomAlert('단어장 불러오기 오류: ' + err);
  }).getVocabulary(targetUser);
}

// [신규] 데이터를 받아서 단어장 표를 그려주는 함수 (내용 생략 없이 꽉 채움)
function renderVocabTableFromData(data, isSearchMode = false) {
    const box = document.getElementById('wordList');
    
    // 1. 에러 및 빈 데이터 처리
    if (data && data.error) {
        box.innerText = '⚠️ ' + data.error;
        return;
    }
    if (!data || data.length === 0) {
        box.innerHTML = '<div style="padding:20px; text-align:center; color:#666;">📭 결과가 없습니다.</div>';
        return;
    }

    let pageData = [];
    let navHtml = '';

    // 2. 모드에 따른 데이터 슬라이싱
    if (isSearchMode) {
        pageData = data;
        navHtml = `
            <div style="background:#eff6ff; padding:10px; border-radius:8px; margin-bottom:10px; text-align:center; color:#1e40af; font-weight:bold;">
                🔍 검색 결과: 총 ${data.length}개 찾음
            </div>
        `;
    } else {
        const PAGE_SIZE = 100;
        const totalCount = data.length;
        const totalPages = Math.ceil(totalCount / PAGE_SIZE);
        
        if (VOCAB_CURRENT_PAGE < 1) VOCAB_CURRENT_PAGE = 1;
        if (VOCAB_CURRENT_PAGE > totalPages) VOCAB_CURRENT_PAGE = totalPages;

        const startIndex = (VOCAB_CURRENT_PAGE - 1) * PAGE_SIZE;
        const endIndex = Math.min(startIndex + PAGE_SIZE, totalCount);
        pageData = data.slice(startIndex, endIndex);

        const btnStyle = "width:auto; padding:8px 16px; border:1px solid #d1d5db; background:#fff; color:#111827; border-radius:8px; font-size:14px; cursor:pointer;";
        
        navHtml = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin:10px 0; background:#f3f4f6; padding:10px; border-radius:8px;">
            <button type="button" onclick="changeVocabPage(-1)" style="${btnStyle} ${VOCAB_CURRENT_PAGE === 1 ? 'visibility:hidden;' : ''}">
                 &lt; 이전
             </button>
             <div style="text-align:center;">
                 <div style="font-weight:bold; font-size:15px; color:#111827;">${VOCAB_CURRENT_PAGE} / ${totalPages}</div>
                 <div style="font-size:12px; color:#6b7280; margin-top:2px;">(총 ${totalCount}개)</div>
             </div>
             <button type="button" onclick="changeVocabPage(1)" style="${btnStyle} ${VOCAB_CURRENT_PAGE === totalPages ? 'visibility:hidden;' : ''}">
                 다음 &gt;
             </button>
          </div>
        `;
    }

    // 3. 테이블 생성 (수정 버튼 위치 변경됨)
    const escQuote = (s) => String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    let tableHtml = '<table class="vocab-table" style="width:100%; table-layout:fixed;">';
    
    // 헤더 조정 (관리 컬럼 폭을 조금 늘림)
    tableHtml += `
      <thead>
        <tr style="background:#f9fafb;">
            <th style="width:40px; text-align:center;">No.</th>
            <th>영어</th>
            <th>뜻</th>
            <th style="width:70px; text-align:center;">관리</th> 
        </tr>
      </thead>
      <tbody>
    `;

    pageData.forEach(row => {
        const wSafe = escQuote(row.word);
        const mSafe = escQuote(row.meaning);
        const isMemorized = row.memorized ? 'checked' : '';
        const rowBg = row.memorized ? 'background:#f0fdf4;' : ''; 

        tableHtml += `
          <tr style="${rowBg}">
             <td style="text-align:center; color:#666;">${row.number}</td>
             <td style="word-break:break-all; font-weight:bold; color:#1f2937;">${escapeHTML(row.word)}</td>
             <td style="word-break:keep-all; color:#374151;">${escapeHTML(row.meaning)}</td>
             <td style="text-align:center;">
                <div style="display:flex; justify-content:center; align-items:center; gap:8px;">
                    <label style="display:flex; align-items:center; cursor:pointer;" title="외움 표시">
                        <input type="checkbox" class="memorized-checkbox" data-word="${escapeHTML(row.word)}" ${isMemorized} 
                               style="transform:scale(1.3); margin:0;">
                    </label>
                    <button type="button" class="btn-ghost" 
                            style="padding:4px 8px; font-size:12px; height:auto; border:1px solid #d1d5db; background:white; color:#374151;" 
                            onclick="vocabEnableEdit(this, '${wSafe}', '${mSafe}')">수정</button>
                </div>
             </td>
          </tr>
        `;
    });
    tableHtml += '</tbody></table>';

    // 4. 최종 출력
    box.innerHTML = navHtml + tableHtml + (isSearchMode ? '' : navHtml);
    
    box.style.display = 'block';
    const elQuiz = document.getElementById('quiz'); if(elQuiz) elQuiz.innerHTML = '';
    const elScore = document.getElementById('score'); if(elScore) elScore.innerText = '';
    const elShowBtn = document.getElementById('showListBtn'); if(elShowBtn) elShowBtn.style.display = 'none';

    vocabSetupCheckboxListeners();
}

let _vocabSearchTimer = null; // ★ [최적화] 디바운싱(타이머)용 변수

// [추가] 실시간 검색 처리 함수
function vocabOnSearchInput(el) {
    clearTimeout(_vocabSearchTimer); // ★ 타자를 치는 동안에는 기존 예약된 검색을 계속 취소함

    // ★ 타자를 멈추고 0.3초(300ms)가 지나면 비로소 아래 로직을 딱 한 번 실행함
    _vocabSearchTimer = setTimeout(() => {
        const query = el.value.trim().toLowerCase();

        // 1. 검색어가 없으면 원래 전체 데이터 + 페이징 모드로 복귀
        if (!query) {
            // 원래 위치(현재 페이지)를 유지하고 싶으면 아래 줄 삭제, 
            // 검색 취소 시 1페이지로 가고 싶으면 유지.
            // VOCAB_CURRENT_PAGE = 1; 
            renderVocabTableFromData(VOCAB_CACHE, false);
            // false = 일반 모드
            return;
        }

        // 2. 검색어가 있으면 전체 데이터에서 필터링
        if (!VOCAB_CACHE) return;
        const filtered = VOCAB_CACHE.filter(item => {
            const w = String(item.word || '').toLowerCase();
            const m = String(item.meaning || '').toLowerCase();
            return w.includes(query) || m.includes(query); // 영어 OR 한글 포함 여부
        });

        // 3. 필터링된 데이터로 렌더링 (true = 검색 모드, 갯수 제한 없음)
        renderVocabTableFromData(filtered, true);
    }, 300); // 300ms 대기
}

// 페이지 변경 버튼 클릭 시 호출
function changeVocabPage(delta) {
    if (!VOCAB_CACHE) return;
    
    VOCAB_CURRENT_PAGE += delta;
    // 일반 모드(false)로 렌더링
    renderVocabTableFromData(VOCAB_CACHE, false);
    
    const listSection = document.getElementById('vocabPage');
    if(listSection) listSection.scrollIntoView({behavior: 'smooth', block: 'start'});
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
  }).getDailyLogs(targetUser);
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

function openVocabDrawer(){
   const d = document.getElementById('vocabDrawer');
  const o = document.getElementById('drawerOverlay');
  if (d) d.classList.add('open');
  if (o) o.style.display = 'block';

  // 검색창 초기화
  const searchInp = document.getElementById('drawerSearch');
  if (searchInp) searchInp.value = '';
  
  const list = document.getElementById('drawerList');
  if (list) list.innerHTML = ''; // 기존 목록 초기화

  // ▼ [수정] 주석 처리했던 데이터 로딩 함수를 다시 실행합니다.
  drawerEnsureLoaded(); 
}

function closeVocabDrawer(){
  const d = document.getElementById('vocabDrawer');
  const o = document.getElementById('drawerOverlay');
  if (d) d.classList.remove('open');
  if (o) o.style.display = 'none';
}

function drawerEnsureLoaded(){
  if (DRAWER_DICT_ONLY) return; 
  const st = document.getElementById('drawerStatus');
  if (!CURRENT_USER) return;
  vocabInitTypoOnce();

  // ★ 수정: VOCAB_CACHE가 있으면 그것을 사용 (메인 단어장과 공유)
  if (VOCAB_CACHE && Array.isArray(VOCAB_CACHE)) {
    if (st) st.textContent = '총 ' + VOCAB_CACHE.length + '개';
    drawerRenderList(VOCAB_CACHE.slice(0, 50));
    return;
  }

  if (!hasGsRun()) { if (st) st.textContent = '서버 연결 오류'; return; }
  if (st) st.textContent = '불러오는 중...';

  google.script.run.withSuccessHandler(function(data){
    // ★ 수정: 받아온 데이터를 전역 캐시에 저장
    VOCAB_CACHE = Array.isArray(data) ? data : [];
    
    if (st) st.textContent = '총 ' + VOCAB_CACHE.length + '개';
    drawerRenderList(VOCAB_CACHE.slice(0, 50));
    
    // 메인 단어장 화면이 열려있다면 거기도 갱신해줌 (선택사항)
    if(document.getElementById('vocabPage').classList.contains('active')){
        renderVocabTableFromData(VOCAB_CACHE);
    }
  }).getVocabulary(CURRENT_USER);
}

function drawerFilterList(q){
  q = String(q||'').trim().toLowerCase();
  if (!q){
    drawerRenderList(vocabList().slice(0, 50));
    return;
  }
  const filtered = vocabList().filter(x=>{
    const w = String(x.word||'').toLowerCase();
    const m = String(x.meaning||'').toLowerCase();
    return w.includes(q) || m.includes(q);
  }).slice(0, 80);
  drawerRenderList(filtered);
}

function drawerRenderList(rows){
  const box = document.getElementById('drawerList');
  if (!box) return;
  box.innerHTML = '';

  if (!rows || !rows.length){
    box.innerHTML = '<div class="drawer-muted">검색 결과가 없습니다.</div>';
    return;
  }

  rows.forEach(r=>{
    const item = document.createElement('div');
    item.className = 'drawer-item';
    item.innerHTML = '<div class="w">' + escapeHTML(r.word||'') + '</div>' + '<div class="m">' + escapeHTML(r.meaning||'') + '</div>' + '<div class="mini">' + '<button type="button" class="ghost">사전</button>' + '<button type="button" class="ghost">입력칸에 넣기</button>' + '</div>';

    const btnDict = item.querySelectorAll('button')[0];
    const btnFill = item.querySelectorAll('button')[1];

    btnDict.addEventListener('click', ()=>{
      const w = String(r.word||'').trim();
      const dictInput = document.getElementById('drawerDictWord');
      if (dictInput) dictInput.value = w;
      drawerSearchDict(w);
    });

    btnFill.addEventListener('click', ()=>{
      const w = String(r.word||'').trim();
      const m = String(r.meaning||'').trim();
      const wEl = document.getElementById('drawerWord');
      const mEl = document.getElementById('drawerMeaning');
if (wEl) wEl.value = w;
      if (mEl) mEl.value = m;
    });

    box.appendChild(item);
  });
}

function fetchDatamuse(type, isMain) {
  const inputId = isMain ? 'newWord' : 'drawerDictWord';
  const resultId = isMain ? 'datamuseResultMain' : 'datamuseResult';
  
  const word = document.getElementById(inputId).value.trim();
  const resultBox = document.getElementById(resultId);
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
        fetchDatamuse(type, isMain);
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

function drawerSearchDict(word){
  const w = String(word||'').trim();
if (!w) return;

  // 1. 네이버 사전 아이프레임 업데이트
  const iframe = document.getElementById('drawerDictFrame');
  if (iframe) iframe.src = 'https://en.dict.naver.com/#/search?query=' + encodeURIComponent(w);

  // 2. [추가된 기능] 사전 검색한 단어를 '빠른 저장' 칸에 자동으로 넣어줍니다.
  const saveWordInput = document.getElementById('drawerWord');
  const saveMeaningInput = document.getElementById('drawerMeaning');

  if (saveWordInput) {
     saveWordInput.value = w; // 단어 칸 자동 채움
  }
  if (saveMeaningInput) {
     saveMeaningInput.value = ''; // 뜻 칸은 비워줌
     saveMeaningInput.focus();    // 바로 뜻을 입력할 수 있게 커서 이동
  }
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

// ▼ [누락되었던 함수 복구] 미니 단어장에서 '저장' 버튼을 눌렀을 때 실행되는 함수
function drawerSaveWord(){
  const wEl = document.getElementById('drawerWord');
  const mEl = document.getElementById('drawerMeaning');
  const st = document.getElementById('drawerSaveStatus');

  let word = wEl ? wEl.value.trim() : '';
  const meaning = mEl ? mEl.value.trim() : '';

  if(!word || !meaning){
    if(st) st.textContent = '단어와 뜻을 모두 입력해주세요.';
    return;
  }
  
  if(st) st.textContent = '저장 중...';

  // 오타 보정
  word = vocabCorrectTypo(word);

  // 중복 확인 로직
  const dup = vocabList().find(x => String(x.word||'').toLowerCase() === word.toLowerCase());
  
  if(dup){
        const existing = String(dup.meaning||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
        // 이미 있는 뜻이면 병합하지 않음
        const uniqueMeanings = new Set([...existing, meaning.toLowerCase()]);
        const merged = Array.from(uniqueMeanings).join(', ');

        if(st) st.textContent = '이미 있는 단어라 뜻을 병합해 저장합니다.';
        
        google.script.run.withSuccessHandler(function(){
          if(st) st.textContent = '저장 완료!';
          // 캐시 갱신 및 목록 다시 로드
          VOCAB_CACHE = null;
          drawerEnsureLoaded();
          // 입력창 초기화
          if(wEl) wEl.value='';
          if(mEl) mEl.value='';
          const sBox = document.getElementById('drawerWordStatus');
          if(sBox) sBox.innerHTML='';
          setTimeout(()=>{ if(st) st.textContent=''; }, 2000);
        }).withFailureHandler(function(err){
          if(st) st.textContent = '오류: ' + err;
        }).updateWordMeaning(CURRENT_USER, word, merged);
        return;
      }

      // 새 단어 저장 로직 추가
      if(st) st.textContent = '새 단어를 저장 중...';
      google.script.run.withSuccessHandler(function(){
        if(st) st.textContent = '저장 완료!';
        VOCAB_CACHE = null;
        drawerEnsureLoaded();
        if(wEl) wEl.value='';
        if(mEl) mEl.value='';
        const sBox = document.getElementById('drawerWordStatus');
        if(sBox) sBox.innerHTML='';
        setTimeout(()=>{ if(st) st.textContent=''; }, 2000);
      }).withFailureHandler(function(err){
        if(st) st.textContent = '오류: ' + err;
      }).addWordToFormAndSheet(CURRENT_USER, word, meaning);
    }
