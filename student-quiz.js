/* ===================== QBank: 칩 ===================== */
const sel={grades:new Set(), years:new Set(), months:new Set(), types:new Set()};
function renderChips(containerId, items, key, withAll, targetSel){
  const box = document.getElementById(containerId); 
  if(!box) return;
  box.innerHTML = '';
  
  // ★ [수정됨] targetSel이 없으면 기본값 sel(학생용) 사용
  const S = targetSel ? targetSel[key] : sel[key]; 
  const itemButtons = []; 
  let allBtn = null;

  if(withAll){
    allBtn = document.createElement('button');
    allBtn.type = 'button'; 
    allBtn.className = 'chip all'; 
    allBtn.textContent = '전체';
    
    // 전체 선택/해제 로직
    const isAllSelected = (S.size === items.length && items.length > 0);
    if(isAllSelected) allBtn.classList.add('selected');

    allBtn.addEventListener('click', ()=>{
      const selectAll = !allBtn.classList.contains('selected');
      if(selectAll){
        S.clear(); items.forEach(v=>S.add(v));
        itemButtons.forEach(b=>b.classList.add('selected'));
        allBtn.classList.add('selected');
      } else {
        S.clear(); itemButtons.forEach(b=>b.classList.remove('selected'));
        allBtn.classList.remove('selected');
      }
    });
    box.appendChild(allBtn);
  }

  (items||[]).forEach(v=>{
    const b = document.createElement('button');
    b.type = 'button'; 
    b.className = 'chip'; 
    b.textContent = v;
    
    if(S.has(v)) b.classList.add('selected');

    b.addEventListener('click', ()=>{
      if(S.has(v)){ S.delete(v); b.classList.remove('selected'); }
      else { S.add(v); b.classList.add('selected'); }
      
      if(allBtn){
        const allSelected = (S.size === items.length && items.length > 0);
        allBtn.classList.toggle('selected', allSelected);
      }
    });
    itemButtons.push(b); 
    box.appendChild(b);
  });
}
function populateAllFilters(payload){
  // 1. 학생용 필터 채우기 (기존)
  renderChips('gradeChips', payload.grades || [], 'grades', false);
  renderChips('yearChips',  payload.years  || [], 'years',  true);
  renderChips('monthChips', payload.months || [], 'months', true);
  renderChips('typeChips',  payload.types  || [], 'types',  true);

  // 2. ★ [추가됨] 관리자(출력)용 필터 채우기
  // (이 부분이 없어서 admin 화면에서 필터가 비어있던 겁니다)
  renderChips('printGradeChips', payload.grades || [], 'grades', false, selPrint);
  renderChips('printYearChips',  payload.years  || [], 'years',  true, selPrint);
  renderChips('printMonthChips', payload.months || [], 'months', true, selPrint);
  renderChips('printTypeChips',  payload.types  || [], 'types',  true, selPrint);
}
/* [신규] 탭 전환 함수 */
function switchGradeTab(gradeId) {
    document.querySelectorAll('#selectPage .grade-tab').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(gradeId));
    });
    document.querySelectorAll('#selectPage .grade-panel').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById('gp_' + gradeId).classList.add('active');
}

/* [신규] 탭 전용 칩 렌더링 함수 */
function renderChipsV2(containerId, items, category, stateObj) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = '';
    
    // '전체' 버튼
    const allBtn = document.createElement('button');
    allBtn.className = 'chip all';
    allBtn.type = 'button';
    allBtn.textContent = '전체';
    const currentSet = stateObj[category]; 
    
    const updateAllBtn = () => {
        const isAll = items.length > 0 && currentSet.size === items.length;
        allBtn.classList.toggle('selected', isAll);
    };
    allBtn.onclick = () => {
        if (allBtn.classList.contains('selected')) {
            currentSet.clear();
        } else {
            items.forEach(i => currentSet.add(i));
        }
        updateAllBtn();
        renderChipsV2(containerId, items, category, stateObj); 
    };
    box.appendChild(allBtn);

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'chip';
        btn.type = 'button';
        if(currentSet.has(item)) btn.classList.add('selected');

        btn.textContent = item;
        btn.onclick = () => {
            if (currentSet.has(item)) currentSet.delete(item);
            else currentSet.add(item);
            
            btn.classList.toggle('selected', currentSet.has(item));
            updateAllBtn();
        };
        box.appendChild(btn);
    });
    updateAllBtn();
}

