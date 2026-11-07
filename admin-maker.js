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
    const cartPanel = document.getElementById('cartListPanel');
    if (cartPanel && cartPanel.classList.contains('open')) renderCartTable();
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
let INVENTORY_REQUEST_SEQUENCE = 0;
function loadInventoryData() {
  const requestSequence = ++INVENTORY_REQUEST_SEQUENCE;
  const requestUser = CURRENT_USER;
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

  fetchInventoryRows(val).then(data => {
    if (requestSequence !== INVENTORY_REQUEST_SEQUENCE || CURRENT_USER !== requestUser || (selectEl && selectEl.value !== val)) return;
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
      
  }, err => {
    if (requestSequence !== INVENTORY_REQUEST_SEQUENCE || CURRENT_USER !== requestUser) return;
    if(loadEl) loadEl.classList.remove('active');
    showCustomAlert('오류 발생: ' + err);
  });
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
  ['status', 'lastTs', 'assign', 'wrong', 'source', 'type', 'difficulty', 'number'].forEach(col => {
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
      tr.innerHTML = `<td colspan="9" style="padding:20px; text-align:center;">조건에 맞는 문제가 없습니다.</td>`;
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
  
  if (!CURRENT_USER) return;
  const user = CURRENT_USER;

  // 저장된 배부 기록을 즉시 표시하고, 최신 기록은 뒤에서 받아 바뀐 경우에만 다시 그립니다.
  let shown = false;
  swrLoad({
    key: 'adminHistory:' + (loadAll ? 'all' : '3m'), scope: user.id,
    func: 'getAllAssignmentsForAdmin', args: [searchName, loadAll],
    guard: () => CURRENT_USER === user,
    onData: list => {
      shown = true;
      ADMIN_HISTORY_CACHE = Array.isArray(list) ? list : [];
      renderHistoryUI();
      if(ADMIN_HISTORY_CACHE.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#6b7280;">데이터가 없습니다.</td></tr>';
      }
    },
    onError: (err, info) => {
      if (info.hadCache) showToast('최신 배부 기록을 불러오지 못했습니다. 저장된 기록을 표시합니다.', 'error');
      else tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#dc2626;">❌ 데이터를 불러오지 못했습니다: ' + escapeHTML(String(err)) + '</td></tr>';
    }
  });
  // 저장본이 없을 때만 로딩 문구 표시
  if (!shown) tbody.innerHTML = '<tr><td colspan="6" style="padding:40px; text-align:center; color:#2b6cb0; font-weight:bold;">📋 배부 기록을 서버에서 가져오는 중입니다...</td></tr>';
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
    .getAssignmentResult(studentId, qids, assignmentId);
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
let RECENT_STUDENT_REQUEST_SEQUENCE = 0;
function loadRecentAssignmentsForStudent(forceReload) {
  const requestSequence = ++RECENT_STUDENT_REQUEST_SEQUENCE;
  const requestUser = CURRENT_USER;
  let recentRows = [];
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
    const matched = (recentRows || []).filter(r => {
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

  body.innerHTML = '<div style="padding:30px; text-align:center; color:#059669; font-weight:bold; font-size:13px;">⏳ 최근 과제 목록을 불러오는 중...</div>';

  google.script.run.withSuccessHandler(list => {
    if (requestSequence !== RECENT_STUDENT_REQUEST_SEQUENCE || CURRENT_USER !== requestUser || (selectEl && selectEl.value !== studentId)) return;
    recentRows = list || [];
    renderRecentList();
  }).withFailureHandler(err => {
    if (requestSequence !== RECENT_STUDENT_REQUEST_SEQUENCE || CURRENT_USER !== requestUser) return;
    body.innerHTML = `<div style="padding:20px; text-align:center; color:#dc2626; font-size:13px;">로드 실패: ${err}</div>`;
  }).getRecentAssignmentsForStudent({id: studentId, name: studentName}, 5);
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

  // 열 때마다 최신 결과표를 확인해 학생의 추가 제출을 반영합니다.

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
    .getAssignmentResult(studentId, qids, assignmentId);
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
        const cartOrder = document.getElementById('chkCartOrder') ? document.getElementById('chkCartOrder').checked : false;
        const groupKeys = Object.keys(groups);

        if (cartOrder) {
            const cartArray = Array.from(MAKER_CART);
            groupKeys.sort((a, b) => {
                const qidA = groups[a][0];
                const qidB = groups[b][0];
                return cartArray.indexOf(qidA) - cartArray.indexOf(qidB);
            });
        } else {
            // 기본: 지문 세트 단위 무작위 (Fisher-Yates)
            for (let i = groupKeys.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [groupKeys[i], groupKeys[j]] = [groupKeys[j], groupKeys[i]];
            }
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
            resetMakerAfterAssign();
        }).withFailureHandler(err => {
            if(loadEl) loadEl.classList.remove('active');
            showCustomAlert('출제 실패: ' + err);
        })[apiFunc].apply(null, apiArgs);
    });
};
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
        invalidateQuestionMeta(); // 브라우저에 저장된 문항 목록도 새로 받도록
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

/* ===================== 주간평가 출제 =====================
 * 선택 상태는 화면의 체크박스가 아니라 WK_SEL(문항 QID 집합)에 둡니다.
 * 그래서 범위를 바꾸거나 정렬해도 고른 문항이 사라지지 않습니다.
 */
const weeklySelState = {
    'm1': { years: new Set(), months: new Set() },
    'm2': { years: new Set(), months: new Set() },
    'm3': { years: new Set(), months: new Set() },
    'h1': { years: new Set(), months: new Set() },
    'h2': { years: new Set(), months: new Set() },
    'h3': { years: new Set(), months: new Set() }
};
const WK_GRADES = [
    { id: 'm1', name: '중1' }, { id: 'm2', name: '중2' }, { id: 'm3', name: '중3' },
    { id: 'h1', name: '고1' }, { id: 'h2', name: '고2' }, { id: 'h3', name: '고3' }
];
const WK_GRADE_ORDER = { '중1': 1, '중2': 2, '중3': 3, '고1': 4, '고2': 5, '고3': 6 };
const WK_TARGET = 20;
const WK_RECENT_MS = 28 * 86400000; // 최근 4주
let WEEKLY_INVENTORY_DATA = [];
let WEEKLY_CURRENT_GRADE = 'm1';
let WK_SEL = new Set();
let WK_LOADED_FOR = '';      // 표에 올라온 데이터가 어느 학생 것인지
let WK_LOAD_SEQ = 0;
let WK_SORT = { key: 'source', dir: 1 };
let WK_GROUP_SIZE = new Map(); // 지문 세트 키 → 문항 수 (2 이상이면 세트)

function _wkGradeId(name) {
    const g = WK_GRADES.find(x => x.name === name);
    return g ? g.id : '';
}
function _wkNum(v) {
    const n = parseInt(String(v == null ? '' : v).replace(/[^0-9]/g, ''), 10);
    return isNaN(n) ? 9999 : n;
}
function _wkDiff(row) {
    let d = parseInt(row.difficulty, 10);
    if (isNaN(d) || d < 1) d = 1;
    if (d > 15) d = 15;
    return d;
}
function _wkStudentName(id) {
    const f = (MANAGED_STUDENTS || []).find(s => s.id === id);
    return f ? f.name : id;
}
function _wkWeakTypes() {
    return Array.from(document.querySelectorAll('#weeklyWeakTypeChips .wk-chip.selected')).map(c => String(c.dataset.type || '').trim()).filter(Boolean);
}
function _wkIsWeak(row, weak) {
    const t = String(row.type || '');
    return weak.some(w => t.includes(w));
}
function _wkIsRecent(row) {
    return row.lastAssigned && (Date.now() - row.lastAssigned) < WK_RECENT_MS;
}
function _wkSourceKey(row) {
    return [WK_GRADE_ORDER[row.grade] || 9, _wkNum(row.year), _wkNum(row.month), String(row.month || ''), _wkNum(row.number), String(row.qid)];
}
function _wkCompareSource(a, b) {
    const ka = _wkSourceKey(a), kb = _wkSourceKey(b);
    for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1;
        if (ka[i] > kb[i]) return 1;
    }
    return 0;
}
function _wkDaysAgo(ts) {
    if (!ts) return '';
    const d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? '오늘' : d + '일 전';
}

function switchWkGradeTab(gradeId) {
    WEEKLY_CURRENT_GRADE = gradeId;
    const container = document.getElementById('weeklyGradeTabs');
    if(!container) return;
    container.querySelectorAll('.grade-tab').forEach(el => {
        const clickAttr = el.getAttribute('onclick');
        el.classList.toggle('active', clickAttr ? String(clickAttr).includes("'" + gradeId + "'") : false);
    });
    document.querySelectorAll('#weeklyMakerPage .grade-panel').forEach(el => el.classList.remove('active'));
    const targetPanel = document.getElementById('wk_gp_' + gradeId);
    if(targetPanel) targetPanel.classList.add('active');
}

// 학년 탭에 '범위 안 문항 수' 표시 → 어느 학년에 범위를 걸었는지 한눈에 보이게
function updateWkTabBadges() {
    const container = document.getElementById('weeklyGradeTabs');
    if (!container) return;
    container.querySelectorAll('.grade-tab').forEach(el => {
        const g = WK_GRADES.find(x => String(el.getAttribute('onclick') || '').includes("'" + x.id + "'"));
        if (!g) return;
        const st = weeklySelState[g.id];
        const on = st.years.size > 0 || st.months.size > 0;
        const n = on ? WEEKLY_INVENTORY_DATA.filter(r => r.grade === g.name && _wkInScope(r)).length : 0;
        el.innerHTML = g.name + (on ? `<span class="wk-tab-badge">${n}</span>` : '');
        el.classList.toggle('wk-has-scope', on);
    });
}

function _wkInScope(row) {
    const s = weeklySelState[_wkGradeId(row.grade)];
    if (!s || (s.years.size === 0 && s.months.size === 0)) return false;
    if (s.years.size && !s.years.has(String(row.year))) return false;
    if (s.months.size && !s.months.has(row.month)) return false;
    return true;
}

// 학생을 바꾸면 이전 학생의 표·선택을 즉시 비웁니다. (다른 학생에게 잘못 배부되는 것 방지)
function resetWeeklyView(message) {
    WK_LOAD_SEQ++;
    WEEKLY_INVENTORY_DATA = [];
    WK_SEL.clear();
    WK_LOADED_FOR = '';
    const chips = document.getElementById('weeklyWeakTypeChips');
    if (chips) chips.innerHTML = '<span class="wk-empty">학생을 고르면 표시됩니다.</span>';
    const statusEl = document.getElementById('weeklyAnalysisStatus');
    if (statusEl) statusEl.textContent = message || '학생을 고르면 풀이 기록을 불러옵니다.';
    initWeeklyScopeFilters();
    renderWeeklyTable();
}

function loadWeeklyStudentData(silent) {
    const selectEl = document.getElementById('weeklyStudentSelect');
    const val = selectEl ? selectEl.value : '';
    if(!val) { resetWeeklyView(); return; }

    const name = _wkStudentName(val);
    const statusEl = document.getElementById('weeklyAnalysisStatus');
    const sameStudent = WK_LOADED_FOR === val;
    if (!sameStudent) {
        WEEKLY_INVENTORY_DATA = [];
        WK_SEL.clear();
        WK_LOADED_FOR = '';
        renderWeeklyTable('⏳ 풀이 기록을 불러오는 중입니다...');
    }
    if (!silent && statusEl) statusEl.innerHTML = `<span class="wk-loading">⏳ ${escapeHTML(name)} 학생의 풀이 기록을 불러오는 중...</span>`;

    const seq = ++WK_LOAD_SEQ;
    fetchWeeklyBundle(val, 35).then(bundle => {
        if (seq !== WK_LOAD_SEQ || selectEl.value !== val) return;
        const stats = (bundle && bundle.stats) ? bundle.stats : [];
        const invData = (bundle && bundle.inventory) ? bundle.inventory : [];
        const keepWeak = sameStudent ? _wkWeakTypes() : null;

        WEEKLY_INVENTORY_DATA = invData.filter(q => q && q.qid);
        WK_GROUP_SIZE = new Map();
        WEEKLY_INVENTORY_DATA.forEach(r => { const g = String(r.groupHash || r.qid); WK_GROUP_SIZE.set(g, (WK_GROUP_SIZE.get(g) || 0) + 1); });
        WK_LOADED_FOR = val;
        // 남아 있는 선택 중 목록에 없는 문항은 정리
        const ids = new Set(WEEKLY_INVENTORY_DATA.map(r => String(r.qid)));
        Array.from(WK_SEL).forEach(q => { if (!ids.has(q)) WK_SEL.delete(q); });

        const solvedN = WEEKLY_INVENTORY_DATA.filter(r => r.isSolved).length;
        if (!stats.length) {
            if (statusEl) statusEl.innerHTML = `📝 <b>${escapeHTML(name)}</b> · 최근 35일 풀이 기록이 없어 전체 유형을 보여 줍니다.`;
            renderWkDefaultChips(keepWeak);
        } else {
            if (statusEl) statusEl.innerHTML = `✅ <b>${escapeHTML(name)}</b> · 푼 문항 ${solvedN}개 · 정답률 40% 이하 유형을 자동으로 표시했습니다.`;
            renderWkWeakChips(stats.map(s => ({ type: s.type, rate: s.rate })), keepWeak);
        }
        initWeeklyScopeFilters();
        renderWeeklyTable();
    }, err => {
        if (seq !== WK_LOAD_SEQ) return;
        if (statusEl) statusEl.innerHTML = '<span style="color:#dc2626;">❌ 불러오지 못했습니다. [다시 불러오기]를 눌러 주세요.</span>';
        renderWeeklyTable('불러오지 못했습니다: ' + escapeHTML(String(err)));
    });
}

function renderWkWeakChips(items, keepWeak) {
    const box = document.getElementById('weeklyWeakTypeChips');
    if (!box) return;
    box.innerHTML = '';
    items.forEach(it => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'wk-chip';
        btn.dataset.type = it.type;
        const hasRate = typeof it.rate === 'number';
        if (hasRate) btn.classList.add(it.rate <= 40 ? 'low' : it.rate <= 70 ? 'mid' : 'high');
        const on = keepWeak ? keepWeak.includes(it.type) : (hasRate && it.rate <= 40);
        if (on) btn.classList.add('selected');
        btn.innerHTML = `<span class="wk-chip-type">${escapeHTML(it.type)}</span>` + (hasRate ? `<span class="wk-chip-rate">${it.rate}%</span>` : '');
        btn.onclick = () => { btn.classList.toggle('selected'); renderWeeklySummary(); };
        box.appendChild(btn);
    });
    if (!items.length) box.innerHTML = '<span class="wk-empty">유형 정보가 없습니다.</span>';
}

