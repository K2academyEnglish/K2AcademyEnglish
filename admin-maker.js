// [추가] 중복출제 모달 제어
function openStudentSelectModal() {
    const primaryId = document.getElementById('targetStudentSelect').value;
    if(!primaryId) { 
        showCustomAlert('먼저 학생을 선택하고 [불러오기]를 눌러 기준 학생을 정해주세요.'); 
        return; 
    }

    const listDiv = document.getElementById('studentSelectList');
    listDiv.innerHTML = '';
    
    MANAGED_STUDENTS.forEach(student => {
        const isPrimary = (student.id === primaryId);
        // 이미 선택된 학생 리스트에 있거나 기준 학생이면 체크 표시
        const isAlreadySelected = SELECTED_MULTI_STUDENTS.some(s => s.id === student.id);
        
        const label = document.createElement('label');
        label.style.cssText = "display:flex; align-items:center; gap:10px; padding:10px; border:1px solid #eee; border-radius:8px; cursor:pointer;" + (isPrimary ? "background:#f3f4f6; cursor:not-allowed;" : "");
        
        label.innerHTML = `
            <input type="checkbox" class="student-select-chk" 
                value="${student.id}" data-name="${student.name}" 
                ${isPrimary || isAlreadySelected ? 'checked' : ''} 
                ${isPrimary ? 'disabled' : ''} 
                style="width:18px; height:18px;">
            <span style="font-size:15px; ${isPrimary ? 'font-weight:bold; color:#6b7280;' : ''}">
                ${student.name} (${student.id}) ${isPrimary ? '<span style="color:#2b6cb0; font-size:12px;">[기준 학생]</span>' : ''}
            </span>
        `;
        listDiv.appendChild(label);
    });
    document.getElementById('adminStudentSelectModal').style.display = 'flex';
}

// 2. [추가] 모달 닫기 함수 (이게 없어서 취소 버튼이 안 먹혔던 것임)
function closeStudentSelectModal() {
    const modal = document.getElementById('adminStudentSelectModal');
    if (modal) modal.style.display = 'none';
}

// 3. 중복출제 선택 완료 처리
function applyMultiStudentSelection() {
    // 체크된 모든 학생 가져오기 (기준 학생은 비활성화 상태여도 checked라면 포함됨)
    const chks = document.querySelectorAll('.student-select-chk:checked');
    
    SELECTED_MULTI_STUDENTS = Array.from(chks).map(cb => ({ 
        id: cb.value, 
        name: cb.getAttribute('data-name') 
    }));

    updateStudentDisplayUI(); // "외 n명" 표시 갱신
    closeStudentSelectModal(); // 모달 닫기
}

// 4. 하단 알림창 UI 갱신
function updateStudentDisplayUI() {
    const infoEl = document.getElementById('multiStudentInfo');
    const extraCountEl = document.getElementById('extraCount');
    const indicatorEl = document.getElementById('multiActiveIndicator');
    
    // 기준 학생 1명을 제외한 나머지 인원수 계산
    if (SELECTED_MULTI_STUDENTS.length > 1) {
        infoEl.style.display = 'inline-flex';
        extraCountEl.innerText = (SELECTED_MULTI_STUDENTS.length - 1);
        if (indicatorEl) indicatorEl.style.display = 'inline-block';
    } else {
        infoEl.style.display = 'none';
        if (indicatorEl) indicatorEl.style.display = 'none';
    }
}
// 5. 중복출제 취소 (기준 학생만 남기고 초기화)
function clearMultiStudent() {
    const selectEl = document.getElementById('targetStudentSelect');
    const primaryId = selectEl.value;
    const primaryName = selectEl.options[selectEl.selectedIndex].text.split(' (')[0];
    
    if(primaryId) {
        SELECTED_MULTI_STUDENTS = [{ id: primaryId, name: primaryName }];
    } else {
        SELECTED_MULTI_STUDENTS = [];
    }
    
    updateStudentDisplayUI();
    showCustomAlert('중복출제가 해제되었습니다.');
}

/* ===================== [신규] 관리자 Inventory 모드 로직 ===================== */

let INVENTORY_DATA = [];
let MAKER_CART = new Set(); // ★ [추가] 출제 바구니 (중복 방지용 Set)
let invSortCol = '';        // ★ [추가] 현재 정렬 기준 컬럼
let invSortAsc = true;      // ★ [추가] 오름차순 여부

// [추가] 테이블 정렬 제어 함수
function sortInventory(col) {
    if (invSortCol === col) {
        invSortAsc = !invSortAsc;
    } else {
        invSortCol = col;
        invSortAsc = true;
    }
    renderInventoryTable();
}

// [추가] 바구니 제어 함수
function addSelectedToCart() {
    const selectedCB = document.querySelectorAll('#invTbody .inv-check:checked:not(:disabled)');
    if (selectedCB.length === 0) {
        showCustomAlert('담을 문제가 선택되지 않았습니다.'); return;
    }
    selectedCB.forEach(cb => MAKER_CART.add(cb.value));
    updateCartUI();
    renderInventoryTable(); // 담긴 것은 비활성화 처리하기 위해 다시 그림
    showCustomAlert(`${selectedCB.length}개의 문제가 바구니에 추가되었습니다.\n(현재 총 ${MAKER_CART.size}개)`);
}

function clearCart() {
    if(MAKER_CART.size === 0) return;
    showCustomConfirm('바구니를 모두 비우시겠습니까?', () => {
        MAKER_CART.clear();
        updateCartUI();
        renderInventoryTable();
        
        // 지울 때 패널이 열려있으면 닫기
        const panel = document.getElementById('cartListPanel');
        if(panel && panel.classList.contains('open')) toggleCartList();
    });
}

// [신규] 바구니 패널 토글 함수
function toggleCartList() {
    const panel = document.getElementById('cartListPanel');
    const icon = document.getElementById('cartToggleIcon');
    
    if (panel.classList.contains('open')) {
        panel.classList.remove('open');
        if (icon) icon.innerText = '🔼'; // 패널 닫힐 때 위쪽 화살표
    } else {
        if(MAKER_CART.size === 0) {
            showCustomAlert('바구니가 비어 있습니다.');
            return;
        }
        panel.classList.add('open');
        if (icon) icon.innerText = '🔽'; // 패널 열릴 때 아래쪽 화살표
        renderCartTable();
    }
}