/* ===================== QBank: 문제 요청 ===================== */
function startQuizWithOptions(){
  if(!CURRENT_USER) return routeTo('quiz');
  if(!hasGsRun()){ showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

  // [수정] 복합 필터(Composite) 생성 로직
  const composites = [];
  [ 
    {id: 'm1', name: '중1'}, {id: 'm2', name: '중2'}, {id: 'm3', name: '중3'}, 
    {id: 'h1', name: '고1'}, {id: 'h2', name: '고2'}, {id: 'h3', name: '고3'} 
  ].forEach(g => {
      const s = selState[g.id];
      if (s.years.size > 0 || s.months.size > 0) {
          composites.push({
              grade: g.name,
              years: Array.from(s.years),
              months: Array.from(s.months),
              details: Array.from(s.details)
      });
      }
  });

  const filters = {
    composite: composites,
    types:  Array.from(selState['common'].types),
    difficulties: Array.from(selState['common'].difficulties),
    username: CURRENT_USER
  };
  CURRENT_FILTERS = filters;

  // 체크박스 상태 확인
  const isMockMode = document.getElementById('mockExamMode') ? document.getElementById('mockExamMode').checked : false;
  const isExcludeSolved = document.getElementById('excludeSolved') ? document.getElementById('excludeSolved').checked : false;

  let requestCount = 0;
  let requestMax = 100;

  if (isMockMode) {
    requestCount = 0; 
    requestMax = 28;
  } else {
    const val = parseInt((document.getElementById('countInput').value || '').trim(), 10);
    requestCount = (Number.isFinite(val) && val > 0) ? val : 5;
    requestMax = 100;
  }

  const options = { 
      max: requestMax,
      mockMode: isMockMode,      
      allInOrder: isMockMode,
      excludeSolved: isExcludeSolved
  };

  const loadingEl = document.getElementById('loadingOverlay');
  if(loadingEl) loadingEl.classList.add('active');

  google.script.run
    .withSuccessHandler(qs => {
      if(loadingEl) loadingEl.classList.remove('active');
      if(Array.isArray(qs)) qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
      if(!qs || !qs.length){ 
        showCustomAlert('조건에 맞는 문항이 없습니다.\n(선택한 범위에 해당 유형의 문제가 부족할 수 있습니다.)'); 
        return; 
      }
      renderQuestions(qs);
    })
    .withFailureHandler(err => {
      if(loadingEl) loadingEl.classList.remove('active');
      showCustomAlert('문항을 불러오는 중 오류가 발생했습니다: ' + err);
    })
    .getQuestionsByFilter(filters, requestCount, options);
}

/* ===================== QBank: 렌더/채점/로그 ===================== */
function renderQuestions(qs){
  // ★ [추가] 빈 데이터(유령 문제) 필터링 코드
  // 질문(question)이 없거나 공백인 데이터는 아예 목록에서 제외합니다.
  if(Array.isArray(qs)) {
      qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
  }
  CURRENT_QUIZ_DATA = qs; //
  showPanel('quizPage');
  setTopTab('quiz');

  // ★ [추가] OMR 버튼이 혹시 남아있다면 숨기고, 원래 네비게이션 복구
  const omrBtn = document.getElementById('btnSubmitOMR');
  if(omrBtn) omrBtn.style.display = 'none';
  
  const navGroup = document.querySelector('.footer-bar .nav-btn-group');
  if(navGroup) navGroup.style.display = 'flex';

  const quizPage = document.getElementById('quizPage');
  quizPage.innerHTML = '';
// 그룹핑 로직 (수정: groupHash 기반 연계 처리)
  const groups = new Map();
  qs.forEach((q, idxGlobal)=>{
    // groupHash가 있으면 연계 키로 사용, 없으면 개별 고유 ID를 사용하여 강제 병합 방지
    const key = q.groupHash ? q.groupHash : (q.qid || 'Q_' + idxGlobal);
    if(!groups.has(key)){
      groups.set(key, { passage: [q.box1,q.box2,q.box3,q.box4], meta: {grade:q.grade, year:q.year, month:q.month}, items: [] });
    }
    groups.get(key).items.push({ q, idxGlobal });
  });
  const symbols = ['①','②','③','④','⑤'];
  let runningIndex = 0; // 문제 표시 번호
  let slideIndex = 0;
  const fragment = document.createDocumentFragment(); // ★ [최적화] 가상 메모리 생성

    // 그룹별로 슬라이드 생성
  groups.forEach(({ passage, meta, items })=>{
    // 중요: 슬라이드 래퍼 생성
    const slide = document.createElement('div');
    slide.className = 'q-slide';
    slide.setAttribute('data-s-idx', slideIndex++); // 슬라이드 번호 부여

    // ★ [수정됨] 1지문 1문항 여부 체크
    const isSingleQuestion = (items.length === 1);

    // 지문 렌더링 (기존 로직 활용)
    const hasMultiple = items.length > 1;
    if(hasMultiple){
        const guide = document.createElement('h3');
        guide.className = 'question-title';
        guide.textContent = '다음 글을 읽고 물음에 답하시오.';
        slide.appendChild(guide);
    }
    // 메타 정보
    if(meta && (meta.grade || meta.year || meta.month)){
        const src = document.createElement('div');
        src.className = 'source-meta';
        src.textContent = [meta.grade||'', meta.year||'', meta.month||''].filter(Boolean).join(' ');
        slide.appendChild(src);
    }

    // 지문 본문 요소 생성 (아직 붙이지 않음)
    const passageWrap = document.createElement('div');
    passageWrap.className = 'passage-wrap';
    let hasPassage = false;
    (passage||[]).forEach(raw=>{
        const html = sanitizeInlineHTML(raw||'');
        if(!html.trim()) return;
        const p = document.createElement('p');
        p.className = 'passage-p';
        p.innerHTML = html;
        passageWrap.appendChild(p);
        hasPassage = true;
    });

    // ★ [수정됨] 문제가 여러 개일 때만 지문을 먼저 붙임 (기존 방식)
    if(!isSingleQuestion && hasPassage) {
        slide.appendChild(passageWrap);
   }

    // 문제 카드 생성
    items.forEach(({ q, idxGlobal })=>{
        const card = document.createElement('div');
        card.className = 'question-card';
        card.setAttribute('data-idx', String(idxGlobal));
                
        const title = document.createElement('h3');
        title.className = 'question-title';
        runningIndex += 1;
        const qi = toOneLine(sanitizeInlineHTML(q.question || ''));

        // ✅ [수정] 문제 지문이 숫자로 시작하면(예: "28. ...") 그 번호를 가져와서 씁니다.
        // 숫자가 없으면 기존처럼 순서대로(1, 2, 3...) 매깁니다.
        let displayNum = runningIndex;
        const numMatch = qi.match(/^(\d+)[\.．]/); 
        if(numMatch){
            displayNum = numMatch[1];
        }

        // 목록(맵)에도 이 번호를 심어줍니다.
        card.setAttribute('data-q-num', displayNum);

        const headerFlex = document.createElement('div');
        headerFlex.className = 'q-header-flex';

        title.innerHTML = '<span style="color:#2b6cb0; margin-right:4px;">' + displayNum + '번</span> ' + qi;
        title.style.margin = '0'; 
        headerFlex.appendChild(title);

        const btnExp = document.createElement('button');
        btnExp.className = 'btn-exp';
        btnExp.type = 'button';
        btnExp.textContent = '해설';
        btnExp.style.display = 'none'; // 초기엔 숨김 (채점 후 노출)
        btnExp.setAttribute('data-exp-btn', idxGlobal);
        btnExp.onclick = function() { toggleExplanation(this, idxGlobal); };
        headerFlex.appendChild(btnExp);

        card.appendChild(headerFlex);

        // ★ [수정됨] 문제가 1개인 경우: 질문 바로 뒤에 지문을 끼워넣음
        if(isSingleQuestion && hasPassage){
            card.appendChild(passageWrap);
        }

        const nameGroup = 'q_'+idxGlobal;
        const isDescriptive = String(q.type || '').includes('서술형');

        if (isDescriptive) {
            const answers = String(q.answer || '').split('||').map(s => s.trim());
            const ansCount = answers.length;
            const descContainer = document.createElement('div');
            descContainer.className = 'desc-input-group';
            descContainer.style.marginTop = '10px';

            for(let i=0; i<ansCount; i++) {
                const row = document.createElement('div');
                row.style.marginBottom = '8px';
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                
                let labelText = '';
                if (ansCount > 1) {
                    const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];
                    labelText = labels[i] || `(${i+1})`;
                }
                
                if (labelText) {
                    const lbl = document.createElement('span');
                    lbl.textContent = labelText;
                    lbl.style.fontWeight = 'bold';
                    lbl.style.marginRight = '8px';
                    lbl.style.color = '#374151';
                    row.appendChild(lbl);
                }
                
                const input = document.createElement('input');
                input.type = 'text';
                input.name = nameGroup + '_' + i;
                input.className = 'desc-input';
                input.style.flex = '1';
                input.style.padding = '8px';
                input.style.border = '1px solid #d1d5db';
                input.style.borderRadius = '6px';
                input.placeholder = '정답을 입력하세요';
                
                row.appendChild(input);
                descContainer.appendChild(row);
            }
            card.appendChild(descContainer);
        } else {
            let currentOptions = q.options || [];
            if (currentOptions.length === 0) {
                currentOptions = ['', '', '', '', ''];
            }

            currentOptions.forEach((opt,i)=>{
            const label = document.createElement('label');
            label.className = 'option';
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = nameGroup; input.value = String(i+1);
            const span = document.createElement('span');
            span.innerHTML = (symbols[i]||'') + ' ' + sanitizeInlineHTML(opt||'');
            label.appendChild(input); label.appendChild(span);
            // 2. 선택지 추가
            card.appendChild(label);
        });
        }

        // 해설/결과 영역
        const resultBar = document.createElement('div');
        resultBar.className = 'result-bar';
        resultBar.style.display = 'none';
        card.appendChild(resultBar);

        const expBox = document.createElement('div');
        expBox.className = 'explanation-box';
        expBox.innerHTML = '<b style="color:#2b6cb0;">[해설]</b><br>' + sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.');
        card.appendChild(expBox);
        slide.appendChild(card);
    });

fragment.appendChild(slide); // ★ [최적화] 가상 메모리에 담기 (화면 갱신 X)
  });

  quizPage.appendChild(fragment); // ★ [최적화] 한 번에 화면에 붙이기 (화면 갱신 1회)

  // UI 초기화
  CURRENT_SLIDE_IDX = 0;
  updateSlideView();
  // 첫 문제 보여주기
  renderQuestionMap(); // 우측 목록 생성
  showFooter();
  const btnMap = document.getElementById('btnShowMap');
  if(btnMap) btnMap.style.display = 'inline-flex';
  const btnVocab = document.getElementById('btnOpenVocab');
  if(btnVocab) btnVocab.style.display = 'inline-flex';
}