function renderWkDefaultChips(keepWeak) {
    const apply = types => renderWkWeakChips((types || []).map(t => ({ type: t })), keepWeak);
    if (SOURCE_FILTERS_CACHE && SOURCE_FILTERS_CACHE.types) {
        apply(SOURCE_FILTERS_CACHE.types);
    } else {
        // 서버를 다시 부르지 않고 문항 목록에 있는 유형으로 먼저 표시
        apply([...new Set(WEEKLY_INVENTORY_DATA.map(r => r.type).filter(Boolean))].sort());
    }
}

function initWeeklyScopeFilters() {
    const renderWkFilterChips = (containerId, items, category, stateObj, onChangeFn) => {
        const box = document.getElementById(containerId);
        if(!box) return;
        box.innerHTML = '';
        if (!items.length) { box.innerHTML = '<span class="wk-empty">없음</span>'; return; }

        const allBtn = document.createElement('span');
        allBtn.className = 'inv-chip'; allBtn.textContent = '전체';
        const currentSet = stateObj[category];
        const updateAll = () => { allBtn.classList.toggle('selected', items.length > 0 && items.every(i => currentSet.has(i))); };

        allBtn.onclick = () => {
            if(allBtn.classList.contains('selected')) currentSet.clear();
            else items.forEach(i => currentSet.add(i));
            renderWkFilterChips(containerId, items, category, stateObj, onChangeFn);
            onChangeFn();
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
                onChangeFn();
            };
            box.appendChild(chip);
        });
        updateAll();
    };

    const sortNum = arr => arr.sort((a, b) => (_wkNum(a) - _wkNum(b)) || String(a).localeCompare(String(b)));
    const updateWkCascading = (gId, gName, skipRender) => {
        const state = weeklySelState[gId];
        const gradeData = WEEKLY_INVENTORY_DATA.filter(x => x.grade === gName);
        const gYears = sortNum([...new Set(gradeData.map(x => String(x.year)).filter(Boolean))]);
        // 목록에 없는 연도 선택은 정리
        Array.from(state.years).forEach(y => { if (gradeData.length && !gYears.includes(y)) state.years.delete(y); });

        let monthData = gradeData;
        if (state.years.size > 0) monthData = monthData.filter(x => state.years.has(String(x.year)));
        const gMonths = sortNum([...new Set(monthData.map(x => x.month).filter(Boolean))]);

        renderWkFilterChips('wkYearChips_' + gId, gYears, 'years', state, () => updateWkCascading(gId, gName, false));
        renderWkFilterChips('wkMonthChips_' + gId, gMonths, 'months', state, () => renderWeeklyTable());
        if (!skipRender) renderWeeklyTable();
    };

    WK_GRADES.forEach(g => updateWkCascading(g.id, g.name, true));
    updateWkTabBadges();
}