// [신규] 바구니 내부 리스트 렌더링
function renderCartTable() {
    const tbody = document.getElementById('cartTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (MAKER_CART.size === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:20px; text-align:center;">바구니가 비어 있습니다.</td></tr>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    let dragSrcEl = null;
    
    // MAKER_CART(Set)를 순회하며 INVENTORY_DATA에서 정보 찾기
    Array.from(MAKER_CART).forEach(qid => {
        const row = INVENTORY_DATA.find(r => r.qid === qid);
        if (!row) return;
        
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.setAttribute('draggable', 'true');
        tr.setAttribute('data-qid', row.qid);
        tr.style.cursor = 'grab';
        
        tr.addEventListener('dragstart', function(e) {
            dragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.style.opacity = '0.4';
        });
        tr.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            return false;
        });
        tr.addEventListener('dragenter', function(e) {
            this.style.background = '#f3f4f6';
        });
        tr.addEventListener('dragleave', function(e) {
            this.style.background = '';
        });
        tr.addEventListener('drop', function(e) {
            e.stopPropagation();
            this.style.background = '';
            if (dragSrcEl !== this) {
                tbody.insertBefore(dragSrcEl, Array.from(tbody.children).indexOf(dragSrcEl) < Array.from(tbody.children).indexOf(this) ? this.nextSibling : this);
                syncCartOrder();
            }
            return false;
        });
        tr.addEventListener('dragend', function(e) {
            this.style.opacity = '1';
        });

        let statusBadge = '';
        if (row.isSolved) {
            if (row.wrongCount > 0) statusBadge = '<span style="color:#d97706; font-weight:bold; font-size:11px;">[완료]</span>';
            else statusBadge = '<span style="color:#059669; font-weight:bold; font-size:11px;">[완료]</span>';
        } else {
            statusBadge = '<span style="color:#dc2626; font-weight:bold; font-size:11px;">[미완]</span>';
        }

        let wrongCountBadge = row.wrongCount > 0 
            ? `<span style="color:#dc2626; font-weight:bold; font-size:11px;">${row.wrongCount}회</span>` 
            : '<span style="color:#9ca3af; font-size:11px;">-</span>';

        const sourceStr = [row.grade, row.year, row.month, row.detail].filter(Boolean).join(' ');

        tr.innerHTML = `
          <td style="padding:8px; text-align:center;">
            <button onclick="removeFromCart('${row.qid}')" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">제거</button>
          </td>
          <td style="padding:8px; text-align:center;">${statusBadge}</td>
          <td style="padding:8px; text-align:center;">${wrongCountBadge}</td>
          <td style="padding:8px;">${sourceStr}</td>
          <td style="padding:8px;">${row.type || '-'}</td>
          <td style="padding:8px;">${row.difficulty || '-'}</td> 
          <td style="padding:8px; color:#666;">${row.number || String(row.qid).substring(0,5)+'...'}</td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
}

function syncCartOrder() {
    const rows = document.querySelectorAll('#cartTbody tr[data-qid]');
    const newCart = new Set();
    rows.forEach(tr => {
        newCart.add(tr.getAttribute('data-qid'));
    });
    MAKER_CART = newCart;
}

function sortCartList(type) {
    if (!type || MAKER_CART.size === 0) return;
    
    const arr = Array.from(MAKER_CART).map(qid => {
        return INVENTORY_DATA.find(r => r.qid === qid) || { qid: qid };
    });
    
    const parts = type.split('_');
    const col = parts[0];
    const isAsc = parts[1] === 'asc';
    
    arr.sort((a, b) => {
        let valA = '', valB = '';
        
        if (col === 'wrong') {
            valA = a.wrongCount || 0;
            valB = b.wrongCount || 0;
        } else if (col === 'source') {
            valA = [a.grade, a.year, a.month, a.detail].filter(Boolean).join(' ');
            valB = [b.grade, b.year, b.month, b.detail].filter(Boolean).join(' ');
        } else if (col === 'type') {
            valA = a.type || '';
            valB = b.type || '';
        } else if (col === 'difficulty') {
            valA = Number(a.difficulty) || 0;
            valB = Number(b.difficulty) || 0;
        } else if (col === 'number') {
            const numA = parseFloat(String(a.number).replace(/[^0-9.]/g, ''));
            const numB = parseFloat(String(b.number).replace(/[^0-9.]/g, ''));
            valA = isNaN(numA) ? (a.number || a.qid) : numA;
            valB = isNaN(numB) ? (b.number || b.qid) : numB;
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
            return isAsc ? valA - valB : valB - valA;
        } else {
            const strA = String(valA).toLowerCase();
            const strB = String(valB).toLowerCase();
            if (strA < strB) return isAsc ? -1 : 1;
            if (strA > strB) return isAsc ? 1 : -1;
            return 0;
        }
    });
    
    MAKER_CART.clear();
    arr.forEach(item => MAKER_CART.add(item.qid));
    renderCartTable();
}

// [신규] 바구니에서 개별 문항 제거
function removeFromCart(qid) {
    if (MAKER_CART.has(qid)) {
        MAKER_CART.delete(qid);
        updateCartUI();
        
        // 뒷 배경의 메인 테이블 체크박스 및 흐림 효과 해제
        renderInventoryTable(); 
        
        // 바구니 화면 즉시 갱신
        renderCartTable(); 
        
        // 마지막 문제 지웠으면 패널 닫기
        if (MAKER_CART.size === 0) toggleCartList();
    }
}

function updateCartUI() {
    const display = document.getElementById('cartCountDisplay');
    if(display) display.innerText = MAKER_CART.size;
}
// [신규] 관리자용 탭 상태 객체
const invSelState = {
    'm1': { years: new Set(), months: new Set(), details: new Set() },
    'm2': { years: new Set(), months: new Set(), details: new Set() },
    'm3': { years: new Set(), months: new Set(), details: new Set() },
    'h1': { years: new Set(), months: new Set(), details: new Set() },
    'h2': { years: new Set(), months: new Set(), details: new Set() },
    'h3': { years: new Set(), months: new Set(), details: new Set() },
    'common': { types: new Set(), difficulties: new Set() }
};

// 1. 문제 목록 불러오기 (서버 호출)
function loadInventoryData() {
  // ★ [수정] 드롭다운(Select)과 입력창(Input) 둘 다 확인
  const selectEl = document.getElementById('targetStudentSelect');
  const inputEl = document.getElementById('targetStudentName');
  
  // 값이 있는 쪽을 선택 (드롭다운 우선)
  const val = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');
  
  if(!val) { 
    showCustomAlert('학생을 선택하거나 이름을 입력해주세요.'); 
    return;
  }

  // [추가] 새 학생을 불러올 때 기존 설정(바구니, 제목, 필터) 모두 초기화
  MAKER_CART.clear();
  updateCartUI();
  const cartPanel = document.getElementById('cartListPanel');
  if (cartPanel && cartPanel.classList.contains('open')) toggleCartList();

  const titleInput = document.getElementById('customTitleInput');
  if (titleInput) titleInput.value = '';
  ['m1', 'm2', 'm3', 'h1', 'h2', 'h3'].forEach(g => {
      invSelState[g].years.clear();
      invSelState[g].months.clear();
      invSelState[g].details.clear();
  });
  invSelState.common.types.clear();
  invSelState.common.difficulties.clear();

  if (document.getElementById('chkInvExcludeSolved')) document.getElementById('chkInvExcludeSolved').checked = false;
  if (document.getElementById('invMinWrongCount')) document.getElementById('invMinWrongCount').value = '';
  if (document.getElementById('invNumberSearch')) document.getElementById('invNumberSearch').value = '';

  // ★ [추가] 선택된 학생의 이름 찾기 (ID로 목록 검색)
  let displayName = val;
  if (MANAGED_STUDENTS && Array.isArray(MANAGED_STUDENTS)) {
      const found = MANAGED_STUDENTS.find(s => s.id === val);
      if (found) displayName = found.name;
  }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
    // ★ [수정] 로딩 문구에 학생 이름 포함
    loadEl.querySelector('.loading-text').innerHTML = 
        `<span style="color:#2b6cb0; font-weight:bold; font-size:1.1em;">${displayName}</span> 학생의 기록을 불러오는 중...`;
    loadEl.classList.add('active');
  }

  google.script.run.withSuccessHandler(data => {
    if(loadEl) loadEl.classList.remove('active');
    
    INVENTORY_DATA = (data || []).filter(q => q && q.qid);
    
    if(INVENTORY_DATA.length === 0) { showCustomAlert('등록된 문제가 없습니다.'); return; }

    document.getElementById('inventorySection').style.display = 'flex';
    initInventoryFilters();
    renderInventoryTable();
    const recentPanel = document.getElementById('recentAssignmentsPanel');
    if (recentPanel && recentPanel.style.display !== 'none') {
        loadRecentAssignmentsForStudent(false);
    }
      
  }).withFailureHandler(err => {
    if(loadEl) loadEl.classList.remove('active');
    showCustomAlert('오류 발생: ' + err);
  }).getAdminQuestionInventory(val); // ★ 이름 대신 ID(또는 값) 전달
}

// [신규] 관리자 탭 전환
function switchInvGradeTab(gradeId) {
    const container = document.getElementById('filterContainer');
    if(!container) return;

    container.querySelectorAll('.grade-tab').forEach(el => {
        el.classList.toggle('active', el.getAttribute('onclick').includes(gradeId));
    });
    const panels = container.querySelectorAll('.grade-panel');
    panels.forEach(el => el.classList.remove('active'));
    
    const targetPanel = document.getElementById('inv_gp_' + gradeId);
    if(targetPanel) targetPanel.classList.add('active');
}

// 2. 필터 버튼 생성 (탭 대응)
function initInventoryFilters() {
  
  // 1. 모의고사 문제 유형 정렬 순서 정의 (원하시는 순서대로 배치)
  const TYPE_ORDER = [
      "목적", 
      "심경", "분위기", "심경, 분위기", "심경/분위기",
      "주장", 
      "함축", "함축의미", "밑줄", "함축 의미 추론",
      "요지", 
      "주제", 
      "제목", 
      "도표", 
      "설명문",
      "실용문", "안내문", "일치", "불일치", "내용일치","지칭",
      "어법", "어법성 판단",
      "어휘", "낱말", "문맥상 낱말","영영풀이",
      "빈칸", "빈칸추론", "빈칸 추론",
      "흐름", "무관", "무관한 문장", 
      "순서", "글의 순서", "이어질 글의 순서",
      "삽입", "문장 삽입", "문장 넣기",
      "요약", "요약문", "문단 요약",
      "장문(41~42)", "장문1", "41~42",
      "장문(43~45)", "장문2", "43~45","복합문단",
      "서술형"
  ];

  // 2. 정렬 헬퍼 함수
  const sortByType = (a, b) => {
      // 입력된 유형(a, b)이 정렬 목록의 어느 키워드를 포함하는지 찾아서 인덱스 반환
      // 예: "빈칸 추론" 데이터는 "빈칸" 키워드 순서를 따라감
      let idxA = TYPE_ORDER.findIndex(key => String(a).includes(key));
      let idxB = TYPE_ORDER.findIndex(key => String(b).includes(key));

      // 목록에 없는 유형은 맨 뒤(999)로 보냄
      if (idxA === -1) idxA = 999;
      if (idxB === -1) idxB = 999;

      // 순서가 다르면 순서대로, 같으면(혹은 둘 다 없으면) 가나다순
      if (idxA !== idxB) return idxA - idxB;
      return String(a).localeCompare(String(b));
  };

  // 3. 데이터 추출 및 정렬
  const distinct = (key) => [...new Set(INVENTORY_DATA.map(x => x[key]).filter(Boolean))].sort();
  
  // 관리자용 칩 렌더러 (콜백 함수 지원 추가)
  const renderInvChipsV2 = (containerId, items, category, stateObj, onChangeCallback) => {
      const box = document.getElementById(containerId);
      if(!box) return;
      box.innerHTML = '';
      
      const allBtn = document.createElement('span');
      allBtn.className = 'inv-chip';
      allBtn.textContent = '전체';
      const currentSet = stateObj[category];
      
      const updateAll = () => {
           const isAll = items.length > 0 && currentSet.size === items.length;
           allBtn.classList.toggle('selected', isAll);
      };
      
      allBtn.onclick = () => {
        if(allBtn.classList.contains('selected')) {
            currentSet.clear();
        } else {
            const excludeDescriptive = document.getElementById('chkExcludeDescriptive') ? document.getElementById('chkExcludeDescriptive').checked : false;
            
            items.forEach(i => {
                // [추가] 유형(Types) 필터이면서 서술형 제외가 체크된 경우, '서술형'은 건너뜀
                if (category === 'types' && excludeDescriptive && String(i).includes('서술형')) {
                    return; 
                }
                currentSet.add(i);
            });
        }
        updateAll();
        renderInvChipsV2(containerId, items, category, stateObj, onChangeCallback); 
        if(onChangeCallback) onChangeCallback();
        else renderInventoryTable();
    };
      box.appendChild(allBtn);

      items.forEach(item => {
          const chip = document.createElement('span');
          chip.className = 'inv-chip';
          if(currentSet.has(item)) chip.classList.add('selected');
          chip.textContent = item;
          
          chip.onclick = () => {
              if(currentSet.has(item)) currentSet.delete(item);
              else currentSet.add(item);
              
              chip.classList.toggle('selected', currentSet.has(item));
              updateAll();
              if(onChangeCallback) onChangeCallback();
              else renderInventoryTable();
          };
          box.appendChild(chip);
      });
      updateAll();
  };

  const allYears = distinct('year');
  const allMonths = distinct('month');

  // ★ [핵심] 유형(Type)은 위에서 만든 사용자 지정 순서(sortByType)로 정렬
  const allTypes = [...new Set(INVENTORY_DATA.map(x => x.type).filter(Boolean))].sort(sortByType);
  
  // ★ [수정] 연쇄 갱신(Cascading) 로직 - 초기 6개 학년 루프 시 중복 렌더링 방지(skipRender 추가)
  const updateCascadingFilters = (gId, gName, skipRender = false) => {
      const state = invSelState[gId];
      const gradeData = INVENTORY_DATA.filter(x => x.grade === gName);

      // 1. Year: 해당 학년 전체 기준
      const gYears = [...new Set(gradeData.map(x => String(x.year)).filter(Boolean))].sort();

      // 2. Month: 선택된 Year 기준
      let monthData = gradeData;
      if (state.years.size > 0) {
          monthData = monthData.filter(x => state.years.has(String(x.year)));
      }
      const gMonths = [...new Set(monthData.map(x => x.month).filter(Boolean))].sort();

      // 유효하지 않은 Month 선택 해제 (안전장치)
      const validMonths = new Set(gMonths);
      for (let m of state.months) {
          if (!validMonths.has(m)) state.months.delete(m);
      }

      // 3. Detail: 선택된 Year, Month 기준
      let detailData = monthData;
      if (state.months.size > 0) {
          detailData = detailData.filter(x => state.months.has(x.month));
      }
      const gDetails = [...new Set(detailData.map(x => x.detail).filter(Boolean))].sort();

      // 유효하지 않은 Detail 선택 해제 (안전장치)
      const validDetails = new Set(gDetails);
      for (let d of state.details) {
          if (!validDetails.has(d)) state.details.delete(d);
      }

      // 칩 렌더링 및 콜백 연동
      renderInvChipsV2('invYearChips_' + gId, gYears, 'years', state, () => updateCascadingFilters(gId, gName, false));
      renderInvChipsV2('invMonthChips_' + gId, gMonths, 'months', state, () => updateCascadingFilters(gId, gName, false));
      renderInvChipsV2('invDetailChips_' + gId, gDetails, 'details', state, () => renderInventoryTable());

      // 초기 루프가 아닐 때만 테이블 갱신
      if (!skipRender) renderInventoryTable();
  };

  [ 
    {id: 'm1', name: '중1'}, {id: 'm2', name: '중2'}, {id: 'm3', name: '중3'}, 
    {id: 'h1', name: '고1'}, {id: 'h2', name: '고2'}, {id: 'h3', name: '고3'} 
  ].forEach(g => {
      updateCascadingFilters(g.id, g.name, true); // 초기 루프에서는 렌더링 생략
  });

  renderInvChipsV2('invTypeChips', allTypes, 'types', invSelState['common']);

  // ★ 난이도는 숫자 크기대로 정렬 (1 -> 2 -> 3...)
  const allDiffs = [...new Set(INVENTORY_DATA.map(x => x.difficulty).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b));

  renderInvChipsV2('invDiffChips', allDiffs, 'difficulties', invSelState['common']);
}

// 3. 테이블 렌더링 (OR 필터 적용)
function renderInventoryTable() {
  const tbody = document.getElementById('invTbody');

  // [추가] 화면을 지우기 전, 현재 체크되어 있는 문제의 qid를 임시 메모리(Set)에 백업할 수 있습니다.
  const tempChecked = new Set();
  document.querySelectorAll('#invTbody .inv-check:checked:not(:disabled)').forEach(cb => {
      tempChecked.add(cb.value);
  });

  tbody.innerHTML = '';

  // ★ [추가] 헤더 정렬 아이콘 갱신
  ['status', 'assign', 'wrong', 'source', 'type', 'difficulty', 'number'].forEach(col => {
      const span = document.getElementById('sort_' + col);
      if (span) {
          span.innerHTML = (invSortCol === col) ? (invSortAsc ? '▲' : '▼') : '<span style="opacity:0.3">↕</span>';
          span.style.color = (invSortCol === col) ? '#2b6cb0' : 'inherit';
      }
  });

  // 1. 현재 활성화된 필터가 있는지 확인 (조건부 렌더링 핵심)
  let hasAnyFilter = false;
  
  // (1) 학년별 탭 조건 확인
  const activeGrades = [];
  [ 
    {id: 'm1', name: '중1'}, {id: 'm2', name: '중2'}, {id: 'm3', name: '중3'}, 
    {id: 'h1', name: '고1'}, {id: 'h2', name: '고2'}, {id: 'h3', name: '고3'} 
  ].forEach(g => {
      if (invSelState[g.id].years.size > 0 || invSelState[g.id].months.size > 0 || invSelState[g.id].details.size > 0) {
          hasAnyFilter = true;
          activeGrades.push(g.name);
      }
  });

  // (2) 공통 조건(유형, 난이도) 확인
  if (invSelState.common.types.size > 0 || invSelState.common.difficulties.size > 0) {
      hasAnyFilter = true;
  }

  // ★ 필터가 하나도 없으면 그리지 않고 안내 문구만 표시 (속도 최적화)
  if (!hasAnyFilter) {
    const tr = document.createElement('tr');
    // colspan을 9로 수정 (상태, 최근풀이, 배부, 오답, 출처, 유형, 난이도, 번호, 체크박스 총 9칸)
    // height: 50vh를 주어 화면 높이의 절반 정도 공간을 확보하고 세로 중앙 정렬을 적용합니다.
    tr.innerHTML = `
      <td colspan="9" style="height: 50vh; vertical-align: middle; text-align: center; color: #6b7280; border: none;">
          <div style="display: inline-block; transform: translateY(-20px);">
              <div style="font-size: 40px; margin-bottom: 15px;">🔍</div>
              <b style="font-size: 18px; color: #374151;">원하는 조건을 선택해주세요.</b><br>
              <div style="font-size: 14px; margin-top: 10px; line-height: 1.6;">
                  왼쪽 사이드바에서 학년, 년도, 유형 등을 클릭하면<br>
                  조건에 맞는 문제 목록이 여기에 표시됩니다.
              </div>
          </div>
      </td>`;
    tbody.appendChild(tr);
    updateInvCount();
    return;
}

 // 2. 필터링 로직 (조건이 있을 때만 수행)
  const hasGradeFilter = activeGrades.length > 0;
  const numQuery = (document.getElementById('invNumberSearch') ? document.getElementById('invNumberSearch').value.trim().toLowerCase() : '');
  const excludeSolved = document.getElementById('chkInvExcludeSolved') ? document.getElementById('chkInvExcludeSolved').checked : false;
  const excludeDescriptive = document.getElementById('chkExcludeDescriptive') ? document.getElementById('chkExcludeDescriptive').checked : false;
 // ★ [추가] 체크박스 상태 가져오기
  const minWrongStr = document.getElementById('invMinWrongCount') ? document.getElementById('invMinWrongCount').value : '0';
  const minWrong = parseInt(minWrongStr, 10) || 0;
  
  const filtered = INVENTORY_DATA.filter(row => {
    // ★ [추가] '안 푼 문제만' 체크 시, 완료(isSolved)된 문제는 제외
    if (excludeSolved && row.isSolved) return false;
    if (excludeDescriptive && String(row.type).includes('서술형')) return false;

    // [추가] 오답 횟수 필터 (입력된 횟수보다 실제 틀린 횟수가 적으면 제외)
    if (minWrong > 0 && (row.wrongCount || 0) < minWrong) return false;

    // [추가] 번호 검색 필터 적용 (쉼표 및 공백으로 여러 개 검색 가능)
    if (numQuery) {
        const queries = numQuery.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
        const matchNum = queries.some(q => {
            const rawNum = String(row.number || '').toLowerCase();
            
            // 1. 최신 ID 형식 (예: h1_25_03_21 또는 h1_25_03_21_001)
            if (rawNum.includes('_')) {
                const parts = rawNum.split('_');
                if (parts.length >= 4) {
                    const baseNum = parts[3]; // 네 번째 값(원본 문항 번호)
                    
                    // 사용자가 '21'만 검색 -> 원본 및 해당 번호의 변형문제 모두 일치
                    if (baseNum === q) return true;
                    // 사용자가 '21_001'처럼 변형 번호까지 지정해서 검색 -> 정확히 일치
                    if (parts.slice(3).join('_') === q) return true; 
                }
            }
            
            // 2. 언더바가 없는 구형 데이터이거나 예외 규격일 경우 (완전 일치로 엄격하게 검사)
            return rawNum === q;
        });
        
        if (!matchNum) return false;
    }
    // 공통 필터 체크
    if(invSelState.common.types.size && !invSelState.common.types.has(row.type)) return false;
    if(invSelState.common.difficulties.size && !invSelState.common.difficulties.has(row.difficulty)) return false;

    // 학년별 필터 체크
    if(hasGradeFilter) {
        if(!activeGrades.includes(row.grade)) return false;
        
        let gradeId = row.grade;
        if(row.grade && row.grade.startsWith('중')) {
            gradeId = 'm' + row.grade.replace('중', '');
        } else if(row.grade && row.grade.startsWith('고')) {
            gradeId = 'h' + row.grade.replace('고', '');
        }
        
        const s = invSelState[gradeId];
        if(s && s.years.size && !s.years.has(String(row.year))) return false;
        if(s && s.months.size && !s.months.has(row.month)) return false;
        if(s && s.details.size && !s.details.has(row.detail)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="7" style="padding:20px; text-align:center;">조건에 맞는 문제가 없습니다.</td>`;
      tbody.appendChild(tr);
      updateInvCount();
      return;
  }

  // ★ [추가] 렌더링 전 필터링된 배열 정렬 로직 적용
  if (invSortCol) {
      filtered.sort((a, b) => {
          let valA = '', valB = '';
          
          if (invSortCol === 'status') {
              valA = a.isSolved ? (a.wrongCount > 0 ? 1 : 2) : 0;
              valB = b.isSolved ? (b.wrongCount > 0 ? 1 : 2) : 0;
          } else if (invSortCol === 'lastTs') {
          // [추가] 날짜 비교 로직: 날짜가 없으면 가장 뒤로 보냄
          valA = a.lastTs ? new Date(a.lastTs).getTime() : 0;
          valB = b.lastTs ? new Date(b.lastTs).getTime() : 0;
          } else if (invSortCol === 'assign') {
              valA = a.assignCount || 0;
              valB = b.assignCount || 0;
          } else if (invSortCol === 'wrong') {
              valA = a.wrongCount || 0;
              valB = b.wrongCount || 0;
          } else if (invSortCol === 'source') {
              valA = [a.grade, a.year, a.month, a.detail].filter(Boolean).join(' ');
              valB = [b.grade, b.year, b.month, b.detail].filter(Boolean).join(' ');
          } else if (invSortCol === 'type') {
              valA = a.type || '';
              valB = b.type || '';
          } else if (invSortCol === 'difficulty') {
              valA = Number(a.difficulty) || 0;
              valB = Number(b.difficulty) || 0;
          } else if (invSortCol === 'number') {
              // 번호는 가급적 숫자 크기 비교를 유도, 실패 시 문자열 비교
              const numA = parseFloat(String(a.number).replace(/[^0-9.]/g, ''));
              const numB = parseFloat(String(b.number).replace(/[^0-9.]/g, ''));
              valA = isNaN(numA) ? (a.number || a.qid) : numA;
              valB = isNaN(numB) ? (b.number || b.qid) : numB;
          }

          if (typeof valA === 'number' && typeof valB === 'number') {
              return invSortAsc ? valA - valB : valB - valA;
          } else {
              const strA = String(valA).toLowerCase();
              const strB = String(valB).toLowerCase();
              if (strA < strB) return invSortAsc ? -1 : 1;
              if (strA > strB) return invSortAsc ? 1 : -1;
              return 0;
          }
      });
  }

  // 3. 고속 렌더링 (DocumentFragment 사용)
  // 메모리에 가상의 공간을 만들어 다 붙인 뒤, 화면에는 한 번만 전송합니다.
  const fragment = document.createDocumentFragment();

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';
    
    // [수정] 오답 횟수를 기반으로 3가지 색상 분기 처리
    let statusBadge = '';
    if (row.isSolved) {
        if (row.wrongCount > 0) {
            statusBadge = '<span style="color:#d97706; font-weight:bold; font-size:11px;">[완료]</span>'; // 오답 이력 있음 (노란/주황색)
        } else {
            statusBadge = '<span style="color:#059669; font-weight:bold; font-size:11px;">[완료]</span>'; // 한 번에 맞힘 (녹색)
        }
    } else {
        statusBadge = '<span style="color:#dc2626; font-weight:bold; font-size:11px;">[미완]</span>'; // 미완료 (빨간색)
    }

    // [추가] 오답 횟수 뱃지 (0회면 '-' 처리)
    let wrongCountBadge = row.wrongCount > 0 
        ? `<span style="color:#dc2626; font-weight:bold; font-size:11px;">${row.wrongCount}회</span>` 
        : '<span style="color:#9ca3af; font-size:11px;">-</span>';

    // [신규] 배부 횟수 뱃지 (파란색)
    let assignCountBadge = (row.assignCount && row.assignCount > 0)
        ? `<span style="color:#2563eb; font-weight:bold; font-size:11px;">${row.assignCount}회</span>`
        : '<span style="color:#9ca3af; font-size:11px;">-</span>';
    
    const sourceStr = [row.grade, row.year, row.month, row.detail].filter(Boolean).join(' ');

    const isAlreadyInCart = MAKER_CART.has(row.qid);
    const isTempChecked = tempChecked.has(row.qid); // [추가] 백업된 체크 상태를 확인하는 과정이 포함될 수 있습니다.
    
    // [수정] 비활성화(disabled) 속성과 체크(checked) 속성을 분리하여 적용합니다.
    const disableAttr = isAlreadyInCart ? 'disabled' : '';
    const checkedAttr = (isAlreadyInCart || isTempChecked) ? 'checked' : '';
    const opacityStyle = isAlreadyInCart ? 'opacity: 0.5; background: #f3f4f6;' : '';

    tr.style.cssText = `border-bottom: 1px solid #eee; ${opacityStyle}`;
    tr.innerHTML = `
      <td style="padding:8px; text-align:center;">
        <input type="checkbox" class="inv-check" 
               value="${row.qid}" 
               data-solved="${row.isSolved}"
               data-group="${row.groupHash}"
               ${disableAttr} ${checkedAttr}> 
      </td>
      <td style="padding:8px; text-align:center;">${statusBadge}</td>
      <td style="padding:8px; text-align:center; font-size:11px; color:#6b7280;">${row.lastTs || '-'}</td>
      <td style="padding:8px; text-align:center;">${assignCountBadge}</td>
      <td style="padding:8px; text-align:center;">${wrongCountBadge}</td>
      <td style="padding:8px;">${sourceStr}</td>
      <td style="padding:8px;">${row.type || '-'}</td>
      <td style="padding:8px;">${row.difficulty || '-'}</td> 
      <td style="padding:8px; color:#666;">${row.number || row.qid.substring(0,5)+'...'}</td>
    `;
    
    tr.addEventListener('click', (e) => {
      let targetCheckbox = e.target;
      if (e.target.tagName !== 'INPUT') {
          targetCheckbox = tr.querySelector('.inv-check');
          targetCheckbox.checked = !targetCheckbox.checked;
      }
      
      const groupKey = targetCheckbox.getAttribute('data-group');
      const isChecked = targetCheckbox.checked;

      if (groupKey) {
          const siblings = document.querySelectorAll(`.inv-check[data-group="${groupKey}"]`);
          siblings.forEach(sib => {
              sib.checked = isChecked; 
          });
      }
      updateInvCount();
    });
    
    fragment.appendChild(tr); // 가상 메모리에 추가 (렉 없음)
  });

  tbody.appendChild(fragment); // 실제 화면 갱신 (딱 1번 수행)
  updateInvCount();
}