function gradeAll(onSuccessCallback, forceCompleteStatus){
  const cards = document.querySelectorAll('.question-card[data-idx]');
  if(!cards.length){ return; }

  const collectedAnswers = [];
  
  // 문항 수 카운트
  let totalCnt = 0;
  let answeredCnt = 0;
  let totalCorrectCnt = 0; // 총 정답 수 추적
  
  cards.forEach(card => {
      totalCnt++;
      const idx = parseInt(card.getAttribute('data-idx'), 10);
      const q = CURRENT_QUIZ_DATA[idx];
      if(!q) return;

      // 1. 서술형인지 객관식인지 확인
      const isDescriptive = String(q.type || '').includes('서술형');
      const correct = String(q.answer || '').trim();

      let selected = '';
      let isCorrect = null;
      let hasAnswered = false;

      // 2. 문항 유형별로 답안을 가져오는 로직
      if (isDescriptive) {
          const answers = correct.split('||').map(s => s.trim());
          const ansCount = answers.length;
          const userInputs = [];
          let allCorrect = true;
          let anyAnswered = false;

          for(let i=0; i<ansCount; i++) {
              // 서술형 입력창 찾기
              let inp = card.querySelector(`input[name="q_${idx}_${i}"]`);
              if(!inp) inp = card.querySelector(`input[name="omr_${idx}_${i}"]`);
              
              const rawVal = inp ? inp.value : '';
              if (rawVal.trim() !== '') anyAnswered = true;
              userInputs.push(rawVal);
          }
          
          if (anyAnswered) {
              hasAnswered = true;
              for(let i=0; i<ansCount; i++) {
                  // 학생 입력값 정리
                  const cleanInput = userInputs[i].toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.,?!]/g, '');
                  // 정답 템플릿
                  const templates = answers[i].split(/\s*\/\s*(?![^\[]*\])/);
                  
                  // 정답 여부 판별
                  const isPartCorrect = templates.some(template => compareWithBrackets(cleanInput, template));
                  if (!isPartCorrect) allCorrect = false;
                  
                  // UI 업데이트 (색상 처리)
                  let inp = card.querySelector(`input[name="q_${idx}_${i}"]`);
                  if(!inp) inp = card.querySelector(`input[name="omr_${idx}_${i}"]`);
                  if (inp) {
                      inp.disabled = true;
                      inp.style.backgroundColor = isPartCorrect ? '#d1fae5' : '#fee2e2';
                      inp.style.borderColor = isPartCorrect ? '#10b981' : '#ef4444';
                      inp.style.color = isPartCorrect ? '#065f46' : '#991b1b';
                  }
              }
              isCorrect = allCorrect;
              selected = userInputs.join('||');
          }
      } else {
          // 객관식 로직
          const nameGroupQ = 'q_'+idx;
          const nameGroupOMR = 'omr_'+idx;
          let checked = card.querySelector('input[name="'+nameGroupQ+'"]:checked');
          if(!checked) checked = card.querySelector('input[name="'+nameGroupOMR+'"]:checked');

          selected = checked ? checked.value : ''; 
          if (selected) {
              hasAnswered = true;
              isCorrect = (selected === correct);
          }
      }

      if(hasAnswered) answeredCnt++;

    // 미입력(빈칸) 문항은 이전 시도의 오답 표식이 남아있지 않도록 초기화 (스크롤 타겟에서 제외)
      if (!hasAnswered && card.getAttribute('data-already-correct') !== 'true') {
          card.removeAttribute('data-currently-wrong');
      }

      // 3. 결과 표시 UI 분기 (OMR 모드 vs 일반 모드) - 이미 맞은 문제는 UI 재렌더링 생략
      if (hasAnswered && card.getAttribute('data-already-correct') !== 'true') {
          const isOMR = card.classList.contains('omr-card');
          const isRetrying = card.getAttribute('data-retrying') === 'true';
          const btnExp = card.querySelector('button[data-exp-btn]');
          if (btnExp) btnExp.style.display = 'inline-block';

          if (isOMR) {
              // [OMR 모드 전용 UI 및 잠금]
              const title = card.querySelector('.question-title');
              let numText = title.innerText.split('번')[0] + '번';
              
              title.classList.remove('wrong', 'corrected', 'correct');
              let titleColor = "#059669"; 
              let statusTxt = " (정답 ✓)";

              if (!isCorrect) {
                  title.classList.add('wrong');
                  titleColor = "#dc2626"; 
                  statusTxt = " (오답 ✖)";
                  card.setAttribute('data-currently-wrong', 'true');
              } else if (isRetrying) {
                  title.classList.add('corrected');
                  titleColor = "#d97706"; 
                  statusTxt = " (정답 ▲)";
                  card.removeAttribute('data-currently-wrong');
                  card.removeAttribute('data-retrying');
              } else {
                  title.classList.add('correct');
                  card.removeAttribute('data-currently-wrong');
                  card.removeAttribute('data-retrying');
              }
              
              title.innerHTML = `<span style="font-size:18px; font-weight:bold; color:${titleColor};">${numText}${statusTxt}</span>`;

              const optWrap = card.querySelector('.omr-options-wrap');
              if (optWrap) optWrap.style.pointerEvents = 'none';
              
              const descWrap = card.querySelector('.desc-input-group');
              if (descWrap) descWrap.style.pointerEvents = 'none';

              const descInputs = card.querySelectorAll('.desc-input');
              descInputs.forEach(inp => {
                  inp.disabled = true;
                  if (isCorrect) {
                      inp.style.backgroundColor = isRetrying ? '#fef3c7' : '#d1fae5';
                      inp.style.color = isRetrying ? '#92400e' : '#065f46';
                  } else {
                      inp.style.backgroundColor = '#fee2e2';
                      inp.style.color = '#991b1b';
                  }
              });

              if (!isDescriptive) {
                  const omrLabels = card.querySelectorAll('.omr-opt-label');
                  omrLabels.forEach((label) => {
                      const inp = label.querySelector('input');
                      if (inp) inp.disabled = true;
                      label.classList.add('disabled');
                      
                      if (inp && inp.value === selected) {
                          if (isCorrect) label.classList.add(isRetrying ? 'corrected' : 'correct');
                          else label.classList.add('wrong');
                      } else {
                          label.classList.add('dimmed');
                      }
                  });
              }
          } else {
              // [일반 온라인 풀기 모드 기존 UI]
              const title = card.querySelector('.question-title');
              const resultBar = card.querySelector('.result-bar');
              if (title) title.classList.toggle('wrong', !isCorrect);
              if (resultBar) {
                  resultBar.style.display = 'block';
                  resultBar.textContent = isCorrect ? '정답' : '오답';
                  resultBar.style.color = isCorrect ? '#059669' : '#b91c1c';
              }
              if (!isDescriptive) {
                  const optionLabels = card.querySelectorAll('.option');
                  optionLabels.forEach((lab, i)=>{
                      const val = String(i+1);
                      const inp = lab.querySelector('input');
                      if(inp) inp.disabled = true; 
                      if(val === selected){
                          lab.style.background = isCorrect ? '#d1fae5' : '#fee2e2';
                          lab.style.borderColor = isCorrect ? '#10b981' : '#ef4444';
                          lab.style.color = isCorrect ? '#065f46' : '#991b1b';
                      } else {
                          lab.style.opacity = 0.5;
                      }
                  });
              }
          }
      }

      // 정답 개수 추적 및 처리
      if (card.getAttribute('data-already-correct') === 'true') {
          totalCorrectCnt++;
          return; 
      } else if (isCorrect === true) {
          totalCorrectCnt++;
      }

      if (!selected || selected.trim() === '') {
          return; 
      }

      collectedAnswers.push({
        qid: q.qid||'',
        extId: q.extId||'',
        source: q.source||'',
        type: q.type||'',
        grade: q.grade||'',
        year: q.year||'',
        month: q.month||'',
        question: toOneLine(q.question||''),
        correctAnswer: correct,
        selected: selected,
        isCorrect: isCorrect
      });
      
      // 이번에 맞힌 문제(처음 맞힌 문제 및 틀렸다가 고쳐서 맞힌 문제)는 정답 확정 처리하여 다음 스크롤 타겟에서 제외
      if (isCorrect === true) {
          card.setAttribute('data-already-correct', 'true');
          card.removeAttribute('data-currently-wrong');
          card.removeAttribute('data-retrying');
      }
      card.setAttribute('data-graded','1');
  }); // <-- forEach 루프 종료

  if(hasGsRun() && CURRENT_USER){
      const pageAssignId = document.getElementById('quizPage').getAttribute('data-assign-id');
      const activeSessionId = pageAssignId || CURRENT_ASSIGNMENT_ID || CURRENT_SESSION || undefined;
      
      // 완료 여부 결정 로직
      let isCompleteFinal = false;
      if (typeof forceCompleteStatus === 'boolean') {
          isCompleteFinal = forceCompleteStatus;
      } else {
          isCompleteFinal = (totalCorrectCnt === totalCnt && totalCnt > 0);
      }

      const payload = {
        user: { id: CURRENT_USER.id, name: CURRENT_USER.name },
        sessionId: activeSessionId, 
        filters: CURRENT_FILTERS || undefined,
        answers: collectedAnswers,
        isComplete: isCompleteFinal 
      };

      const isClickEvent = (onSuccessCallback && typeof onSuccessCallback === 'object' && onSuccessCallback.type === 'click');

      const loadEl = document.getElementById('loadingOverlay');
      if (isClickEvent && loadEl) {
          loadEl.querySelector('.loading-text').innerHTML = '채점 및 결과를 서버에 저장 중입니다...';
          loadEl.classList.add('active');
      }

      google.script.run
        .withSuccessHandler(function(res){
          if (isClickEvent && loadEl) loadEl.classList.remove('active');

          if(onSuccessCallback && typeof onSuccessCallback === 'function') {
              onSuccessCallback(res); 
          } 
          else if (isClickEvent) {
              if (activeSessionId) {
                  if (isCompleteFinal) {
                      showCustomAlert('100% 정답입니다!\n과제가 최종 완료 처리되었습니다.');
                      routeTo('assignment');
                  } else {
                      showCustomAlert('채점이 반영되었습니다.\n(오답이 남아있어 미완료 상태로 유지됩니다.)');
                  }
              } else {
                  showCustomAlert('채점이 완료되었습니다.\n오답노트에서 틀린 문제를 다시 풀어보세요.');
              }
          }
        })
        .withFailureHandler(function(err){
          if (isClickEvent && loadEl) loadEl.classList.remove('active');
          showCustomAlert('오류: 채점 결과 저장 실패!\n' + err);
        })
        .logAttempt(payload);
  } else if (!CURRENT_USER) {
      showCustomAlert('로그인 상태가 아닙니다.');
  }
}

/* ===================== 오답 ===================== */
let WRONG_STATS = [];
let WRONG_SELECTED = new Set();

function loadWrongStats(){
  if(!CURRENT_USER) return;

  // [수정] 이미 불러온 데이터가 있으면 서버 호출 없이 바로 그리고 종료
  if(WRONG_STATS && WRONG_STATS.length > 0) {
      renderWrongStatsTableV2(WRONG_STATS);
      return;
  }

  if(!hasGsRun()){ showCustomAlert('서버 연결 문제'); return; }
  
  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '오답 데이터를 가져오는 중...';
      loadEl.classList.add('active');
  }

  google.script.run.withSuccessHandler(stats=>{
    if(loadEl) loadEl.classList.remove('active');
    
    WRONG_STATS = Array.isArray(stats)? stats: [];
    WRONG_SELECTED.clear();
    renderWrongStatsTableV2(WRONG_STATS);
  })
  .withFailureHandler(err => {
      if(loadEl) loadEl.classList.remove('active'); 
      showCustomAlert('오류: ' + err);
  })
  .getWrongStats(CURRENT_USER, null);
}