function _wkSortValue(row, key) {
    switch (key) {
        case 'number': return _wkNum(row.number);
        case 'type': return String(row.type || '');
        case 'difficulty': return _wkDiff(row);
        case 'status': return row.isSolved ? (row.wrongCount > 0 ? 1 : 2) : 0;
        case 'wrong': return row.wrongCount || 0;
        case 'assign': return row.assignCount || 0;
        default: return 0;
    }
}

function renderWeeklyTable(message) {
    const tbody = document.getElementById('weeklyInvTbody');
    if(!tbody) return;
    updateWkTabBadges();
    _wkBindHeaderOnce();

    const showMsg = html => {
        tbody.innerHTML = `<tr class="wk-msg"><td colspan="8">${html}</td></tr>`;
        updateWkCount();
    };
    if (message) return showMsg(message);
    if (!WK_LOADED_FOR || WEEKLY_INVENTORY_DATA.length === 0) return showMsg('학생을 고르고 왼쪽에서 출제 범위를 정해 주세요.');

    const onlySel = document.getElementById('chkWkOnlySelected') && document.getElementById('chkWkOnlySelected').checked;
    const excludeSolved = document.getElementById('chkWkExcludeSolved') && document.getElementById('chkWkExcludeSolved').checked;
    const hasScope = WK_GRADES.some(g => weeklySelState[g.id].years.size || weeklySelState[g.id].months.size);
    if (!hasScope && !onlySel) return showMsg('왼쪽 <b>② 출제 범위</b>에서 학년 탭을 눌러 연도나 월을 골라 주세요.');

    const rows = WEEKLY_INVENTORY_DATA.filter(row => {
        if (onlySel) return WK_SEL.has(String(row.qid));
        if (excludeSolved && row.isSolved) return false;
        return _wkInScope(row);
    });
    if (!rows.length) return showMsg(onlySel ? '선택한 문항이 없습니다.' : '조건에 맞는 문항이 없습니다. 범위를 넓혀 보세요.');

    const k = WK_SORT.key, dir = WK_SORT.dir;
    rows.sort((a, b) => {
        if (k !== 'source') {
            const va = _wkSortValue(a, k), vb = _wkSortValue(b, k);
            const c = (typeof va === 'number') ? va - vb : String(va).localeCompare(String(vb));
            if (c) return c * dir;
        }
        return _wkCompareSource(a, b) * (k === 'source' ? dir : 1);
    });

    const weak = _wkWeakTypes();
    const html = rows.map(row => {
        const qid = String(row.qid);
        const sel = WK_SEL.has(qid);
        let stat;
        if (!row.isSolved) stat = '<span class="wk-st none">미풀이</span>';
        else if (row.wrongCount > 0) stat = '<span class="wk-st warn">오답 있음</span>';
        else stat = '<span class="wk-st ok">완료</span>';
        const wrong = row.wrongCount > 0 ? `<span class="wk-wrong">${row.wrongCount}회</span>` : '<span class="wk-dash">-</span>';
        const recent = _wkIsRecent(row);
        const asg = row.assignCount > 0
            ? `<span class="wk-asg${recent ? ' recent' : ''}" title="마지막 배부: ${_wkDaysAgo(row.lastAssigned)}">${row.assignCount}회${recent ? ' · ' + _wkDaysAgo(row.lastAssigned) : ''}</span>`
            : '<span class="wk-dash">-</span>';
        const src = [row.grade, row.year, row.month, row.detail].filter(Boolean).join(' ');
        const isWeak = weak.length && _wkIsWeak(row, weak);
        const grouped = (WK_GROUP_SIZE.get(String(row.groupHash || row.qid)) || 0) > 1;
        return `<tr class="wk-row${sel ? ' selected' : ''}" data-qid="${escapeHTML(qid)}">
          <td class="c-chk"><input type="checkbox" class="wk-check" value="${escapeHTML(qid)}"${sel ? ' checked' : ''}></td>
          <td class="c-src">${escapeHTML(src)}${grouped ? ' <span class="wk-set" title="같은 지문 세트는 함께 선택됩니다">세트</span>' : ''}</td>
          <td class="c-num">${escapeHTML(String(row.number || ''))}</td>
          <td class="c-type">${isWeak ? '<span class="wk-weak-dot" title="취약 유형">●</span>' : ''}${escapeHTML(row.type || '-')}</td>
          <td class="c-diff"><span class="wk-diff">${escapeHTML(String(row.difficulty || '-'))}</span></td>
          <td class="c-stat">${stat}</td>
          <td class="c-wrong">${wrong}</td>
          <td class="c-asg">${asg}</td>
        </tr>`;
    }).join('');
    tbody.innerHTML = html;
    updateWkCount();
}