// 4. 개수 업데이트 및 선택 로직
function updateInvCount() {
  const count = document.querySelectorAll('.inv-check:checked').length;
  document.getElementById('invSelectedCount').innerText = count;
}

// 버튼 이벤트 바인딩 함수 (initUI에서 호출)
function bindInventoryEvents() {
    // 1. 전체 목록 불러오기 버튼
    const btnLoad = document.getElementById('btnLoadInventory');
    if(btnLoad) btnLoad.onclick = loadInventoryData;

    // 2. 테이블 헤더 체크박스 (전체 선택/해제)
    const chkAll = document.getElementById('invCheckAll');
    if(chkAll) chkAll.onchange = function(e) {
        const isChecked = e.target.checked;
        document.querySelectorAll('#invTbody .inv-check').forEach(cb => cb.checked = isChecked);
        updateInvCount();
    };

    // 3. 테이블 내부 체크박스 변경 감지
    const tbody = document.getElementById('invTbody');
    if(tbody) tbody.onchange = function(e) {
        if(e.target.classList.contains('inv-check')) updateInvCount();
    };

    // 4. [단순화됨] 랜덤 선택 로직 (지문 그룹 유지하며 N개 선택)
    const btnRandom = document.getElementById('btnInvRandom');
    if(btnRandom) btnRandom.onclick = function() {
        // 입력된 개수 가져오기
        const n = parseInt(document.getElementById('invRandomCount').value || 20);
        
        const onlyUnsolved = document.getElementById('chkInvExcludeSolved').checked;
        const allBoxes = Array.from(document.querySelectorAll('#invTbody .inv-check'));
        
        // 일단 모두 해제
        allBoxes.forEach(cb => cb.checked = false);

        // 후보군 필터링 (안 푼 문제만 보기 체크 시)
        let candidates = allBoxes;
        if(onlyUnsolved) {
            candidates = candidates.filter(cb => cb.getAttribute('data-solved') === 'false');
        }

        if(candidates.length === 0) {
            showCustomAlert(onlyUnsolved ? '조건에 맞는(안 푼) 문제가 없습니다.' : '목록에 문제가 없습니다.');
            updateInvCount();
            return;
        }

        // --- 그룹(지문) 단위 묶기 ---
        const groups = {};
        candidates.forEach(cb => {
            // 그룹ID가 있으면 그걸 쓰고, 없으면 자기 자신 ID 사용
            const gKey = cb.getAttribute('data-group') || cb.value; 
            if(!groups[gKey]) groups[gKey] = [];
            groups[gKey].push(cb);
        });

        // --- 셔플 및 선택 ---
        const keys = Object.keys(groups);
        keys.sort(() => Math.random() - 0.5); // 무작위 섞기

        let currentCount = 0;
        for(const k of keys){
            if(currentCount >= n) break; // 목표 개수 채우면 중단
            
            // 그룹 통째로 체크
            groups[k].forEach(cb => cb.checked = true);
            currentCount += groups[k].length;
        }
        
        updateInvCount();
    };
}