function renderWrongStatsTableV2(stats){
  const wrap = document.getElementById('wrongStatsWrap');
  wrap.innerHTML = '';

  if (!stats || !stats.length) {
    wrap.textContent = '오답 목록이 없습니다.';
    return;
  }

  const uniq = arr => Array.from(new Set(arr.filter(Boolean)));
  const byLatestThenMeta = (a,b)=>{
    if ((b.lastTs||'').localeCompare(a.lastTs||'') !== 0) return (b.lastTs||'').localeCompare(a.lastTs||'');
    if ((a.grade||'').localeCompare(b.grade||'') !== 0) return (a.grade||'').localeCompare(b.grade||'');
    if ((b.year||'').localeCompare(a.year||'') !== 0) return (b.year||'').localeCompare(a.year||'');
    if ((a.month||'').localeCompare(b.month||'') !== 0) return (a.month||'').localeCompare(b.month||'');
    const an = Number(a.number||0), bn = Number(b.number||0);
    return (isNaN(an)||isNaN(bn)) ? String(a.number||'').localeCompare(String(b.number||'')) : (an - bn);
  };

  const sortedAll = stats.slice().sort(byLatestThenMeta);

  const filtersBox = document.createElement('div');
  filtersBox.className = 'question-card';
  filtersBox.style.marginTop = '0';

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '▼ 필터 보이기';
  toggleBtn.className = 'btn-ghost';
  toggleBtn.style.marginBottom = '10px';
  filtersBox.appendChild(toggleBtn);

  const filterInner = document.createElement('div');
  filtersBox.appendChild(filterInner);

  const grades = uniq(sortedAll.map(x=>x.grade)).sort();
  const years  = uniq(sortedAll.map(x=>String(x.year))).sort();
  const months = uniq(sortedAll.map(x=>x.month)).sort();
  const types  = uniq(sortedAll.map(x=>x.type)).sort();

  const mkSelect = (id, label, values)=> {
    const box = document.createElement('div');
    const lab = document.createElement('label'); lab.setAttribute('for', id); lab.textContent = label;
    const sel = document.createElement('select'); sel.id = id; sel.innerHTML = '<option value="">전체</option>';
    values.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; sel.appendChild(o); });
    box.appendChild(lab); box.appendChild(sel); return {box, sel};
  };
  const mkNum = (id, label, ph)=> {
    const box=document.createElement('div');
    const lab=document.createElement('label'); lab.setAttribute('for', id); lab.textContent=label;
    const inp=document.createElement('input'); inp.type='number'; inp.id=id; inp.placeholder=ph||'';
    box.appendChild(lab); box.appendChild(inp); return {box, inp};
  };
  const mkText = (id, label, ph)=> {
    const box=document.createElement('div');
    const lab=document.createElement('label'); lab.setAttribute('for', id); lab.textContent=label;
    const inp=document.createElement('input'); inp.type='text'; inp.id=id; inp.placeholder=ph||'';
    box.appendChild(lab); box.appendChild(inp); return {box, inp};
  };

  const row1 = document.createElement('div'); row1.className = 'row';
  const row2 = document.createElement('div'); row2.className = 'row';

  const selGrade = mkSelect('wf-grade','학년', grades);
  const selYear  = mkSelect('wf-year','년도', years);
  const selMonth = mkSelect('wf-month','월/교재', months);
  const selType  = mkSelect('wf-type','유형', types);
  const numDays  = mkNum('wf-days','최근 N일','빈칸=제한없음');
  const numMin   = mkNum('wf-min','최소 틀린 횟수','예: 2');
  const txtQuery = mkText('wf-q','검색','예: 요지, 3월, 22');

  row1.appendChild(selGrade.box);
  row1.appendChild(selYear.box);
  row1.appendChild(selMonth.box);
  row1.appendChild(selType.box);

  row2.appendChild(numDays.box);
  row2.appendChild(numMin.box);
  row2.appendChild(txtQuery.box);

  const btnBar = document.createElement('div'); btnBar.className='stack-gap';
  const btnApply = document.createElement('button'); btnApply.textContent='필터 적용';
  const btnReset = document.createElement('button'); btnReset.textContent='필터 초기화'; btnReset.className='btn-ghost';
  btnBar.appendChild(btnApply); btnBar.appendChild(btnReset);

  filterInner.appendChild(row1);
  filterInner.appendChild(row2);
  filterInner.appendChild(btnBar);

  let collapsed = true;
  filterInner.style.display = 'none';
  toggleBtn.addEventListener('click', ()=>{
    collapsed = !collapsed;
    filterInner.style.display = collapsed ? 'none' : 'block';
    toggleBtn.textContent = collapsed ? '▼ 필터 보이기' : '▲ 필터 숨기기';
  });

  wrap.appendChild(filtersBox);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'wrong-plain-wrap';
  wrap.appendChild(tableWrap);

  const actions = document.createElement('div');
  actions.className = 'wrong-actions';
  const btnPlay = document.createElement('button');
  btnPlay.textContent = '선택한 문항 풀기';
  btnPlay.className = 'btn-primary';
  actions.appendChild(btnPlay);
  wrap.appendChild(actions);

  WRONG_SELECTED.clear();

  function applyFilters(allRows){
    let out = allRows.slice();
    const fG = selGrade.sel.value || '';
    const fY = selYear.sel.value || '';
    const fM = selMonth.sel.value || '';
    const fT = selType.sel.value || '';
    const fD = parseInt(numDays.inp.value, 10);
    const fMin = parseInt(numMin.inp.value, 10);
    const q = (txtQuery.inp.value || '').trim().toLowerCase();

    if (fG) out = out.filter(function(r){ return String(r.grade) === fG; });
    if (fY) out = out.filter(function(r){ return String(r.year)  === fY; });
    if (fM) out = out.filter(function(r){ return String(r.month) === fM; });
    if (fT) out = out.filter(function(r){ return String(r.type)  === fT; });

    if (Number.isFinite(fD) && fD > 0) {
      const minTs = Date.now() - fD*24*3600*1000;
      out = out.filter(r => {
        const ts = new Date(String(r.lastTs||'')).getTime();
        return isFinite(ts) ? ts >= minTs : true;
      });
    }
    if (Number.isFinite(fMin) && fMin > 0) out = out.filter(r => Number(r.wrongCount||0) >= fMin);

    if (q) {
      out = out.filter(r => {
        const hay = [r.type, r.month, r.grade, r.year, r.number, r.source]
          .map(function(x){ return String(x||'').toLowerCase(); }).join(' ');
        return hay.includes(q);
      });
    }
    return out.sort(byLatestThenMeta);
  }

  function renderTable(rows){
    tableWrap.innerHTML = '';
    if (!rows.length) {
      tableWrap.textContent = '조건에 맞는 항목이 없습니다.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'wrong-plain';

    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr>'+
        '<th style="width:40px;"><input type="checkbox" id="wrongHeadCheck"></th>'+
        '<th>실시일</th>'+
        '<th>학년</th>'+
        '<th>년도</th>'+
        '<th>월/교재</th>'+
        '<th>유형</th>'+
        '<th>문항 번호</th>'+
        '<th>틀린 횟수</th>'+
      '</tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(it=>{
      const tr = document.createElement('tr');
      if (it.fixed) tr.classList.add('wrong-fixed');
      const dateOnly = it.lastTs ? String(it.lastTs).split(' ')[0] : '';
      tr.innerHTML =
        '<td class="cell-center"><input type="checkbox" data-qid="'+it.qid+'" data-fixed="'+(it.fixed?1:0)+'"></td>'+
        '<td>'+ dateOnly +'</td>'+
        '<td>'+ (it.grade||'') +'</td>'+
        '<td>'+ (it.year||'') +'</td>'+
        '<td>'+ (it.month||'') +'</td>'+
        '<td>'+ (it.type||'') +'</td>'+
        '<td>'+ (it.number||'') +'</td>'+
        '<td class="cell-right">'+ (it.wrongCount||0) +'</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    const headCheck = document.getElementById('wrongHeadCheck');
    headCheck.addEventListener('change', ()=>{
      const checked = headCheck.checked;
      tbody.querySelectorAll('input[type="checkbox"][data-qid]').forEach(cbx=>{
        const isFixed = cbx.getAttribute('data-fixed') === '1';
        const qid = cbx.getAttribute('data-qid');
        if (isFixed) {
          cbx.checked = false;
          WRONG_SELECTED.delete(qid);
        } else {
          cbx.checked = checked;
          if (checked) WRONG_SELECTED.add(qid); else WRONG_SELECTED.delete(qid);
        }
      });
    });

    tbody.addEventListener('change', (e)=>{
      const t = e.target;
      if (t && t.matches('input[type="checkbox"][data-qid]')) {
        const qid = t.getAttribute('data-qid');
        if (t.checked) WRONG_SELECTED.add(qid); else WRONG_SELECTED.delete(qid);
      }
    });
  }

  let current = applyFilters(sortedAll);
  renderTable(current);

  btnApply.addEventListener('click', ()=>{
    WRONG_SELECTED.clear();
    current = applyFilters(sortedAll);
    renderTable(current);
  });
  btnReset.addEventListener('click', ()=>{
    [selGrade.sel, selYear.sel, selMonth.sel, selType.sel].forEach(s=> s.value='');
    [numDays.inp, numMin.inp, txtQuery.inp].forEach(i=> i.value='');
    WRONG_SELECTED.clear();
    current = applyFilters(sortedAll);
    renderTable(current);
  });

  btnPlay.addEventListener('click', ()=>{
      const pick = Array.from(WRONG_SELECTED);
      if (!pick.length) { showCustomAlert('선택한 문항이 없습니다. 표에서 체크해 주세요.'); return; }
      if (!hasGsRun()) { showCustomAlert('서버 연결에 문제가 있습니다.'); return; }

      // ★ [추가 1] 로딩 화면 켜기
      const loadingEl = document.getElementById('loadingOverlay');
      if(loadingEl) loadingEl.classList.add('active');

      google.script.run
        .withSuccessHandler(qs=>{
          // ★ [추가 2] 성공 시 로딩 화면 끄기
          if(loadingEl) loadingEl.classList.remove('active');

          // 빈 데이터 필터링 (안전장치)
          if(Array.isArray(qs)) {
              qs = qs.filter(q => q && q.question && String(q.question).trim() !== '');
          }

          if (!qs || !qs.length){ showCustomAlert('선택한 문항을 불러오지 못했습니다.\n(삭제되었거나 내용이 없는 문제일 수 있습니다.)'); return; }
          renderQuestions(qs);
        })
        .withFailureHandler(err=>{
          // ★ [추가 3] 실패 시에도 로딩 화면 끄기
          if(loadingEl) loadingEl.classList.remove('active');
          showCustomAlert('문항 불러오기 오류: ' + err);
        })
        .getQuestionsByQids(pick);
    });
}