// 같은 지문 세트(groupHash)는 함께 선택/해제
function _wkToggleQid(qid, on) {
    const row = WEEKLY_INVENTORY_DATA.find(r => String(r.qid) === qid);
    const g = row ? String(row.groupHash || row.qid) : qid;
    WEEKLY_INVENTORY_DATA.forEach(r => {
        if (String(r.groupHash || r.qid) === g || String(r.qid) === qid) {
            if (on) WK_SEL.add(String(r.qid)); else WK_SEL.delete(String(r.qid));
        }
    });
}

let _wkBound = false;
function _wkBindHeaderOnce() {
    if (_wkBound) return;
    const table = document.getElementById('weeklyInvTable');
    const tbody = document.getElementById('weeklyInvTbody');
    if (!table || !tbody) return;
    _wkBound = true;

    tbody.addEventListener('click', e => {
        const tr = e.target.closest('tr.wk-row');
        if (!tr) return;
        const qid = tr.dataset.qid;
        const on = e.target.classList.contains('wk-check') ? e.target.checked : !WK_SEL.has(qid);
        _wkToggleQid(qid, on);
        // 다시 그리지 않고 해당 행들만 갱신 (스크롤 위치 유지)
        tbody.querySelectorAll('tr.wk-row').forEach(r => {
            const s = WK_SEL.has(r.dataset.qid);
            r.classList.toggle('selected', s);
            const cb = r.querySelector('.wk-check');
            if (cb) cb.checked = s;
        });
        updateWkCount();
    });

    const all = document.getElementById('weeklyCheckAll');
    if (all) all.addEventListener('change', () => {
        tbody.querySelectorAll('tr.wk-row').forEach(r => _wkToggleQid(r.dataset.qid, all.checked));
        renderWeeklyTable();
    });

    table.querySelectorAll('th[data-wsort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.wsort;
            if (WK_SORT.key === key) WK_SORT.dir *= -1;
            else WK_SORT = { key: key, dir: (key === 'source' || key === 'number' || key === 'type' || key === 'difficulty') ? 1 : -1 };
            renderWeeklyTable();
        });
    });
}