/* ===================== [신규] 관리자 페이지 탭 및 기록 로직 ===================== */

// 2. 기록 데이터 불러오기
let ADMIN_HISTORY_CACHE = [];

// 2-1. 데이터 불러오기 (서버 통신) - '조회' 버튼 클릭 시에만 실행
function loadAdminHistory() {
  const tbody = document.getElementById('historyTbody');
  // 클라이언트 단에서 실시간 필터링하므로, 서버 호출 시에는 전체 기록을 불러오도록 빈 문자열을 넘깁니다.
  const searchName = ''; 
  const loadAll = document.getElementById('chkLoadAll') ? document.getElementById('chkLoadAll').checked : false;
  
  // 로딩 중임을 시각적으로 표시 (GS 응답 전까지)
  tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#2b6cb0; font-weight:bold;">📋 배부 기록을 서버에서 가져오는 중입니다...</td></tr>';
  
  google.script.run.withSuccessHandler(list => {
     ADMIN_HISTORY_CACHE = list || [];
     renderHistoryUI();
     if(ADMIN_HISTORY_CACHE.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#6b7280;">데이터가 없습니다.</td></tr>';
     }
  }).withFailureHandler(err => {
     tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#dc2626;">❌ 데이터를 불러오지 못했습니다: ' + err + '</td></tr>';
  }).getAllAssignmentsForAdmin(searchName, loadAll);
}

// 2-2. 화면 그리기 (서버 통신 X) - 체크박스 변경 시 즉시 실행
function renderHistoryUI() {
  const tbody = document.getElementById('historyTbody');
  
  // 필터 상태 읽기
  const searchName = (document.getElementById('historySearchName').value || '').trim().toLowerCase();
  const onlyWeekly = document.getElementById('chkOnlyWeekly') ? document.getElementById('chkOnlyWeekly').checked : false;
  const onlyInProgress = document.getElementById('chkOnlyInProgress') ? document.getElementById('chkOnlyInProgress').checked : false;
  const onlyUnfinished = document.getElementById('chkOnlyUnfinished') ? document.getElementById('chkOnlyUnfinished').checked : false;
  
  tbody.innerHTML = '';
  
  if (!ADMIN_HISTORY_CACHE || !ADMIN_HISTORY_CACHE.length) {
     tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">기록이 없습니다.</td></tr>';
     return;
  }

  // 필터링 적용
  let listToRender = ADMIN_HISTORY_CACHE;

  // 1. 이름 검색 필터 (실시간 적용)
  if (searchName) {
      listToRender = listToRender.filter(row => 
          String(row.student || '').toLowerCase().includes(searchName)
      );
  }

  // 2. 주간평가 필터 (체크 시 주간평가만 남김)
  if (onlyWeekly) {
      listToRender = listToRender.filter(row => row.isWeekly);
  }

  // 3. 상태 필터 (진행 중 또는 미완료 체크 시 해당 상태들만 남김)
  // 두 개 다 체크하면 "진행 중 + 미완료" 둘 다 보여줍니다.
  if (onlyInProgress || onlyUnfinished) {
      listToRender = listToRender.filter(row => {
          if (onlyInProgress && row.displayStatus === "진행 중") return true;
          if (onlyUnfinished && row.displayStatus === "미완료") return true;
          return false;
      });
  }

  if (listToRender.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">조건에 맞는 기록이 없습니다.</td></tr>';
      return;
  }

  // 렌더링 시작
  const fragment = document.createDocumentFragment();
  listToRender.forEach(row => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #eee';

    let statusText = "";
    let statusColor = "#374151";

    if (row.displayStatus === "미완료") {
      statusText = `미완료(0/${row.totalCount})`;
      statusColor = "#dc2626";
    } else if (row.displayStatus === "진행 중") {
      statusText = `진행 중(${row.answeredCount}/${row.totalCount})`;
      statusColor = "#d97706";
    } else {
      statusText = `완료(${row.strictCorrectCount}/${row.totalCount})`;
      statusColor = "#059669";
    }

    let reportBtnHtml = '';
    if (row.isWeekly) {
        reportBtnHtml = `<button class="btn-report" style="padding:4px 6px; font-size:12px; border:1px solid #7c3aed; background:#fff; color:#7c3aed; border-radius:4px; cursor:pointer; white-space:nowrap;">📈 리포트</button>`;
    }

    tr.innerHTML = `
       <td style="padding:10px; text-align:center; color:#6b7280; font-size:12px;">${row.date}</td>
       <td style="padding:10px; font-weight:bold; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${row.student}</td>
       <td style="padding:10px; color:#4b5563; text-align:left; word-break:break-all; line-height:1.4;">${sanitizeInlineHTML(row.title)}</td>
       <td style="padding:10px; text-align:center;">${row.totalCount}</td>
       <td style="padding:10px; text-align:center; color:${statusColor}; font-weight:bold; font-size:12px; white-space:nowrap;">
         ${statusText}
       </td>
       <td style="padding:10px; text-align:center;">
         <div style="display:flex; gap:4px; justify-content:center; align-items:center;">
            ${reportBtnHtml}
            <button class="btn-detail" style="padding:4px 6px; font-size:12px; border:1px solid #2b6cb0; background:#fff; color:#2b6cb0; border-radius:4px; cursor:pointer;">📊 결과</button>
            <button class="btn-reprint" style="padding:4px 6px; font-size:12px; border:1px solid #2b6cb0; background:#fff; color:#2b6cb0; border-radius:4px; cursor:pointer;">🖨️ 재출력</button>
            <button class="btn-reprint-wrong" style="padding:4px 6px; font-size:12px; border:1px solid #dc2626; background:#fff; color:#dc2626; border-radius:4px; cursor:pointer;">오답만</button>
         </div>
       </td>
    `;
        
    tr.querySelector('.btn-detail').onclick = () => showAssignmentDetail(row.studentId, row.qids, row.title, row.id);
    if (row.isWeekly) {
        tr.querySelector('.btn-report').onclick = () => openWeeklyReport(row.id);
    }
    tr.querySelector('.btn-reprint').onclick = () => doReprintAssignment(row.student, row.qids, row.title, row.date, row.studentId);
    tr.querySelector('.btn-reprint-wrong').onclick = () => doReprintWrongOnly(row.student, row.qids, row.title, row.date, row.studentId, row.id);    
    fragment.appendChild(tr);
  });
  tbody.appendChild(fragment);
}

// 3. 재출력 기능 (기존 renderQuestionsForPrint 재사용)
function doReprintAssignment(studentName, qidsStr, originalTitle, originalDate, studentId) {
  let qids = [];
  try { qids = JSON.parse(qidsStr); } catch(e) { showCustomAlert('데이터 오류'); return; }
  
  if(!qids || !qids.length) return;

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
     loadEl.querySelector('.loading-text').innerHTML = '문제지를 다시 생성 중...';
     loadEl.classList.add('active');
  }

  google.script.run.withSuccessHandler(qs => {
     if(loadEl) loadEl.classList.remove('active');
     
     const finalTitle = originalTitle || (studentName + ' 학생의 과제');
     
     // ★ [여기가 중요] 넘겨받은 originalDate를 인쇄 함수에 전달
     const printName = studentId ? `${studentName}(${studentId})` : studentName;
     renderQuestionsForPrint(qs, finalTitle, originalDate, printName);

  }).withFailureHandler(err => {
     if(loadEl) loadEl.classList.remove('active');
     showCustomAlert('문제 로드 실패: ' + err);
  }).getQuestionsByQids(qids);
}