function showSelectWarning(msg){
  const w = document.getElementById('selectWarning');
  if(!w) return;
  if(!msg){ w.style.display='none'; w.textContent=''; return; }
  w.style.display='block';
  w.textContent=msg;
}

function updateSlideView(){
  const slides = document.querySelectorAll('.q-slide');
  const total = slides.length;
  if(total === 0) return;

  // 1. 인덱스 범위 체크
  if(CURRENT_SLIDE_IDX < 0) CURRENT_SLIDE_IDX = 0;
  if(CURRENT_SLIDE_IDX >= total) CURRENT_SLIDE_IDX = total - 1;

  // 2. 현재 슬라이드만 보여주기
  slides.forEach((s, i) => {
    if(i === CURRENT_SLIDE_IDX) s.classList.add('active-slide');
    else s.classList.remove('active-slide');
  });

  // 3. 버튼 제어 로직 (핵심)
  const btnPrev = document.getElementById('btnPrevQ');
  const btnNext = document.getElementById('btnNextQ');
  const btnGrade = document.getElementById('btnGradeAll');

  // [이전] 버튼: 첫 문제에서는 비활성화(흐리게) 혹은 숨김
  if(btnPrev) {
      btnPrev.disabled = (CURRENT_SLIDE_IDX === 0);
      // 첫 페이지에서 아예 안 보이게 하려면 아래 주석 해제
      // btnPrev.style.visibility = (CURRENT_SLIDE_IDX === 0) ? 'hidden' : 'visible';
  }

  // [다음] vs [채점] 버튼 교체
  const isLast = (CURRENT_SLIDE_IDX === total - 1);
  
  if(isLast) {
      // 마지막 문제: '다음' 숨기고 '채점' 보이기
      if(btnNext) btnNext.style.display = 'none';
      if(btnGrade) btnGrade.style.display = 'block';
  } else {
      // 평소: '다음' 보이기, '채점' 숨기기
      if(btnNext) {
          btnNext.style.display = 'block';
          btnNext.textContent = '다음'; // 텍스트 초기화
      }
      if(btnGrade) btnGrade.style.display = 'none';
  }
  
  // 4. 기타 UI 갱신 (목록 하이라이트 등)
  updateMapHighlight();
  window.scrollTo(0, 0);
}

// 이전/다음 버튼 동작
function prevSlide(){ CURRENT_SLIDE_IDX--; updateSlideView(); }
function nextSlide(){ CURRENT_SLIDE_IDX++; updateSlideView(); }

// 우측 목록(맵) 생성
function renderQuestionMap(){
  const grid = document.getElementById('qMapGrid');
  const slides = document.querySelectorAll('.q-slide');
  if(!grid) return;
  grid.innerHTML = '';

  slides.forEach((slide, idx)=>{
    // 슬라이드 안의 첫 번째 문제 번호를 가져옴
    const firstCard = slide.querySelector('.question-card');
    const qNum = firstCard ? firstCard.getAttribute('data-q-num') : (idx+1);

    const btn = document.createElement('div');
    btn.className = 'map-item';
    btn.textContent = qNum;
    btn.setAttribute('data-s-target', idx);
    
    btn.addEventListener('click', ()=>{
      CURRENT_SLIDE_IDX = idx;
      updateSlideView();
      closeQuestionMap(); // 이동 후 닫기
    });
    grid.appendChild(btn);
  });
}

// 현재 위치 맵에 표시
function updateMapHighlight(){
    const items = document.querySelectorAll('.map-item');
    items.forEach(it => {
        const target = parseInt(it.getAttribute('data-s-target'));
        if(target === CURRENT_SLIDE_IDX) it.classList.add('current');
        else it.classList.remove('current');
    });
}

// 목록 드로어 열기/닫기
function openQuestionMap(){
    const d = document.getElementById('questionMapDrawer');
    const o = document.getElementById('drawerOverlay');
    if(d) d.classList.add('open');
    if(o) o.style.display = 'block';
}
function closeQuestionMap(){
    const d = document.getElementById('questionMapDrawer');
    const o = document.getElementById('drawerOverlay'); // 단어장이랑 오버레이 공유
    if(d) d.classList.remove('open');
    if(o) o.style.display = 'none';
}

function loadMyAssignments(){
  const listActive = document.getElementById('assignmentList');
  const listDone = document.getElementById('completedAssignmentList');
  
  if(!listActive || !listDone) return;
  
  // 로딩 표시
  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '과제 보관함을 확인 중...';
      loadEl.classList.add('active');
  }

  // ★ [최적화] 서버 통신 1회로 통합하여 미완료/완료 과제 동시 로드
  google.script.run.withSuccessHandler(res => {
      if(loadEl) loadEl.classList.remove('active');
      renderAssignmentList(listActive, res.active, false); // 미완료 렌더링
      renderAssignmentList(listDone, res.completed, true); // 완료 렌더링
  }).withFailureHandler(err => {
      if(loadEl) loadEl.classList.remove('active');
      showCustomAlert('과제 목록 로드 실패: ' + err);
  }).getAllMyAssignments(CURRENT_USER);
}

let MY_ASSIGNMENTS_CACHE = []; // 내 과제 데이터를 임시 저장할 배열