function clearWeeklySelection() {
    WK_SEL.clear();
    renderWeeklyTable();
}

function updateWkCount() {
    const n = WK_SEL.size;
    const display = document.getElementById('weeklySelectedCount');
    if (display) {
        display.innerText = n;
        const box = display.closest('.wk-count');
        if (box) box.className = 'wk-count' + (n === WK_TARGET ? ' ok' : n > WK_TARGET ? ' over' : '');
    }
    const all = document.getElementById('weeklyCheckAll');
    if (all) {
        const vis = Array.from(document.querySelectorAll('#weeklyInvTbody tr.wk-row'));
        all.checked = vis.length > 0 && vis.every(r => WK_SEL.has(r.dataset.qid));
    }
    // 표 헤더 정렬 표시
    document.querySelectorAll('#weeklyInvTable th[data-wsort]').forEach(th => {
        th.classList.toggle('sorted', th.dataset.wsort === WK_SORT.key);
        th.dataset.dir = th.dataset.wsort === WK_SORT.key ? (WK_SORT.dir > 0 ? '▲' : '▼') : '';
    });
    renderWeeklySummary();
}

function _wkSelectedRows() {
    return WEEKLY_INVENTORY_DATA.filter(r => WK_SEL.has(String(r.qid)));
}

function renderWeeklySummary() {
    const box = document.getElementById('weeklySummary');
    if (!box) return;
    const rows = _wkSelectedRows();
    if (!rows.length) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = '';
    const byDiff = {};
    rows.forEach(r => { const d = _wkDiff(r); byDiff[d] = (byDiff[d] || 0) + 1; });
    const avg = rows.reduce((a, r) => a + _wkDiff(r), 0) / rows.length;
    const weak = _wkWeakTypes();
    const weakN = weak.length ? rows.filter(r => _wkIsWeak(r, weak)).length : 0;
    const unsolved = rows.filter(r => !r.isSolved).length;
    const recentN = rows.filter(_wkIsRecent).length;
    const diffs = Object.keys(byDiff).map(Number).sort((a, b) => a - b)
        .map(d => `<span class="wk-sum-diff"><b>${d}</b>단계 ${byDiff[d]}</span>`).join('');
    box.innerHTML = `
      <span class="wk-sum-item">평균 난이도 <b>${avg.toFixed(1)}</b></span>
      <span class="wk-sum-item wk-sum-diffs">${diffs}</span>
      ${weak.length ? `<span class="wk-sum-item">취약 유형 <b>${weakN}</b>문항</span>` : ''}
      <span class="wk-sum-item">미풀이 <b>${unsolved}</b>문항</span>
      ${recentN ? `<span class="wk-sum-item warn">최근 4주 배부 <b>${recentN}</b>문항</span>` : ''}`;
}