// 3-2. 오답만 출력 기능 (현재 오답 + 고쳐서 맞힌 문항 필터링)
function doReprintWrongOnly(studentName, qidsStr, originalTitle, originalDate, studentId, assignmentId) {
  let qids = [];
  if (Array.isArray(qidsStr)) {
     qids = qidsStr;
  } else {
     try { qids = JSON.parse(qidsStr); } catch(e) { showCustomAlert('데이터 오류'); return; }
  }
  
  if(!qids || !qids.length) return;
  if(!studentId || studentId === "undefined") {
     showCustomAlert('오류: 학생 ID를 찾을 수 없습니다.');
     return;
  }

  const loadEl = document.getElementById('loadingOverlay');
  if(loadEl) {
     loadEl.querySelector('.loading-text').innerHTML = '오답 문제를 추출하여 문제지를 생성 중...';
     loadEl.classList.add('active');
  }

  google.script.run.withSuccessHandler(res => {
     if(loadEl) loadEl.classList.remove('active');
     
     const qs = res.qs || [];
     const history = res.history || {};

     // 오답 필터링: 제출 기록이 존재하며, 현재 오답(isCorrect === false)이거나 고쳐서 맞힌 문항(wasWrong === true 또는 wrongCount > 0)
     const wrongQs = qs.filter(q => {
        const record = history[q.qid];
        if (!record || record.empty) return false;
        
        const selected = String(record.selected || '').trim();
        if (!selected || selected === '-') return false; // 미제출(빈칸) 제외

        return (record.isCorrect === false || record.wasWrong === true || (record.wrongCount && record.wrongCount > 0));
     });

     if (wrongQs.length === 0) {
        showCustomAlert('출력할 오답 문항이 없습니다.\n(모두 한 번에 맞혔거나 아직 제출된 답안이 없습니다.)');
        return;
     }

     const baseTitle = originalTitle || (studentName + ' 학생의 과제');
     const finalTitle = baseTitle + ' (오답만)';
     const printName = studentId ? `${studentName}(${studentId})` : studentName;
     
     renderQuestionsForPrint(wrongQs, finalTitle, originalDate, printName);

  }).withFailureHandler(err => {
     if(loadEl) loadEl.classList.remove('active');
     showCustomAlert('오답 문제 로드 실패: ' + err);
  }).loadRetryData(studentId, qids, assignmentId);
}
  
function showAssignmentDetail(studentId, qidsStr, title, assignmentId) {
  const modal = document.getElementById('adminDetailModal');
  const body = document.getElementById('adminDetailBody');
  const titleEl = document.getElementById('adminDetailTitle');
  
  // 1. UI에 학생 이름 표시 (ID가 아니라 이름이 나오도록 캐시에서 검색)
  const row = ADMIN_HISTORY_CACHE.find(r => r.id === assignmentId);
  const studentName = row ? row.student : "학생";
  
  titleEl.innerText = `${studentName} - 상세 결과`;
  body.innerHTML = '<div style="text-align:center; padding:40px;">기록을 분석 중입니다...</div>';
  modal.style.display = 'flex';

  let qids = [];
  try { 
      qids = JSON.parse(qidsStr); 
  } catch(e) { 
      body.innerHTML = '<div style="color:red; padding:20px;">문항 목록 데이터 오류</div>';
      return; 
  }

  // 2. 서버 호출 (studentId가 비어있지 않은지 확인)
  if(!studentId || studentId === "undefined") {
      body.innerHTML = '<div style="color:red; padding:20px;">오류: 학생 ID를 찾을 수 없습니다. (인덱스 갱신 필요)</div>';
      return;
  }

  // [보조 함수] || 구분자를 (A), (B) 태그로 변환
  const formatAns = (val) => {
    if (!val || val === '-' || val.trim() === '') return val;
    
    // [추가] 결과 화면에서도 색상 태그가 렌더링되도록 변환
    let processed = val
        .replace(/<red>/gi, '<span class="txt-red">').replace(/<\/red>/gi, '</span>')
        .replace(/<blue>/gi, '<span class="txt-blue">').replace(/<\/blue>/gi, '</span>')
        .replace(/<green>/gi, '<span class="txt-green">').replace(/<\/green>/gi, '</span>')
        .replace(/<orange>/gi, '<span class="txt-orange">').replace(/<\/orange>/gi, '</span>');

    if (!processed.includes('||')) return processed;
    const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];
    return processed.split('||').map((v, i) => `<div style="white-space:nowrap;"><b>${labels[i] || `(${i+1})`}</b> ${v.trim()}</div>`).join('');
  };

  google.script.run
    .withSuccessHandler(res => {
      const qs = res.qs || [];
      const history = res.history || {};

      let html = `
        <table style="width:100%; border-collapse:collapse; font-size:13px; table-layout: fixed;">
          <thead style="background:#f3f4f6; position:sticky; top:0; z-index:2;">
            <tr>
              <th style="padding:8px; border:1px solid #ddd; width:40px;">번호</th>
              <th style="padding:8px; border:1px solid #ddd; width:100px;">유형</th>
              <th style="padding:8px; border:1px solid #ddd; width:140px;">문제ID</th>
              <th style="padding:8px; border:1px solid #ddd; width:50px;">난이도</th>
              <th style="padding:8px; border:1px solid #ddd; width:120px;">정답</th>
              <th style="padding:8px; border:1px solid #ddd; width:120px;">학생답</th>
              <th style="padding:8px; border:1px solid #ddd; width:50px;">결과</th>
              <th style="padding:8px; border:1px solid #ddd; width:60px;">오답</th>
            </tr>
          </thead>
          <tbody>`;

      qs.forEach((q, idx) => {
        const record = history[q.qid]; 
        const correctAns = String(q.answer || '-').trim();
        let selected = record ? (record.selected || '-') : '-';
        
        const displayCorrect = formatAns(correctAns);
        const displaySelected = formatAns(selected);

        let resultTxt = '미제출';
        let rowBg = '#fff';
        let textColor = '#374151';

        if (record && !record.empty) {
          if (record.isCorrect === true) {
            resultTxt = record.wasWrong ? '△' : 'O';
            rowBg = record.wasWrong ? '#fef9c3' : '#ecfdf5';
            textColor = record.wasWrong ? '#ca8a04' : '#059669';
          } else {
            resultTxt = 'X';
            rowBg = '#fef2f2';
            textColor = '#dc2626';
          }
        }

        html += `
          <tr style="background:${rowBg};">
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">${idx + 1}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${q.type || '-'}</td>
            <td style="padding:8px; border:1px solid #ddd; font-size:11px;">${q.extId || q.qid || '-'}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold;">${q.difficulty || '-'}</td>
            <td style="padding:8px; border:1px solid #ddd; color:#2b6cb0; word-break:break-all;">${displayCorrect}</td>
            <td style="padding:8px; border:1px solid #ddd; word-break:break-all;">${displaySelected}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center; font-weight:bold; color:${textColor};">${resultTxt}</td>
            <td style="padding:8px; border:1px solid #ddd; text-align:center;">${record?.wrongCount || 0}회</td>
          </tr>`;
      });
      
      html += '</tbody></table>';
      document.getElementById('adminDetailBody').innerHTML = html;
    })
    .withFailureHandler(err => {
      body.innerHTML = `<div style="color:red; padding:20px;">서버 오류: ${err}</div>`;
    })
    .loadRetryData(studentId, qids, assignmentId);
}

function closeAdminDetail() {
  document.getElementById('adminDetailModal').style.display = 'none';
}

// [신규] 우측 최근 5회차 과제 패널 열기/닫기 제어
function toggleRecentAssignmentsPanel(forceState) {
  const panel = document.getElementById('recentAssignmentsPanel');
  const btn = document.getElementById('btnToggleRecentAsgn');
  if (!panel) return;

  const selectEl = document.getElementById('targetStudentSelect');
  const inputEl = document.getElementById('targetStudentName');
  const studentId = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');

  const isCurrentlyOpen = (panel.style.display !== 'none');
  const nextState = (typeof forceState === 'boolean') ? forceState : !isCurrentlyOpen;

  if (nextState) {
    if (!studentId) {
      showCustomAlert('최근 과제를 확인할 학생을 먼저 선택해주세요.');
      return;
    }
    panel.style.display = 'flex';
    if (btn) {
      btn.style.background = '#059669';
      btn.style.color = '#fff';
    }
    loadRecentAssignmentsForStudent(false);
  } else {
    panel.style.display = 'none';
    if (btn) {
      btn.style.background = '#fff';
      btn.style.color = '#059669';
    }
  }
}

// [신규] 선택된 학생의 최근 5회차 과제 목록 로드 및 렌더링
function loadRecentAssignmentsForStudent(forceReload) {
  const selectEl = document.getElementById('targetStudentSelect');
  const inputEl = document.getElementById('targetStudentName');
  const studentId = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');
  const body = document.getElementById('recentAssignmentsBody');
  const titleEl = document.getElementById('recentAsgnTitle');

  if (!body) return;
  if (!studentId) {
    body.innerHTML = '<div style="padding:30px; text-align:center; color:#6b7280; font-size:13px;">학생을 먼저 선택해주세요.</div>';
    return;
  }

  let studentName = studentId;
  if (MANAGED_STUDENTS && Array.isArray(MANAGED_STUDENTS)) {
    const found = MANAGED_STUDENTS.find(s => s.id === studentId);
    if (found) studentName = found.name;
  }
  if (titleEl) titleEl.innerText = `📋 ${studentName} - 최근 5회차 과제`;

  const renderRecentList = () => {
    const matched = (ADMIN_HISTORY_CACHE || []).filter(r => {
      if (r.studentId && String(r.studentId) === String(studentId)) return true;
      return String(r.student || '').trim() === String(studentName).trim();
    }).slice(0, 5);

    if (matched.length === 0) {
      body.innerHTML = `<div style="padding:30px; text-align:center; color:#6b7280; font-size:13px;">${studentName} 학생의 최근 배부 기록이 없습니다.</div>`;
      return;
    }

    body.innerHTML = '';
    const fragment = document.createDocumentFragment();

    matched.forEach((row, idx) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'recent-asgn-item';

      let statusText = '';
      let statusColor = '#374151';
      if (row.displayStatus === '미완료') {
        statusText = `미완료(0/${row.totalCount})`;
        statusColor = '#dc2626';
      } else if (row.displayStatus === '진행 중') {
        statusText = `진행 중(${row.answeredCount}/${row.totalCount})`;
        statusColor = '#d97706';
      } else {
        statusText = `완료(${row.strictCorrectCount}/${row.totalCount})`;
        statusColor = '#059669';
      }

      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'recent-asgn-summary';
      summaryDiv.innerHTML = `
        <div style="min-width:0; flex:1;">
          <div style="font-size:11px; color:#6b7280; margin-bottom:2px;">
            <span style="font-weight:bold; color:#059669; margin-right:4px;">#${idx + 1}</span>${row.date || ''} | ${row.totalCount}문항
          </div>
          <div style="font-size:13px; font-weight:bold; color:#111827; word-break:break-all; line-height:1.35;">
            ${sanitizeInlineHTML(row.title)}
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <span style="font-size:12px; font-weight:bold; color:${statusColor};">${statusText}</span>
          <span class="recent-toggle-icon" style="font-size:11px; color:#6b7280;">▼</span>
        </div>
      `;

      const detailDiv = document.createElement('div');
      detailDiv.className = 'recent-asgn-detail';

      summaryDiv.onclick = () => {
        toggleRecentAssignmentDetail(row.studentId || studentId, row.qids, row.id, detailDiv, summaryDiv);
      };

      itemDiv.appendChild(summaryDiv);
      itemDiv.appendChild(detailDiv);
      fragment.appendChild(itemDiv);
    });

    body.appendChild(fragment);
  };

  if (!forceReload && ADMIN_HISTORY_CACHE && ADMIN_HISTORY_CACHE.length > 0) {
    renderRecentList();
    return;
  }

  body.innerHTML = '<div style="padding:30px; text-align:center; color:#059669; font-weight:bold; font-size:13px;">⏳ 최근 과제 목록을 불러오는 중...</div>';

  google.script.run.withSuccessHandler(list => {
    ADMIN_HISTORY_CACHE = list || [];
    renderRecentList();
  }).withFailureHandler(err => {
    body.innerHTML = `<div style="padding:20px; text-align:center; color:#dc2626; font-size:13px;">로드 실패: ${err}</div>`;
  }).getAllAssignmentsForAdmin('', false);
}