function renderAssignmentList(container, data, isCompleted) {
  container.innerHTML = '';
  if(!data || !data.length) { 
    container.innerHTML = `<div style="padding:20px; text-align:center; color:#9ca3af; font-size:14px;">목록이 없습니다.</div>`;
    return;
  }

  // 데이터 캐싱: 나중에 ID로 문항 정보를 찾을 수 있게 저장
  data.forEach(item => { ASGN_CACHE[item.id] = item; });

  data.forEach(asgn => {
      const card = document.createElement('div');
      card.className = 'question-card';
      card.style.marginBottom = '12px';
      card.style.borderLeft = isCompleted ? '5px solid #6b7280' : '5px solid #2b6cb0';

      let dateStr = asgn.date;
      try { dateStr = String(asgn.date).substring(5, 16).replace('-','/'); } catch(e){}

      const statusBadge = isCompleted 
        ? `<span style="background:#e5e7eb; color:#374151; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">완료됨</span>`
        : `<span style="background:#dbeafe; color:#1e40af; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">미완료</span>`;

      // ★ 버튼 수정: qids를 직접 넘기지 않고 id와 모드만 전달
      const btnHtml = isCompleted
        ? `<button class="btn-ghost" style="width:100%; padding:8px; font-size:14px;" onclick="startRetryAssignment('${asgn.id}', null, true)">📊 결과 확인</button>`
        : `<button class="btn-primary" style="width:100%; padding:10px 0; font-size:14px; background:#2b6cb0; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;" onclick="startAssignment('${asgn.id}', 'omr')">📝 과제 풀기 (OMR & 온라인)</button>`;

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h3 style="margin:0 0 6px; font-size:16px; color:#111827;">${sanitizeInlineHTML(asgn.title)}</h3>
            <div style="font-size:12px; color:#6b7280;">📅 ${dateStr} | 📝 ${asgn.count}문항</div>
          </div>
          ${statusBadge}
        </div>
        <div style="margin-top:10px;">${btnHtml}</div>
      `;
      container.appendChild(card);
  });
}

// 과제 시작하기
function startAssignment(id, mode){
  CURRENT_ASSIGNMENT_ID = id;
  CURRENT_SESSION = id; 
  
  // 캐시에서 과제 정보 가져오기
  const asgn = ASGN_CACHE[id];
  if(!asgn) {
      showCustomAlert('과제 데이터를 찾을 수 없습니다. 목록을 새로고침 해주세요.');
      return;
  }

  let qids = asgn.qids;
  if (typeof qids === 'string') {
      try { qids = JSON.parse(qids); } catch(e){ showCustomAlert('데이터 오류'); return; }
  }
  
  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '과제 데이터를 불러오는 중...';
      loadEl.classList.add('active');
  }

  google.script.run
    .withSuccessHandler(res => {
        if(loadEl) loadEl.classList.remove('active');
        const qs = res.qs;
        const history = res.history;

        if (mode === 'omr') {
            // [📟 OMR 입력] 모드
            renderOMRSheet(qs, history, false, id);
        } else {
            // [✍️ 온라인 풀기] 모드
            const qPage = document.getElementById('quizPage');
            qPage.setAttribute('data-assign-id', id); // 채점 시 과제 완료 처리를 위해 세팅
            qPage.innerHTML = ''; 
            
            renderQuestions(qs); 
            
            // 온라인 풀기 시에도 단어장 버튼 노출
            document.getElementById('btnOpenVocab').style.display = 'inline-flex';
        }
    })
    .withFailureHandler(err => {
      if(loadEl) loadEl.classList.remove('active');
      showCustomAlert('오류 발생: ' + err);
    })
    .loadRetryData(CURRENT_USER, qids, id, mode === 'omr' ? 'omr' : null);
}

/* [도우미 함수] 온라인 풀기 화면 HTML 생성 (스파게티 코드 분리용) */
function generateOnlineViewHtml(q) {
    let html = '<style>.online-box img { max-width: 100% !important; height: auto !important; object-fit: contain; display: block; margin: 8px auto; }</style>';
    const p1 = q.box1 ? sanitizeInlineHTML(q.box1) : '';
    const p2 = q.box2 ? sanitizeInlineHTML(q.box2) : '';
    const p3 = q.box3 ? sanitizeInlineHTML(q.box3) : '';
    const p4 = q.box4 ? sanitizeInlineHTML(q.box4) : '';
    const combinedPassage = [p1, p2, p3, p4].filter(p => p.trim() !== '').join('<div style="height:12px;"></div>');
    
    if (combinedPassage) {
        html += `<div class="passage-wrap" style="background:#fff; border:1px solid #e5e7eb; padding:12px; border-radius:8px; margin-bottom:12px; font-family:'Times New Roman', serif; font-size:15px; line-height:1.6;">${combinedPassage}</div>`;
    }
    
    let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
    let extractedBox = '';
    const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
    const boxMatch = preservedHTML.match(boxRegex);
    if (boxMatch) {
        extractedBox = boxMatch[0];
        preservedHTML = preservedHTML.replace(boxRegex, '');
    }
    
    html += `<div style="font-size:15px; font-weight:bold; margin-bottom:10px; color:#1e293b;">${toOneLine(preservedHTML).trim()}</div>`;
    if (extractedBox) html += `<div style="margin-bottom:12px;">${extractedBox}</div>`;
    
    const isDesc = String(q.type || '').includes('서술형');
    if (!isDesc && q.options && q.options.length > 0) {
        const symbols = ['①','②','③','④','⑤'];
        q.options.forEach((opt, optIdx) => {
            if (opt.trim()) {
                html += `<label class="option" style="display:block; padding:10px; margin:6px 0; border:1px solid #d1d5db; border-radius:8px; cursor:pointer; background:#fff; transition:all 0.2s;" 
                           onclick="const omrWrap = this.closest('.question-card').querySelector('.omr-options-wrap');
                                    if (omrWrap) {
                                        const targetRadio = omrWrap.querySelector('input[value=\\'${optIdx + 1}\\']');
                                        if (targetRadio && !targetRadio.disabled) targetRadio.click();
                                    }
                                    const siblings = this.parentElement.querySelectorAll('.option');
                                    siblings.forEach(s => { s.style.background = '#fff'; s.style.borderColor = '#d1d5db'; s.style.color = 'inherit'; });
                                    this.style.background = '#eff6ff'; this.style.borderColor = '#2b6cb0'; this.style.color = '#1e40af';">
                            <span style="font-weight:bold; margin-right:8px; color:#475569;">${symbols[optIdx] || ''}</span>
                            <span>${sanitizeInlineHTML(opt)}</span>
                         </label>`;
            }
        });
    } else if (isDesc) {
        html += `<div style="color:#64748b; font-size:13px; text-align:center; padding:10px;">※ 서술형 문항의 정답은 상단의 OMR 입력칸을 이용해 주십시오.</div>`;
    }
    return html;
}

// 문항 객체별로 진행 중 요청을 공유합니다. 과제 기록은 캐시하지 않습니다.
const OMR_DETAIL_PENDING = new WeakMap();
function ensureOMRQuestionDetail(q) {
  if (!q._omrLite) return Promise.resolve(q);
  if (OMR_DETAIL_PENDING.has(q)) return OMR_DETAIL_PENDING.get(q);
  const pending = new Promise((resolve, reject) => {
    google.script.run.withSuccessHandler(rows => {
      const full = (rows || []).find(item => item.qid === q.qid);
      if (!full) { reject(new Error('문항 정보를 찾을 수 없습니다.')); return; }
      Object.assign(q, full);
      delete q._omrLite;
      resolve(q);
    }).withFailureHandler(reject).getQuestionsByQids([q.qid]);
  });
  OMR_DETAIL_PENDING.set(q, pending);
  // 실패한 요청은 재시도할 수 있도록 제거합니다.
  pending.then(() => OMR_DETAIL_PENDING.delete(q), () => OMR_DETAIL_PENDING.delete(q));
  return pending;
}

/* [프론트엔드] OMR 답안지 및 결과 화면 렌더링 함수 (최적화 통합 버전) */
function renderOMRSheet(qs, history, isReviewMode, assignmentId) {
  CURRENT_QUIZ_DATA = qs;
  showPanel('quizPage');
  setTopTab('quiz');
  const quizPage = document.getElementById('quizPage');
  
  // 1. 과제 ID 설정 및 화면 초기화
  if(assignmentId) {
      quizPage.setAttribute('data-assign-id', assignmentId);
      CURRENT_ASSIGNMENT_ID = assignmentId; 
  } else {
      quizPage.removeAttribute('data-assign-id');
  }

  // [속도 최적화 1] 실제 화면(DOM)을 직접 건드리지 않고 가상 도화지(Fragment) 생성
  quizPage.innerHTML = '';
  const fragment = document.createDocumentFragment();

  // 진짜 오답과 빈칸 분리 계산
  let realWrongCount = 0;
  let blankCount = 0;
  qs.forEach(q => {
      const h = history ? history[q.qid] : null;
      if (h) {
          if (h.isCorrect === false) {
              if (String(h.selected || '').trim() !== '') realWrongCount++;
              else blankCount++;
          }
      } else {
          blankCount++; // history 기록 자체가 없으면 미입력(빈칸)
      }
  });

  const isRetry = history && Object.values(history).some(h => !h.empty);

  // 2. 헤더 생성 및 가상 도화지에 추가
  let headerHtml = '';
  if (isReviewMode) {
      headerHtml = `<h2 style="margin:0; color:#4b5563; font-size:20px;">📊 과제 결과 확인</h2>`;
  } else if (isRetry) {
      let msg = '';
      if (realWrongCount > 0 && blankCount > 0) msg = `<b style="color:#dc2626">${realWrongCount}문제</b>가 틀렸고, <b style="color:#d97706">${blankCount}문제</b>가 미입력 상태입니다.`;
      else if (realWrongCount > 0) msg = `<b style="color:#dc2626">${realWrongCount}문제</b>가 틀렸습니다.`;
      else if (blankCount > 0) msg = `<b style="color:#d97706">${blankCount}문제</b>가 미입력 상태입니다.`;
      else msg = '모두 정답입니다!';

      headerHtml = `<h2 style="margin:0; color:#4b5563; font-size:20px;">↺ 오답 및 미입력 풀기</h2>
                    <div style="font-size:14px; margin-top:5px;">
                        ${msg} 정답은 고정되며, <b>오답과 빈칸만 다시 풀 수 있습니다.</b>
                    </div>`;
  } else {
      headerHtml = `<h2 style="margin:0; color:#1e40af; font-size:20px;">📝 과제 답안 제출</h2>`;
  }

  const header = document.createElement('div');
  header.className = 'omr-header';
  header.innerHTML = headerHtml;
  fragment.appendChild(header);

  // 3. 문제들을 담을 OMR 컨테이너 생성
  const omrContainer = document.createElement('div');
  omrContainer.className = 'omr-container';

  // 4. 문제 루프 시작
  qs.forEach((q, idx) => {
    const card = document.createElement('div');
    card.className = 'question-card omr-card';
    card.setAttribute('data-idx', String(idx));

    const qHistory = history ? history[q.qid] : null;
    const isCorrect = qHistory && qHistory.isCorrect === true;
    
    if(isCorrect) {
        card.setAttribute('data-already-correct', 'true');
    }

    // [오류 해결] 변수 선언은 루프 상단에서 한 번만 수행
    const prevSelected = qHistory ? String(qHistory.selected || '').trim() : '';
    const isRealWrong = (qHistory && !isCorrect && prevSelected !== ''); 
    // 빈칸 때문에 올라간 서버 카운트 대신, 실제로 오답을 제출한 적이 있는지(wasWrong)를 체크하여 억울한 노란색 방지
    const isCorrected = isCorrect && (qHistory && qHistory.wasWrong === true);
    
    if (isRealWrong) {
        card.setAttribute('data-retrying', 'true');
        card.setAttribute('data-currently-wrong', 'true');
    }

    const currentWrongCount = qHistory ? (qHistory.wrongCount || 0) : 0;

    // 카드 상단 (번호 및 상태 표시)
    const headerFlex = document.createElement('div');
    headerFlex.className = 'q-header-flex';

    const title = document.createElement('div');
    title.className = 'question-title';
    if (isRealWrong) title.classList.add('wrong');
    else if (isCorrected) title.classList.add('corrected');
    else if (isCorrect) title.classList.add('correct');

    let titleColor = isCorrect ? (isCorrected ? "#d97706" : "#059669") : (isRealWrong ? "#dc2626" : "#2b6cb0"); 
    let statusTxt = isCorrect ? (isCorrected ? " (정답 ▲)" : " (정답 ✓)") : (isRealWrong ? " (오답 ✖)" : "");

    title.innerHTML = `<span style="font-size:18px; font-weight:bold; color:${titleColor};">${idx + 1}번${statusTxt}</span>`;
    title.style.margin = '0';
    headerFlex.appendChild(title);

    // 해설 버튼 (정답이거나 2회 이상 틀렸을 때 표시)
    const btnExp = document.createElement('button');
    btnExp.className = 'btn-exp';
    btnExp.type = 'button';
    btnExp.textContent = '해설';
    btnExp.style.display = (isCorrect || currentWrongCount >= 2) ? 'inline-block' : 'none';
    btnExp.setAttribute('data-exp-btn', idx);
    btnExp.onclick = async function() {
        if (this.disabled) return;
        this.disabled = true;
        try {
            await ensureOMRQuestionDetail(q);
            if (!card.isConnected || !CURRENT_QUIZ_DATA.includes(q)) return;
            if (!expBox.dataset.detailReady) {
                expBox.innerHTML = `<b style="color:#2b6cb0;">[해설]</b><br>${sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.')}`;
                expBox.dataset.detailReady = 'true';
            }
            toggleExplanation(this, idx);
        } catch (err) { showCustomAlert('해설 로드 실패: ' + err); }
        finally { this.disabled = false; }
    };
    
    // [신규] '온라인' 버튼 생성 및 아코디언 토글 (지연 로딩 및 스파게티 분리 적용)
    const btnOnline = document.createElement('button');
    btnOnline.className = 'btn-exp';
    btnOnline.type = 'button';
    btnOnline.textContent = '온라인';
    btnOnline.style.display = isReviewMode ? 'none' : 'inline-block';
    btnOnline.style.marginRight = '4px';
    btnOnline.style.background = '#4f46e5';
    btnOnline.onclick = async function() {
        if (this.disabled) return;
        const targetBox = card.querySelector('.online-box');
        if (targetBox.style.display !== 'none') {
            targetBox.style.display = 'none';
            return;
        }
        this.disabled = true;
        const previousText = this.textContent;
        this.textContent = '불러오는 중...';
        try {
            await ensureOMRQuestionDetail(q);
            if (!card.isConnected || !CURRENT_QUIZ_DATA.includes(q)) return;
            if (targetBox.innerHTML === '') targetBox.innerHTML = generateOnlineViewHtml(q);
            document.querySelectorAll('.online-box').forEach(box => box.style.display = 'none');
            targetBox.style.display = 'block';
        } catch (err) { showCustomAlert('문항 로드 실패: ' + err); }
        finally { this.disabled = false; this.textContent = previousText; }
    };
    headerFlex.appendChild(btnOnline);
    headerFlex.appendChild(btnExp);
    card.appendChild(headerFlex);

    const isDescriptive = String(q.type || '').includes('서술형');
    const interactionDisabled = (isRetry && isCorrect) || isReviewMode;

    // --- 문제 유형별 입력창/번호 생성 ---
    if (isDescriptive) {
        /* [서술형] */
        const answers = String(q.answer || '').split('||').map(s => s.trim());
        const userVals = prevSelected ? prevSelected.split('||') : [];
        const ansCount = answers.length;
        const descContainer = document.createElement('div');
        descContainer.className = 'desc-input-group';
        descContainer.style.marginTop = '10px';

        for(let i=0; i<ansCount; i++) {
            const row = document.createElement('div');
            row.style.marginBottom = '8px';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            
            let labelText = ansCount > 1 ? (['(A)', '(B)', '(C)', '(D)', '(E)'][i] || `(${i+1})`) : '';
            if (labelText) {
                const lbl = document.createElement('span');
                lbl.textContent = labelText;
                lbl.style.cssText = "font-weight:bold; margin-right:8px; color:#374151;";
                row.appendChild(lbl);
            }
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = 'omr_' + idx + '_' + i;
            input.className = 'desc-input';
            input.style.cssText = "flex:1; padding:8px; border:1px solid #d1d5db; border-radius:6px;";
            input.value = userVals[i] || '';

            if (interactionDisabled) {
                input.disabled = true;
                
                // 1. 학생 입력값과 정답 템플릿 준비
                const cleanInput = (userVals[i] || '').toLowerCase().trim().replace(/[.,?!]/g, '');
                const templates = answers[i].split(/\s*\/\s*(?![^\[]*\])/);
                
                // 2. 우리가 만든 compareWithBrackets 함수로 정답 여부 판별
                const isCorrectPart = templates.some(t => compareWithBrackets(cleanInput, t));

                if (isCorrectPart) {
                    // 정답일 때 (녹색/노란색)
                    input.style.backgroundColor = isCorrected ? '#fef9c3' : '#d1fae5'; 
                    input.style.borderColor = isCorrected ? '#eab308' : '#10b981'; 
                    input.style.color = isCorrected ? '#ca8a04' : '#065f46';
                } else if (userVals[i] || isReviewMode) {
                    // 오답일 때 (붉은색)
                    input.style.backgroundColor = '#fee2e2'; 
                    input.style.borderColor = '#ef4444'; 
                    input.style.color = '#991b1b';
                } else {
                    input.style.backgroundColor = '#f3f4f6';
                }
            }
            row.appendChild(input);
            descContainer.appendChild(row);
        }
        card.appendChild(descContainer);
    } else {
        /* [객관식 1~5번] */
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'omr-options-wrap';

        for(let i=1; i<=5; i++) {
            const val = String(i);
            const label = document.createElement('label');
            label.className = 'option omr-opt-label';
            const input = document.createElement('input');
            input.type = 'radio'; input.name = 'omr_' + idx; input.value = val; input.style.display = 'none';

            if (interactionDisabled) {
                input.disabled = true;
                label.classList.add('disabled');
                if (val === prevSelected) {
                    input.checked = true;
                    if (isCorrect) {
                        label.classList.add(isCorrected ? 'corrected' : 'correct');
                    } else {
                        label.classList.add('wrong');
                    }
                } else { label.classList.add('dimmed'); }
            }
            label.appendChild(input);
            label.appendChild(document.createTextNode(i));
            optionsDiv.appendChild(label);
        }
        card.appendChild(optionsDiv);
    }

  // [신규] 온라인 풀기 동적 영역 컨테이너 (내용은 클릭 시 지연 로딩됨)
    const onlineBox = document.createElement('div');
    onlineBox.className = 'online-box';
    onlineBox.style.display = 'none';
    onlineBox.style.marginTop = '15px';
    onlineBox.style.padding = '15px';
    onlineBox.style.background = '#f8fafc';
    onlineBox.style.border = '1px solid #cbd5e1';
    onlineBox.style.borderRadius = '8px';
    card.appendChild(onlineBox);

    // [해설 박스 추가]
    const expBox = document.createElement('div');
    expBox.className = 'explanation-box';
    if (!q._omrLite) {
        expBox.innerHTML = `<b style="color:#2b6cb0;">[해설]</b><br>${sanitizeInlineHTML(q.explanation || '해설 정보가 등록되지 않았습니다.')}`;
        expBox.dataset.detailReady = 'true';
    }
    card.appendChild(expBox);

    // [속도 최적화 2] 카드를 컨테이너에 추가 (아직 화면에 안 그림)
    omrContainer.appendChild(card);
  });
  
  // 5. 전체를 가상 도화지에 담기
  fragment.appendChild(omrContainer);

  // 6. [속도 최적화 3] 마지막에 딱 한 번 실제 화면(DOM)에 붙임
  quizPage.appendChild(fragment);

  // 이벤트 위임 설정: 리뷰 모드 여부와 상관없이 항상 부착
  omrContainer.addEventListener('click', function(e) {
      if (e.target && e.target.matches('input[type="radio"][name^="omr_"]')) {
          const radio = e.target;
          if (radio.disabled) return;
          const label = radio.closest('.omr-opt-label');
          const currentOptDiv = radio.closest('.omr-options-wrap');
          if (radio.dataset.wasChecked === 'true') {
              radio.checked = false;
              radio.dataset.wasChecked = 'false';
              if (label) label.classList.remove('active');
          } else {
              if (currentOptDiv) {
                  currentOptDiv.querySelectorAll('input[type="radio"]').forEach(r => r.dataset.wasChecked = 'false');
                  currentOptDiv.querySelectorAll('.omr-opt-label').forEach(lb => lb.classList.remove('active'));
              }
              radio.checked = true;
              radio.dataset.wasChecked = 'true';
              if (label) label.classList.add('active');
          }
      }
  });
  
  // 7. 하단 고정 버튼 바 업데이트
  updateOMRFooterButtons(isReviewMode, isRetry, realWrongCount, assignmentId, qs);

  // OMR 화면(과제 풀이) 진입 시 상단 단어장 버튼 노출
  const btnVocab = document.getElementById('btnOpenVocab');
  if (btnVocab) btnVocab.style.display = 'inline-flex';
}