/* 자동 선택: 범위 안 문항을 지문 세트 단위로 묶어
 * ① 중심 난이도 ±2 분포(2·4·8·4·2) ② 취약 유형 우선 ③ 정확히 20문항을 넘지 않게 고릅니다.
 */
function runWeeklyAutoSelection() {
    if (!WK_LOADED_FOR || !WEEKLY_INVENTORY_DATA.length) { showCustomAlert('먼저 학생을 골라 풀이 기록을 불러와 주세요.'); return; }
    const targetLevel = parseInt(document.getElementById('weeklyLevelSlider').value, 10) || 5;
    const excludeSolved = document.getElementById('chkWkExcludeSolved') && document.getElementById('chkWkExcludeSolved').checked;
    const skipRecent = document.getElementById('chkWkSkipRecent') && document.getElementById('chkWkSkipRecent').checked;

    const inScope = WEEKLY_INVENTORY_DATA.filter(_wkInScope);
    if (!inScope.length) { showCustomAlert('왼쪽 ② 출제 범위에서 학년 탭을 눌러 연도나 월을 먼저 골라 주세요.'); return; }

    const pool = inScope.filter(r => !(excludeSolved && r.isSolved) && !(skipRecent && _wkIsRecent(r)));
    const weak = _wkWeakTypes();

    // 지문 세트 묶기 (세트 중 하나라도 빠지는 조건이면 세트 전체를 뺌)
    const poolIds = new Set(pool.map(r => String(r.qid)));
    const groups = new Map();
    inScope.forEach(r => {
        const g = String(r.groupHash || r.qid);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(r);
    });
    const cands = [];
    groups.forEach(items => {
        if (!items.every(r => poolIds.has(String(r.qid)))) return;
        const diff = Math.round(items.reduce((a, r) => a + _wkDiff(r), 0) / items.length);
        cands.push({ items: items, size: items.length, diff: diff, weak: items.some(r => _wkIsWeak(r, weak)), rnd: Math.random() });
    });

    const need = {};
    const dist = [[0, 8], [-1, 4], [1, 4], [-2, 2], [2, 2]];
    dist.forEach(([off, n]) => {
        const l = Math.min(15, Math.max(1, targetLevel + off));
        need[l] = (need[l] || 0) + n;
    });

    const picked = [];
    let total = 0;
    const used = new Set();
    const take = c => { used.add(c); picked.push(c); total += c.size; };
    const byPref = (a, b) => (b.weak - a.weak) || (a.size - b.size) || (a.rnd - b.rnd);

    // 1차: 난이도별 필요 수만큼 (중심 난이도부터)
    dist.map(([off]) => Math.min(15, Math.max(1, targetLevel + off)))
        .filter((l, i, arr) => arr.indexOf(l) === i)
        .forEach(l => {
            cands.filter(c => c.diff === l && !used.has(c)).sort(byPref).forEach(c => {
                if (need[l] >= c.size && total + c.size <= WK_TARGET) { take(c); need[l] -= c.size; }
            });
        });
    // 2차: 모자라면 중심 난이도에 가까운 순으로 채움
    cands.filter(c => !used.has(c))
        .sort((a, b) => (Math.abs(a.diff - targetLevel) - Math.abs(b.diff - targetLevel)) || byPref(a, b))
        .forEach(c => { if (total + c.size <= WK_TARGET) take(c); });

    WK_SEL.clear();
    picked.forEach(c => c.items.forEach(r => WK_SEL.add(String(r.qid))));
    const onlySel = document.getElementById('chkWkOnlySelected');
    if (onlySel) onlySel.checked = false;
    WK_SORT = { key: 'source', dir: 1 };
    renderWeeklyTable();

    // 선택된 첫 행이 보이게
    const first = document.querySelector('#weeklyInvTbody tr.wk-row.selected');
    if (first) first.scrollIntoView({ block: 'nearest' });

    if (total < WK_TARGET) {
        const why = [];
        if (skipRecent) why.push('최근 4주 배부 문항 빼기');
        if (excludeSolved) why.push('안 푼 문제만');
        showToast(`범위 안 문항이 부족해 ${total}문항만 골랐습니다.` + (why.length ? ` (${why.join(', ')} 조건을 풀거나 범위를 넓혀 보세요)` : ' 범위를 넓혀 보세요.'), 'error');
    } else {
        showToast(`${total}문항을 골랐습니다. 표에서 확인하고 바꿀 수 있습니다.`);
    }
}