// [신규] 최근 과제 클릭 시 바로 아래에 배부기록 결과창(아코디언) 펼치기/접기
function toggleRecentAssignmentDetail(studentId, qidsStr, assignmentId, detailDiv, summaryDiv) {
  const iconEl = summaryDiv ? summaryDiv.querySelector('.recent-toggle-icon') : null;
  const isOpen = (detailDiv.style.display === 'block');

  if (isOpen) {
    detailDiv.style.display = 'none';
    if (iconEl) iconEl.innerText = '▼';
    return;
  }

  detailDiv.style.display = 'block';
  if (iconEl) iconEl.innerText = '▲';

  // 이미 한 번 불러온 결과 표가 있으면 재통신 없이 즉시 노출
  if (detailDiv.getAttribute('data-loaded') === 'true') {
    return;
  }

  let qids = [];
  try {
    qids = typeof qidsStr === 'string' ? JSON.parse(qidsStr) : qidsStr;
  } catch (e) {
    detailDiv.innerHTML = '<div style="color:#dc2626; padding:10px; font-size:12px;">문항 목록 데이터 오류</div>';
    return;
  }

  if (!studentId || studentId === 'undefined') {
    detailDiv.innerHTML = '<div style="color:#dc2626; padding:10px; font-size:12px;">오류: 학생 ID를 찾을 수 없습니다.</div>';
    return;
  }

  detailDiv.innerHTML = '<div style="text-align:center; padding:16px; color:#6b7280; font-size:12px;">⏳ 상세 결과를 분석 중입니다...</div>';

  const formatAns = (val) => {
    if (!val || val === '-' || val.trim() === '') return val;
    let processed = val
      .replace(/<red>/gi, '<span class="txt-red">').replace(/<\/red>/gi, '</span>')
      .replace(/<blue>/gi, '<span class="txt-blue">').replace(/<\/blue>/gi, '</span>')
      .replace(/<green>/gi, '<span class="txt-green">').replace(/<\/green>/gi, '</span>')
      .replace(/<orange>/gi, '<span class="txt-orange">').replace(/<\/orange>/gi, '</span>');
    if (!processed.includes('||')) return processed;
    const labels = ['(A)', '(B)', '(C)', '(D)', '(E)'];
    return processed.split('||').map((v, i) => `<div style="white-space:nowrap;"><b>${labels[i] || `(${i+1})`}</b> ${v.trim()}</div>`).join('');
  };

  google.script.run
    .withSuccessHandler(res => {
      const qs = res.qs || [];
      const history = res.history || {};

      let html = `
        <table style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout:fixed;">
          <thead style="background:#f3f4f6;">
            <tr>
              <th style="padding:5px 2px; border:1px solid #ddd; width:30px;">번호</th>
              <th style="padding:5px 4px; border:1px solid #ddd; width:68px;">유형</th>
              <th style="padding:5px 4px; border:1px solid #ddd; width:95px;">문제ID</th>
              <th style="padding:5px 2px; border:1px solid #ddd; width:34px;">난이도</th>
              <th style="padding:5px 4px; border:1px solid #ddd;">정답</th>
              <th style="padding:5px 4px; border:1px solid #ddd;">학생답</th>
              <th style="padding:5px 2px; border:1px solid #ddd; width:36px;">결과</th>
              <th style="padding:5px 2px; border:1px solid #ddd; width:38px;">오답</th>
            </tr>
          </thead>
          <tbody>`;

      qs.forEach((q, idx) => {
        const record = history[q.qid];
        const correctAns = String(q.answer || '-').trim();
        const selected = record ? (record.selected || '-') : '-';

        const displayCorrect = formatAns(correctAns);
        const displaySelected = formatAns(selected);

        let resultTxt = '미제출';
        let rowBg = '#fff';
        let textColor = '#374151';

        if (record && !record.empty) {
          if (record.isCorrect === true) {
            resultTxt = record.wasWrong ? '△' : 'O';
            rowBg = record.wasWrong ? '#fef9c3' : '#ecfdf5';
            textColor = record.wasWrong ? '#ca8a04' : '#059669';
          } else {
            resultTxt = 'X';
            rowBg = '#fef2f2';
            textColor = '#dc2626';
          }
        }

        html += `
          <tr style="background:${rowBg};">
            <td style="padding:5px 2px; border:1px solid #ddd; text-align:center;">${idx + 1}</td>
            <td style="padding:5px 4px; border:1px solid #ddd; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${q.type || '-'}</td>
            <td style="padding:5px 4px; border:1px solid #ddd; font-size:10.5px; word-break:break-all;">${q.extId || q.qid || '-'}</td>
            <td style="padding:5px 2px; border:1px solid #ddd; text-align:center; font-weight:bold;">${q.difficulty || '-'}</td>
            <td style="padding:5px 4px; border:1px solid #ddd; color:#2b6cb0; word-break:break-all;">${displayCorrect}</td>
            <td style="padding:5px 4px; border:1px solid #ddd; word-break:break-all;">${displaySelected}</td>
            <td style="padding:5px 2px; border:1px solid #ddd; text-align:center; font-weight:bold; color:${textColor};">${resultTxt}</td>
            <td style="padding:5px 2px; border:1px solid #ddd; text-align:center;">${record?.wrongCount || 0}회</td>
          </tr>`;
      });

      html += '</tbody></table>';
      detailDiv.innerHTML = html;
      detailDiv.setAttribute('data-loaded', 'true');
    })
    .withFailureHandler(err => {
      detailDiv.innerHTML = `<div style="color:#dc2626; padding:10px; font-size:12px;">서버 오류: ${err}</div>`;
    })
    .loadRetryData(studentId, qids, assignmentId);
}