/* [보조 함수] 하단 버튼 바 관리 */
function updateOMRFooterButtons(isReviewMode, isRetry, wrongCount, assignmentId, qs) {
  const footer = document.getElementById('globalFooter');
  footer.style.display = 'flex';
  footer.querySelector('.nav-btn-group').style.display = 'none';

  let btnContainer = document.getElementById('omrBtnContainer');
  if(!btnContainer) {
      btnContainer = document.createElement('div');
      btnContainer.id = 'omrBtnContainer';
      btnContainer.style.cssText = 'display:flex; gap:10px; width:100%; max-width:600px;';
      footer.appendChild(btnContainer);
  } else {
      btnContainer.innerHTML = '';
  }

  const createBtn = (id, text, bg, onClick) => {
      const b = document.createElement('button');
      b.id = id; b.className = 'btn btn-primary';
      b.textContent = text;
      b.style.cssText = `width:100%; flex:1; background:${bg};`;
      b.onclick = onClick;
      return b;
  };

  if (isReviewMode) {
      btnContainer.appendChild(createBtn('btnBackList', '목록으로', '#6b7280', () => routeTo('assignment')));
      if (wrongCount > 0) {
          btnContainer.appendChild(createBtn('btnRetryWrong', `↺ 오답 다시 풀기 (${wrongCount}개)`, '#d97706', () => {
             enterInstantRetryMode(assignmentId, qs);
          }));
      }
  } else {
      const submitText = isRetry ? '↺ 수정된 답안 제출' : '📝 제출 및 채점하기';
      const submitBg = isRetry ? '#4b5563' : '#2b6cb0';
      
      btnContainer.appendChild(createBtn('btnSubmitOMR', submitText, submitBg, function() {
          const btn = this;
          if (btn.disabled) return; // 중복 클릭 방지
          
          // 1. 제출 버튼 물리적 잠금 (시각적 피드백 제공)
          btn.disabled = true;
          btn.textContent = '⏳ 서버 저장 중...';
          btn.style.opacity = '0.7';
          btn.style.cursor = 'not-allowed';
          
          // 2. 백그라운드 채점 안내 메시지 출력
          showToast('⏳ 답안을 서버에 저장하고 채점 중입니다...', 'info');
          
          // 3. 채점 엔진 실행
          gradeAll(function(res) {
              // 4. 서버 저장 완료(1~2초 뒤) 시 성공 메시지 출력
              showToast('✅ 채점이 완료되었습니다. 오답을 다시 풀어보세요.', 'success');
              
              // 5. 무거운 화면 새로고침 없이, 그 자리에서 즉시 오답 잠금 해제 (연속 풀이 가능)
              enterInstantRetryMode(assignmentId, qs);
          });
      }));
  }
}