// 배부하고 인쇄
function submitWeeklyFinal() {
    const selectEl = document.getElementById('weeklyStudentSelect');
    const tId = selectEl ? selectEl.value : '';
    if (!tId) { showCustomAlert('학생을 먼저 골라 주세요.'); return; }
    if (WK_LOADED_FOR !== tId) { showCustomAlert('선택한 학생의 기록을 아직 불러오지 않았습니다. 잠시 후 다시 눌러 주세요.'); return; }
    const rows = _wkSelectedRows().sort(_wkCompareSource);
    if (!rows.length) { showCustomAlert('배부할 문항을 골라 주세요.'); return; }

    const name = _wkStudentName(tId);
    const userObj = { id: tId, name: name };
    const qids = rows.map(r => String(r.qid));
    const level = Math.round(rows.reduce((a, r) => a + _wkDiff(r), 0) / rows.length);
    const nowD = new Date();
    const firstDay = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
    const weekStr = Math.ceil((nowD.getDate() + firstDay.getDay()) / 7) + '주차';
    const titleInput = document.getElementById('weeklyTitleInput');
    const customTitle = (titleInput && titleInput.value.trim()) || `${name} 주간평가(Lv.${level}) - ${nowD.getMonth() + 1}월 ${weekStr}`;
    const warn = rows.length !== WK_TARGET ? `\n(권장 20문항과 다릅니다: ${rows.length}문항)` : '';

    showCustomConfirm(`${name} 학생에게 주간평가 ${rows.length}문항을 배부하고 시험지를 엽니다.\n제목: ${customTitle}${warn}`, function() {
        const loadEl = document.getElementById('loadingOverlay');
        if (loadEl) {
            loadEl.querySelector('.loading-text').innerHTML = '주간평가를 배부하고 시험지를 만드는 중...';
            loadEl.classList.add('active');
        }
        const done = () => { if (loadEl) loadEl.classList.remove('active'); };
        google.script.run.withSuccessHandler(res => {
            if (res && res.error) { done(); showCustomAlert('배부 실패: ' + res.error); return; }
            ADMIN_HISTORY_CACHE = [];
            const printName = `${name}(${tId})`;
            const finish = realQs => {
                done();
                renderQuestionsForPrint(realQs, customTitle, null, printName);
                // 같은 시험을 두 번 내지 않도록 선택·제목을 비우고, 배부 횟수를 다시 받아 옵니다.
                WK_SEL.clear();
                if (titleInput) titleInput.value = '';
                renderWeeklyTable();
                loadWeeklyStudentData(true);
            };
            if (res && Array.isArray(res.qs)) { finish(res.qs); return; }
            google.script.run.withSuccessHandler(finish).withFailureHandler(err => {
                done(); showCustomAlert('문항을 불러오지 못했습니다: ' + err);
            }).getQuestionsByQids(qids);
        }).withFailureHandler(err => {
            done(); showCustomAlert('배부 실패: ' + err);
        }).createAssignment(userObj, customTitle, qids, true);
    });
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


/* ===================== 문항 목록(공통) + 학생 풀이 통계(학생별) 분리 로딩 =====================
 * 문항 목록은 학생과 무관하므로 브라우저에 저장해 두고, 서버의 인덱스 버전이 바뀐 경우에만 새로 받습니다.
 * 학생을 바꿀 때는 그 학생의 풀이 통계(작은 데이터)만 받아 합칩니다.
 */
const QMETA_KEY = 'qmeta';
let QMETA_MEM = null;      // { version, rows, checked }
let QMETA_PENDING = null;

function loadQuestionMeta() {
  if (QMETA_MEM && QMETA_MEM.checked) return Promise.resolve(QMETA_MEM.rows); // 이번 접속에서 확인 완료
  if (QMETA_PENDING) return QMETA_PENDING;
  const saved = swrRead(QMETA_KEY, 'global');
  const known = (saved && saved.v && Array.isArray(saved.v.rows)) ? saved.v.version : '';
  QMETA_PENDING = gsCall('getQuestionMetaIndex', [known]).then(res => {
    if (res && res.unchanged && known) {
      QMETA_MEM = { version: known, rows: saved.v.rows, checked: true };
    } else if (res && Array.isArray(res.rows)) {
      QMETA_MEM = { version: res.version, rows: res.rows, checked: true };
      swrWrite(QMETA_KEY, 'global', { version: res.version, rows: res.rows });
    } else {
      throw new Error('문항 목록 형식 오류');
    }
    return QMETA_MEM.rows;
  });
  QMETA_PENDING.then(() => { QMETA_PENDING = null; }, () => { QMETA_PENDING = null; });
  return QMETA_PENDING;
}

function invalidateQuestionMeta() {
  QMETA_MEM = null;
  swrInvalidate(QMETA_KEY, 'global');
}

// 서버 getAdminQuestionInventory와 같은 모양의 행으로 합칩니다.
function buildInventoryRows(metaRows, qstats, acounts, alast) {
  qstats = qstats || {};
  acounts = acounts || {};
  alast = alast || {};
  return (metaRows || []).map(m => {
    const qid = m[0], extId = m[7] || '', linkedId = m[8] || '';
    const st = qstats[String(extId).trim()] || qstats[qid] || null;
    return {
      qid: qid, grade: m[1], year: m[2], month: m[3], detail: m[4], type: m[5], difficulty: m[6],
      number: extId, isSolved: st ? st[0] === 1 : false, wrongCount: st ? st[1] : 0,
      lastTs: st ? st[2] : null, groupHash: linkedId || extId || qid,
      assignCount: acounts[qid] || 0, lastAssigned: alast[qid] || 0
    };
  });
}

// 관리자 '불러오기'용. 새 서버 함수가 없으면(구버전 GS) 기존 통합 함수로 대체합니다.
function fetchInventoryRows(studentId) {
  return Promise.all([loadQuestionMeta(), gsCall('getStudentQuestionStats', [studentId])])
    .then(([meta, st]) => buildInventoryRows(meta, st && st.qstats, st && st.acounts, st && st.alast))
    .catch(err => {
      if (isMissingServerFunction(err)) return gsCall('getAdminQuestionInventory', [studentId]);
      throw err;
    });
}

// 주간평가 '학생 데이터 로드'용
function fetchWeeklyBundle(studentId, days) {
  return Promise.all([loadQuestionMeta(), gsCall('loadWeeklyStudentStats', [studentId, days])])
    .then(([meta, r]) => ({ stats: (r && r.stats) || [], inventory: buildInventoryRows(meta, r && r.qstats, r && r.acounts, r && r.alast) }))
    .catch(err => {
      if (isMissingServerFunction(err)) return gsCall('loadWeeklyStudentBundle', [studentId, days]);
      throw err;
    });
}


/* 출제 성공 후 정리: 같은 과제를 실수로 두 번 내지 않도록 바구니·체크·제목을 비우고,
 * 현재 학생의 완료/배부 상태를 뒤에서 다시 받아 목록에 반영합니다. (고른 필터는 그대로 유지)
 */
function resetMakerAfterAssign() {
  MAKER_CART.clear();
  updateCartUI();
  const panel = document.getElementById('cartListPanel');
  if (panel && panel.classList.contains('open')) toggleCartList();
  const titleInput = document.getElementById('customTitleInput');
  if (titleInput) titleInput.value = '';
  document.querySelectorAll('#invTbody .inv-check:checked').forEach(cb => { cb.checked = false; });
  const chkAll = document.getElementById('invCheckAll');
  if (chkAll) chkAll.checked = false;
  renderInventoryTable();
  refreshInventoryStats();
}

function refreshInventoryStats() {
  const selectEl = document.getElementById('targetStudentSelect');
  const val = selectEl ? selectEl.value : '';
  if (!val || !INVENTORY_DATA.length) return;
  const seq = ++INVENTORY_REQUEST_SEQUENCE;
  const user = CURRENT_USER;
  fetchInventoryRows(val).then(data => {
    if (seq !== INVENTORY_REQUEST_SEQUENCE || CURRENT_USER !== user || selectEl.value !== val) return;
    const rows = (data || []).filter(q => q && q.qid);
    if (!rows.length) return;
    INVENTORY_DATA = rows;
    renderInventoryTable();
  }).catch(err => console.log('출제 후 상태 갱신 실패', err));
}