// 2. 통합 출제 버튼 핸들러 (교체)
const btnPrintChecked = document.getElementById('btnPrintChecked');
if (btnPrintChecked) {
  btnPrintChecked.onclick = function() {
    const titleVal = document.getElementById('customTitleInput') ? document.getElementById('customTitleInput').value.trim() : '';

    const uncheckedButSelected = document.querySelectorAll('#invTbody .inv-check:checked:not(:disabled)');
    uncheckedButSelected.forEach(cb => MAKER_CART.add(cb.value));
    updateCartUI();

    if(MAKER_CART.size === 0) { showCustomAlert('바구니에 담긴 문제가 없습니다.'); return; }

    let targetUsers = [];
    if (SELECTED_MULTI_STUDENTS && SELECTED_MULTI_STUDENTS.length > 0) {
        targetUsers = [...SELECTED_MULTI_STUDENTS];
    } else {
        const selectEl = document.getElementById('targetStudentSelect');
        if (selectEl && selectEl.value) {
            const found = MANAGED_STUDENTS.find(s => s.id === selectEl.value);
            targetUsers = [{ id: selectEl.value, name: found ? found.name : selectEl.value }];
        }
    }
    if(targetUsers.length === 0) { showCustomAlert('대상 학생을 선택해주세요.'); return; }

    const today = new Date();
    const mm = today.getMonth() + 1;
    const dd = today.getDate();
    const studentLabel = targetUsers.length > 1 ? `${targetUsers[0].name} 외 ${targetUsers.length - 1}명` : targetUsers[0].name;
    const qCount = MAKER_CART.size;
    const defaultTitle = `${mm}월 ${dd}일 ${studentLabel} 과제 ${qCount}개`;

    const customTitle = titleVal || defaultTitle;
    const confirmMsg = targetUsers.length > 1 
        ? `${targetUsers[0].name} 외 ${targetUsers.length - 1}명에게 일괄 출제하시겠습니까?`
        : `${targetUsers[0].name} 학생에게 과제를 출제하시겠습니까?`;

    showCustomConfirm(confirmMsg, function() {
        const groups = {};
        const cartArray = Array.from(MAKER_CART);
        cartArray.forEach(qid => {
            const rowData = INVENTORY_DATA.find(r => r.qid === qid);
            const gKey = rowData ? (rowData.groupHash || qid) : qid;
            if (!groups[gKey]) groups[gKey] = [];
            groups[gKey].push(qid);
        });
        const inOrder = document.getElementById('chkInOrder') ? document.getElementById('chkInOrder'].checked : false;
        const cartOrder = document.getElementById('chkCartOrder') ? document.getElementById('chkCartOrder').checked : false;
        const groupKeys = Object.keys(groups);

        if (cartOrder) {
            const cartArray = Array.from(MAKER_CART);
            groupKeys.sort((a, b) => {
                const qidA = groups[a][0];
                const qidB = groups[b][0];
                return cartArray.indexOf(qidA) - cartArray.indexOf(qidB);
            });
        } else if (inOrder) {
            groupKeys.sort((a, b) => {
                const rowA = INVENTORY_DATA.find(r => (r.groupHash || r.qid) === a);
                const rowB = INVENTORY_DATA.find(r => (r.groupHash || r.qid) === b);
                if (!rowA || !rowB) return 0;
                const numA = parseInt(String(rowA.number || '').replace(/[^0-9]/g, ''), 10) || 0;
                const numB = parseInt(String(rowB.number || '').replace(/[^0-9]/g, ''), 10) || 0;
                if (numA !== numB) return numA - numB;
                const metaA = [rowA.year, rowA.month, rowA.number].join('');
                const metaB = [rowB.year, rowB.month, rowB.number].join('');
                return metaA.localeCompare(metaB);
            });
        } else {
            groupKeys.sort(() => Math.random() - 0.5);
        }
        let qids = [];
        groupKeys.forEach(k => { qids = qids.concat(groups[k]); });

        const loadEl = document.getElementById('loadingOverlay');
        if(loadEl) { loadEl.querySelector('.loading-text').innerText = '과제 생성 및 패키징 중...'; loadEl.classList.add('active'); }

        // [방안 C 최적화] 서버 통신 1회(1-Trip)로 과제 생성과 인쇄용 데이터를 동시에 수신
        const apiFunc = (targetUsers.length > 1) ? 'createBulkAssignments' : 'createAssignment';
        const apiArgs = (targetUsers.length > 1) ? [targetUsers, customTitle, qids] : [targetUsers[0], customTitle, qids, false];

        google.script.run.withSuccessHandler(res => {
            if(loadEl) loadEl.classList.remove('active');
            if(res && res.error) {
                showCustomAlert('출제 실패: ' + res.error);
                return;
            }
            ADMIN_HISTORY_CACHE = []; // 배부기록 캐시 무효화
            
            const primaryNameWithId = `${targetUsers[0].name}(${targetUsers[0].id})`;
            const printStudentName = targetUsers.length > 1 ? primaryNameWithId + ' 외 ' + (targetUsers.length - 1) + '명' : primaryNameWithId;
            
            // 서버에서 바로 넘어온 res.qs를 사용하므로 추가 통신 대기 시간이 0초가 됩니다.
            renderQuestionsForPrint(res.qs, customTitle, null, printStudentName);
            SELECTED_MULTI_STUDENTS = []; 
            updateStudentDisplayUI();
        }).withFailureHandler(err => {
            if(loadEl) loadEl.classList.remove('active');
            showCustomAlert('출제 실패: ' + err);
        })[apiFunc].apply(null, apiArgs);
    });
};

// =========================================================
// [신규] 주간평가 전용 로직 (탭 이동, 학년 토글, 출제 동작)
// =========================================================

// 2. 출제 버튼 클릭 로직
const btnGenerateWeekly = document.getElementById('btnGenerateWeekly');
if (btnGenerateWeekly) {
    btnGenerateWeekly.addEventListener('click', function() {
    // (1) 데이터 수집
    const selectEl = document.getElementById('weeklyStudentSelect');
    const tId = selectEl.value;
    if(!tId) { showCustomAlert('대상 학생을 선택해주세요.'); return; }
    
    const found = MANAGED_STUDENTS.find(s => s.id === tId);
    const userObj = { id: tId, name: found.name };
    
    // 선택된 칩들의 값을 배열로 수집
    const weakTypeChips = document.querySelectorAll('#weeklyWeakTypeChips .chip.selected');
    const weakTypes = Array.from(weakTypeChips).map(chip => chip.value);
    
    const level = document.getElementById('weeklyLevelSlider').value;
    const titleVal = document.getElementById('weeklyTitleInput').value.trim();

    // (2) 생성 확인 및 실행
    showCustomConfirm(`[전 학년 통합 / 난이도 ${level}단계]\n주간평가 20문항을 밸런스형으로 구성하시겠습니까?\n\n대상 학생: ${found.name}`, function() {
        const loadEl = document.getElementById('loadingOverlay');
        if(loadEl) { 
            loadEl.querySelector('.loading-text').innerHTML = `<span style="color:#7c3aed; font-weight:bold;">${found.name}</span> 학생의 주간평가를 출제 중입니다...<br><span style="font-size:14px;color:#6b7280;">잠시만 기다려주세요.</span>`;
            loadEl.classList.add('active'); 
        }

        // 서버 전송 (이전 단계에서 수정한 GS 함수 호출)
        google.script.run.withSuccessHandler(res => {
            if(loadEl) loadEl.classList.remove('active');
            if(res.error) { showCustomAlert(res.error); return; }
            
            // 성공 시, 생성된 문항을 인쇄 미리보기로 바로 연결!
            const printName = `${found.name}(${found.id})`;
            renderQuestionsForPrint(res.qs, res.title, null, printName);
            
            // 과제 제목 입력칸 초기화 (재사용 대비)
            document.getElementById('weeklyTitleInput').value = '';
            
        }).withFailureHandler(err => {
            if(loadEl) loadEl.classList.remove('active');
            showCustomAlert('출제 중 오류가 발생했습니다: ' + err);
        }).createWeeklyAssignmentAuto(userObj, level, titleVal, weakTypes);
    });
});
}

function openTypeStatsModal() {
  const selectEl = document.getElementById('targetStudentSelect');
  const inputEl = document.getElementById('targetStudentName');
  const studentId = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');

  if (!studentId) {
    showCustomAlert('통계를 확인할 학생을 먼저 선택해주세요.');
    return;
  }

  document.getElementById('adminTypeStatsModal').style.display = 'flex';
  loadTypeStatsData();
}

function closeTypeStatsModal() {
  document.getElementById('adminTypeStatsModal').style.display = 'none';
}

function loadTypeStatsData() {
  const selectEl = document.getElementById('targetStudentSelect');
  const inputEl = document.getElementById('targetStudentName');
  const studentId = selectEl ? selectEl.value : (inputEl ? inputEl.value : '');

  if (!studentId) return;

  const daysInput = document.getElementById('statsDaysInput').value;
  const days = parseInt(daysInput, 10) || 0;

  const tbody = document.getElementById('adminTypeStatsTbody');
  tbody.innerHTML = '<tr><td colspan="5" style="padding:40px; text-align:center;">데이터를 분석 중입니다...</td></tr>';

  google.script.run.withSuccessHandler(stats => {
    tbody.innerHTML = '';
    if (!stats || stats.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align:center; color:#6b7280;">해당 기간의 풀이 기록이 없습니다.</td></tr>';
      return;
    }

    const fragment = document.createDocumentFragment();
    stats.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      
      let rateColor = '#374151';
      if (s.rate >= 50) rateColor = '#dc2626'; // 50% 이상 빨간색
      else if (s.rate >= 30) rateColor = '#d97706'; // 30% 이상 주황색

      tr.innerHTML = `
        <td style="padding:10px; font-weight:bold;">${idx + 1}</td>
        <td style="padding:10px; font-weight:bold; text-align:left;">${s.type}</td>
        <td style="padding:10px;">${s.total}</td>
        <td style="padding:10px; color:#dc2626; font-weight:bold;">${s.wrong}</td>
        <td style="padding:10px; font-weight:bold; color:${rateColor};">${s.rate}%</td>
      `;
      fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

  }).withFailureHandler(err => {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#dc2626;">오류 발생: ${err}</td></tr>`;
  }).getStudentTypeStats(studentId, days);
}

function refreshMasterIndex() {
  showCustomConfirm('모든 시트를 분석하여 인덱스를 새로고침하시겠습니까?\n완료 후 로딩 속도가 획기적으로 빨라집니다.', function() {
    
    const loadEl = document.getElementById('loadingOverlay');
    if(loadEl) {
      loadEl.querySelector('.loading-text').innerHTML = '문제 목록 인덱스 생성 중...<br>잠시만 기다려주세요.';
      loadEl.classList.add('active');
    }
    
    google.script.run
      .withSuccessHandler(res => {
        if(loadEl) loadEl.classList.remove('active');
        showCustomAlert('인덱스 새로고침 완료!');
        
        if(typeof loadInventoryData === 'function') {
          const sel = document.getElementById('targetStudentSelect');
          if(sel && sel.value) loadInventoryData();
        }
      })
      .withFailureHandler(err => {
        if(loadEl) loadEl.classList.remove('active');
        // 3. 커스텀 알림창 사용
        showCustomAlert('오류 발생: ' + err);
      })
      .updateMasterIndex(); 
  });
}

const weeklySelState = {
    'm1': { years: new Set(), months: new Set() },
    'm2': { years: new Set(), months: new Set() },
    'm3': { years: new Set(), months: new Set() },
    'h1': { years: new Set(), months: new Set() },
    'h2': { years: new Set(), months: new Set() },
    'h3': { years: new Set(), months: new Set() }
};
let WEEKLY_INVENTORY_DATA = [];
let WEEKLY_CURRENT_GRADE = 'm1';

function switchWkGradeTab(gradeId) {
    WEEKLY_CURRENT_GRADE = gradeId;
    const container = document.getElementById('weeklyGradeTabs');
    if(!container) return;
    container.querySelectorAll('.grade-tab').forEach(el => {
        const clickAttr = el.getAttribute('onclick');
        const hasId = clickAttr ? String(clickAttr).includes(gradeId) : false;
        el.classList.toggle('active', hasId);
    });
    document.querySelectorAll('#weeklyMakerPage .grade-panel').forEach(el => el.classList.remove('active'));
    const targetPanel = document.getElementById('wk_gp_' + gradeId);
    if(targetPanel) targetPanel.classList.add('active');
}

function loadWeeklyStudentData() {
    const selectEl = document.getElementById('weeklyStudentSelect');
    const val = selectEl ? selectEl.value : '';
    if(!val) { showCustomAlert('학생을 선택해 주십시오.'); return; }

    let displayName = val;
    if (MANAGED_STUDENTS && Array.isArray(MANAGED_STUDENTS)) {
        const found = MANAGED_STUDENTS.find(s => s.id === val);
        if (found) displayName = found.name;
    }

    const statusEl = document.getElementById('weeklyAnalysisStatus');
    if(statusEl) statusEl.innerHTML = '<span style="color:#2b6cb0;">⏳ 전 영역 데이터 인덱싱 및 기록 추적 중...</span>';

    const loadEl = document.getElementById('loadingOverlay');
    if(loadEl) {
        loadEl.querySelector('.loading-text').innerHTML = `<span style="color:#7c3aed; font-weight:bold;">${displayName}</span> 학생의 커스텀 리포트 환경 구성 중...`;
        loadEl.classList.add('active');
    }

    // [최적화] 2번 직렬 호출 대신 loadWeeklyStudentBundle 단 1회 호출로 통계+인벤토리 동시 수신
    google.script.run.withSuccessHandler(bundle => {
        if(loadEl) loadEl.classList.remove('active');
        const stats = (bundle && bundle.stats) ? bundle.stats : [];
        const invData = (bundle && bundle.inventory) ? bundle.inventory : [];

        const chipBox = document.getElementById('weeklyWeakTypeChips');
        if (!stats || stats.length === 0) {
            if(statusEl) statusEl.innerHTML = '📝 과거 누적 기록이 없는 학생입니다. 기본 문항 인덱스를 매핑합니다.';
            renderWkDefaultChips();
        } else {
            if(statusEl) statusEl.innerHTML = '✅ 분석 완료 (정답률 40% 이하 취약 항목 우선 할당 가중치 부여)';
            if(chipBox) {
                chipBox.innerHTML = '';
                stats.forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'chip';
                    let badgeColor = '#6b7280';
                    let borderStyle = '1px solid #d1d5db';
                    if (s.rate <= 40) { badgeColor = '#dc2626'; borderStyle = '2px solid #dc2626'; btn.classList.add('selected'); btn.style.background = '#eff6ff'; }
                    else if (s.rate <= 70) { badgeColor = '#d97706'; }
                    btn.innerHTML = `<div style="font-size:12px;">${s.type}</div><div style="font-size:10px; font-weight:bold; color:${badgeColor};">${s.rate}%</div>`;
                    btn.style.cssText = `width:auto; padding:4px 8px; display:flex; flex-direction:column; align-items:center; border:${borderStyle}; margin: 2px; border-radius:6px;`;
                    btn.value = s.type;
                    btn.onclick = function() {
                        this.classList.toggle('selected');
                        this.style.background = this.classList.contains('selected') ? '#eff6ff' : '#fff';
                    };
                    chipBox.appendChild(btn);
                });
            }
        }

        WEEKLY_INVENTORY_DATA = invData.filter(q => q && q.qid);
        initWeeklyScopeFilters();
        renderWeeklyTable();
    }).withFailureHandler(err => {
        if(loadEl) loadEl.classList.remove('active');
        showCustomAlert('데이터 로드 실패: ' + err);
    }).loadWeeklyStudentBundle(val, 35);
}

function renderWkDefaultChips() {
    const chipBox = document.getElementById('weeklyWeakTypeChips');
    const applyTypes = (types) => {
        if(chipBox && types) {
            chipBox.innerHTML = '';
            types.forEach(t => {
                const btn = document.createElement('button');
                btn.className = 'chip'; btn.textContent = t; btn.value = t;
                btn.style.cssText = 'width:auto; padding:6px 12px; margin:2px; border-radius:6px; border:1px solid #d1d5db; background:#fff;';
                btn.onclick = function() { this.classList.toggle('selected'); this.style.background = this.classList.contains('selected') ? '#eff6ff' : '#fff'; };
                chipBox.appendChild(btn);
            });
        }
    };
    if (SOURCE_FILTERS_CACHE && SOURCE_FILTERS_CACHE.types) {
        applyTypes(SOURCE_FILTERS_CACHE.types);
    } else {
        google.script.run.withSuccessHandler(res => {
            SOURCE_FILTERS_CACHE = res;
            if (res && res.types) applyTypes(res.types);
        }).getSourceFiltersAndTypes();
    }
}