// [수정] 제출 안 한 문제와 고쳐서 맞은 문제를 제외하고 '계속 틀린 문제'로만 이동 (다 맞으면 최상단 이동)
function enterInstantRetryMode(assignmentId, qs) {
    CURRENT_ASSIGNMENT_ID = assignmentId;
    
    // 1. 헤더 변경 (OMR 모드인 경우)
    const header = document.querySelector('.omr-header');
    let currentWrong = 0;
    let currentBlank = 0;

    document.querySelectorAll('.question-card[data-idx]').forEach(card => {
        if (card.getAttribute('data-already-correct') === 'true') return;
        const title = card.querySelector('.question-title');
        const isStillWrong = (title && title.classList.contains('wrong')) || card.getAttribute('data-currently-wrong') === 'true';
        if (isStillWrong) currentWrong++;
        else currentBlank++;
    });

    if (header) {
        let msg = '';
        if (currentWrong > 0 && currentBlank > 0) msg = `<b style="color:#dc2626">${currentWrong}문제</b>가 틀렸고, <b style="color:#d97706">${currentBlank}문제</b>가 미입력 상태입니다.`;
        else if (currentWrong > 0) msg = `<b style="color:#dc2626">${currentWrong}문제</b>가 틀렸습니다.`;
        else if (currentBlank > 0) msg = `<b style="color:#d97706">${currentBlank}문제</b>가 미입력 상태입니다.`;
        else msg = '모두 정답입니다!';

        header.innerHTML = `<h2 style="margin:0; color:#4b5563; font-size:20px;">↺ 오답 및 미입력 풀기</h2>
                            <div style="font-size:14px; margin-top:5px;">
                                ${msg} 정답은 고정되며, <b>오답과 빈칸만 다시 풀 수 있습니다.</b>
                            </div>`;
    }

    // 2. 문제 카드 스캔 및 오답 잠금 해제
    const cards = document.querySelectorAll('.question-card[data-idx]');
    cards.forEach(card => {
        // 이미 맞은 문제(처음부터 맞은 문제 + 틀렸는데 고친 문제)는 이동 대상에서 완전 제외
        if (card.getAttribute('data-already-correct') === 'true') {
            card.removeAttribute('data-retrying');
            card.removeAttribute('data-currently-wrong');
            return;
        }

        const title = card.querySelector('.question-title');
        const isWrong = (title && title.classList.contains('wrong')) || card.getAttribute('data-currently-wrong') === 'true';
        
        if (isWrong) {
            // 계속 틀린 문제만 재시도 및 이동 타겟으로 설정
            card.removeAttribute('data-graded');
            card.setAttribute('data-retrying', 'true');
            card.setAttribute('data-currently-wrong', 'true');
            
            if (title) {
                title.classList.remove('wrong');
                title.innerHTML = title.innerHTML.replace(/\s*\(오답 ✖\)/g, '');
            }

            // 결과 바 숨김 (일반 온라인 모드용)
            const resultBar = card.querySelector('.result-bar');
            if (resultBar) resultBar.style.display = 'none';

            // 해설창 및 해설 버튼 숨김
            const expBox = card.querySelector('.explanation-box');
            if (expBox) expBox.style.display = 'none';
            
            const btnExp = card.querySelector('button[data-exp-btn]');
            if (btnExp) {
                btnExp.style.display = 'none';
                btnExp.textContent = '해설';
                btnExp.style.background = '#6b7280';
            }

            // --- 입력폼 초기화 및 물리적 잠금 해제 ---
            // 1) 서술형 입력창 강제 초기화
            const descWrap = card.querySelector('.desc-input-group');
            if (descWrap) descWrap.style.pointerEvents = 'auto';
            
            const descInputs = card.querySelectorAll('.desc-input');
            descInputs.forEach(inp => {
                inp.disabled = false;
                inp.value = '';
                inp.style.backgroundColor = '';
                inp.style.borderColor = '#d1d5db';
                inp.style.color = '';
                inp.style.pointerEvents = 'auto';
            });

            // 2) OMR 객관식 라디오
            const optWrap = card.querySelector('.omr-options-wrap');
            if (optWrap) optWrap.style.pointerEvents = 'auto';
            
            const omrLabels = card.querySelectorAll('.omr-opt-label');
            if (omrLabels.length > 0) {
                omrLabels.forEach(label => {
                    label.classList.remove('disabled', 'wrong', 'dimmed', 'active', 'correct', 'corrected');
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.disabled = false;
                        radio.checked = false;
                        radio.dataset.wasChecked = 'false';
                    }
                });
            }

            // 3) 일반 객관식 라디오 (온라인 풀기 모드용)
            const normalLabels = card.querySelectorAll('.option:not(.omr-opt-label)');
            if (normalLabels.length > 0) {
                normalLabels.forEach(label => {
                    label.style.background = '';
                    label.style.borderColor = '#d1d5db';
                    label.style.color = '';
                    label.style.opacity = '1';
                    const radio = label.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.disabled = false;
                        radio.checked = false;
                    }
                });
            }
        } else {
            // 제출을 안 한 문제(미입력 빈칸)는 이동 타겟에서 제외
            card.removeAttribute('data-retrying');
            card.removeAttribute('data-currently-wrong');
        }
    });

    // 3. 하단 버튼을 "수정된 답안 제출" 상태로 즉시 변경
    updateOMRFooterButtons(false, true, 0, assignmentId, qs);
    
    // 4. 스크롤 이동 제어
    // - 미입력(빈칸)과 맞은 문제(고쳐서 맞은 문제 포함)를 모두 제외하고, 가장 번호가 낮은 '틀린 문제' 1개를 탐색
    const firstStillWrongCard = document.querySelector('.question-card[data-currently-wrong="true"]:not([data-already-correct="true"])');
    
    if (firstStillWrongCard) {
        showToast('🔓 오답 잠금이 해제되었습니다. 틀린 문제를 다시 풀어보세요.', 'info');
        setTimeout(() => {
            const yOffset = firstStillWrongCard.getBoundingClientRect().top + window.scrollY - 120;
            window.scrollTo({ top: Math.max(0, yOffset), behavior: 'smooth' });
        }, 50);
    } else if (currentWrong === 0 && currentBlank === 0) {
        // 틀린 문제도 없고 빈칸도 없이 100% 다 맞혔을 때만 최상단으로 이동
        showToast('🎉 모든 문제를 맞혔습니다!', 'success');
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
    } else if (currentWrong === 0 && currentBlank > 0) {
        // 틀린 문제는 없으나 미입력(빈칸)이 남아있는 경우: 최상단으로 강제 이동하지 않고 현재 위치 유지
        showToast(`✏️ 채점이 반영되었습니다. 미입력된 ${currentBlank}문제를 마저 풀어보세요.`, 'info');
    }
}
function startRetryAssignment(id, qidsInput, isReviewMode) {
  CURRENT_ASSIGNMENT_ID = id;
  CURRENT_SESSION = id;

  // qidsInput이 없으면 캐시에서 찾아옴
  let qids = qidsInput;
  if (!qids && ASGN_CACHE[id]) {
      qids = ASGN_CACHE[id].qids;
  }

  if (typeof qids === 'string') {
      try { qids = JSON.parse(qids); } catch(e) { /* 에러무시 */ }
  }

  if (!qids) { showCustomAlert('문항 데이터를 불러올 수 없습니다.'); return; }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '과제 데이터를 불러오는 중...';
      loadEl.classList.add('active');
  }

  google.script.run.withSuccessHandler(res => {
      if(loadEl) loadEl.classList.remove('active');
      renderOMRSheet(res.qs, res.history, isReviewMode, id);
  }).withFailureHandler(err => {
      if(loadEl) loadEl.classList.remove('active');
      showCustomAlert('과제 로드 실패: ' + err);
  }).loadRetryData(CURRENT_USER, qids, id, 'omr'); 
}