function initWeeklyScopeFilters() {
    const renderWkFilterChips = (containerId, items, category, stateObj, onChangeFn) => {
        const box = document.getElementById(containerId);
        if(!box) return;
        box.innerHTML = '';
        
        const allBtn = document.createElement('span');
        allBtn.className = 'inv-chip'; allBtn.textContent = '전체';
        const currentSet = stateObj[category];
        const updateAll = () => { allBtn.classList.toggle('selected', items.length > 0 && currentSet.size === items.length); };
        
        allBtn.onclick = () => {
            if(allBtn.classList.contains('selected')) currentSet.clear();
            else items.forEach(i => currentSet.add(i));
            updateAll();
            renderWkFilterChips(containerId, items, category, stateObj, onChangeFn);
            if(onChangeFn) onChangeFn(); else renderWeeklyTable();
        };
        box.appendChild(allBtn);
        
        items.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'inv-chip';
            if(currentSet.has(item)) chip.classList.add('selected');
            chip.textContent = item;
            chip.onclick = () => {
                if(currentSet.has(item)) currentSet.delete(item); else currentSet.add(item);
                chip.classList.toggle('selected', currentSet.has(item));
                updateAll();
                if(onChangeFn) onChangeFn(); else renderWeeklyTable();
            };
            box.appendChild(chip);
        });
        updateAll();
    };

    const updateWkCascading = (gId, gName, skipRender = false) => {
        const state = weeklySelState[gId];
        const gradeData = WEEKLY_INVENTORY_DATA.filter(x => x.grade === gName);
        const gYears = [...new Set(gradeData.map(x => String(x.year)).filter(Boolean))].sort();
        
        let monthData = gradeData;
        if (state.years.size > 0) monthData = monthData.filter(x => state.years.has(String(x.year)));
        const gMonths = [...new Set(monthData.map(x => x.month).filter(Boolean))].sort();
        
        renderWkFilterChips('wkYearChips_' + gId, gYears, 'years', state, () => updateWkCascading(gId, gName, false));
        renderWkFilterChips('wkMonthChips_' + gId, gMonths, 'months', state, () => renderWeeklyTable());
        if (!skipRender) renderWeeklyTable();
    };

    [ 
      {id: 'm1', name: '중1'}, {id: 'm2', name: '중2'}, {id: 'm3', name: '중3'}, 
      {id: 'h1', name: '고1'}, {id: 'h2', name: '고2'}, {id: 'h3', name: '고3'} 
    ].forEach(g => {
        updateWkCascading(g.id, g.name, true); // 초기 루프 시 6회 중복 렌더링 방지
    });
}
  
function renderWeeklyTable() {
    const tbody = document.getElementById('weeklyInvTbody');
    if(!tbody) return;
    tbody.innerHTML = '';

    let hasAnyFilter = false;
    const activeGrades = [];
    [ 
      {id: 'm1', name: '중1'}, {id: 'm2', name: '중2'}, {id: 'm3', name: '중3'}, 
      {id: 'h1', name: '고1'}, {id: 'h2', name: '고2'}, {id: 'h3', name: '고3'} 
    ].forEach(g => {
        if (weeklySelState[g.id].years.size > 0 || weeklySelState[g.id].months.size > 0) {
            hasAnyFilter = true;
            activeGrades.push(g.name);
        }
    });

    if(!hasAnyFilter || WEEKLY_INVENTORY_DATA.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:40px; text-align:center; color:#6b7280;">출제할 학년 및 범주 조건을 좌측 사이드바에서 선택해 주십시오.</td></tr>`;
        updateWkCount();
        return;
    }

    const excludeSolved = document.getElementById('chkWkExcludeSolved') ? document.getElementById('chkWkExcludeSolved').checked : false;

    const filtered = WEEKLY_INVENTORY_DATA.filter(row => {
        if (excludeSolved && row.isSolved) return false;
        if (!activeGrades.includes(row.grade)) return false;
        
        let gradeId = row.grade === '중1'?'m1':row.grade==='중2'?'m2':row.grade==='중3'?'m3':row.grade==='고1'?'h1':row.grade==='고2'?'h2':'h3';
        const s = weeklySelState[gradeId];
        if(s && s.years.size && !s.years.has(String(row.year))) return false;
        if(s && s.months.size && !s.months.has(row.month)) return false;
        return true;
    });

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding:20px; text-align:center;">조건 필터에 일치하는 문항이 보관함에 존재하지 않습니다.</td></tr>`;
        updateWkCount();
        return;
    }

    filtered.sort((a,b) => String(a.qid).localeCompare(String(b.qid)));

    const fragment = document.createDocumentFragment();
    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.className = 'wk-row';

        let statusBadge = row.isSolved 
            ? (row.wrongCount > 0 ? '<span style="color:#d97706; font-weight:bold;">[완료]</span>' : '<span style="color:#059669; font-weight:bold;">[완료]</span>')
            : '<span style="color:#dc2626; font-weight:bold;">[미완]</span>';
        let wrongCountBadge = row.wrongCount > 0 ? `<span style="color:#dc2626; font-weight:bold;">${row.wrongCount}회</span>` : '<span style="color:#9ca3af;">-</span>';
        const sourceStr = [row.grade, row.year, row.month, row.detail].filter(Boolean).join(' ');

        tr.innerHTML = `
          <td style="padding:8px; text-align:center;">
            <input type="checkbox" class="wk-check" value="${row.qid}" data-difficulty="${row.difficulty}" data-type="${row.type}" data-group="${row.groupHash || row.qid}">
          </td>
          <td style="padding:8px; text-align:center;">${statusBadge}</td>
          <td style="padding:8px; text-align:center;">${wrongCountBadge}</td>
          <td style="padding:8px; text-align:left;">${sourceStr}</td>
          <td style="padding:8px; text-align:left;">${row.type || '-'}</td>
          <td style="padding:8px; text-align:center; font-weight:bold;">${row.difficulty || '-'}</td>
          <td style="padding:8px; text-align:center; color:#666;">${row.number || ''}</td>
        `;

        tr.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const cb = tr.querySelector('.wk-check');
                cb.checked = !cb.checked;
            }
            const groupKey = tr.querySelector('.wk-check').getAttribute('data-group');
            const isChecked = tr.querySelector('.wk-check').checked;
            if(groupKey) {
                document.querySelectorAll(`#weeklyInvTbody .wk-check[data-group="${groupKey}"]`).forEach(sib => sib.checked = isChecked);
            }
            updateWkCount();
        });

        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment);

    // 테이블 헤더 체크박스 로직 연동
    const wkCheckAll = document.getElementById('weeklyCheckAll');
    if(wkCheckAll) {
        wkCheckAll.onchange = function(e) {
            const isChecked = e.target.checked;
            document.querySelectorAll('#weeklyInvTbody .wk-check').forEach(cb => cb.checked = isChecked);
            updateWkCount();
        };
    }
    updateWkCount();
}

function updateWkCount() {
    const count = document.querySelectorAll('.wk-check:checked').length;
    const display = document.getElementById('weeklySelectedCount');
    if(display) display.innerText = count;
}

function runWeeklyAutoSelection() {
    const targetLevel = parseInt(document.getElementById('weeklyLevelSlider').value, 10) || 5;
    const checkboxes = Array.from(document.querySelectorAll('#weeklyInvTbody .wk-check'));
    
    if(checkboxes.length === 0) {
        showCustomAlert('추출 대상 문항이 없습니다. 먼저 왼쪽에서 학년 및 범위 조건을 클릭하여 조회해 주십시오.');
        return;
    }

    checkboxes.forEach(cb => cb.checked = false);

    const byDiff = {};
    for(let i=1; i<=15; i++) byDiff[i] = [];

    const selectedWeakChips = document.querySelectorAll('#weeklyWeakTypeChips .chip.selected');
    const activeWeakTypes = Array.from(selectedWeakChips).map(c => String(c.value).trim());

    checkboxes.forEach(cb => {
        let d = parseInt(cb.getAttribute('data-difficulty'), 10);
        if(isNaN(d) || d < 1) d = 1;
        if(d > 15) d = 15;
        byDiff[d].push(cb);
    });

    const distribution = { '-2': 2, '-1': 4, '0': 8, '1': 4, '2': 2 };
    const reqCounts = {};
    for (let i = 1; i <= 15; i++) reqCounts[i] = 0;
    for (let offset in distribution) {
        let l = targetLevel + parseInt(offset, 10);
        if (l < 1) l = 1;
        if (l > 15) l = 15;
        reqCounts[l] += distribution[offset];
    }

    let totalPicked = 0;
    const pickedGroups = new Set();

    for (let lvl = 1; lvl <= 15; lvl++) {
        let needed = reqCounts[lvl];
        if (needed <= 0) continue;

        let pools = byDiff[lvl] || [];
        if(pools.length === 0) continue;

        pools.sort((a, b) => {
            const typeA = a.getAttribute('data-type') || '';
            const typeB = b.getAttribute('data-type') || '';
            const matchA = activeWeakTypes.some(wt => typeA.includes(wt)) ? 1 : 0;
            const matchB = activeWeakTypes.some(wt => typeB.includes(wt)) ? 1 : 0;
            if (matchA !== matchB) return matchB - matchA;
            return Math.random() - 0.5;
        });

        pools.forEach(cb => {
            if(needed <= 0) return;
            const gKey = cb.getAttribute('data-group');
            const groupItems = checkboxes.filter(item => item.getAttribute('data-group') === gKey);
            
            if(!pickedGroups.has(gKey)) {
                groupItems.forEach(item => item.checked = true);
                pickedGroups.add(gKey);
                needed -= groupItems.length;
                totalPicked += groupItems.length;
            }
        });
    }

    if(totalPicked < 20) {
        let remaining = checkboxes.filter(cb => !cb.checked);
        remaining.sort(() => Math.random() - 0.5);
        for(let cb of remaining) {
            if(totalPicked >= 20) break;
            const gKey = cb.getAttribute('data-group');
            const groupItems = checkboxes.filter(item => item.getAttribute('data-group') === gKey && !item.checked);
            groupItems.forEach(item => item.checked = true);
            totalPicked += groupItems.length;
        }
    }

    updateWkCount();
    showCustomAlert(`🎯 지정 범위 내부 풀에서 조건(난이도 분포 및 오답률 높은 유형)에 맞춰 20문항이 엄선 및 자동 체크되었습니다.\n테이블을 확인하며 문항을 최종 조율해 주십시오.`);
}
// [추가] 배부 기록 조회 버튼 자동 바인딩
document.addEventListener('DOMContentLoaded', function() {
  const btnHistorySearch = document.getElementById('btnSearchHistory') || document.getElementById('btnLoadHistory');
  if (btnHistorySearch) {
    btnHistorySearch.onclick = loadAdminHistory;
  }
  
  // 인벤토리 불러오기 버튼도 안전하게 바인딩
  const btnLoadInv = document.getElementById('btnLoadInventory');
  if (btnLoadInv) {
    btnLoadInv.onclick = loadInventoryData;
  }
});
