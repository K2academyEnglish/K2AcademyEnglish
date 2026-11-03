/* [수정] 출력 버튼 클릭 시 실행되는 함수 */

/* [수정됨] 모의고사 스타일 인쇄 렌더링 함수 */
/* [긴급 수정] 인쇄 레이아웃 시작선 완전 일치 및 선택지 그리드 최적화 */
/* [완전 해결] 인쇄 레이아웃 정렬 및 선택지 계단 현상 수정 */
function renderQuestionsForPrint(qs, pageTitle, dateInput, studentName){
  const printZone = document.getElementById('printSection');
  printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  printZone.innerHTML = '';

  const controlsHTML = `
    <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
      <div style="font-size: 16px; font-weight: bold;">🖥️ 리포트 미리보기</div>
      <div style="display:flex; gap:10px;">
        <button id="btnPrintAnswers" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">📑 정답지 보기</button>
        <button id="btnPrintAction" disabled style="background: #9ca3af; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: not-allowed; font-weight: bold; font-size: 14px; white-space: nowrap;">⏳ 이미지 대기중...</button>
        <button onclick="closePrintPreview()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height: 60px;"></div>
  `;

  let dateStr = "";
  if (dateInput) {
      const d = new Date(dateInput);
      dateStr = isNaN(d.getTime()) ? String(dateInput).substring(0, 10) : (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  } else {
                  const today = new Date();
                  dateStr = (today.getMonth() + 1) + '월 ' + today.getDate() + '일';
              }

              // [글자 수 기반 폰트 크기 계산]
              const rawTitle = pageTitle ? pageTitle : '문제 제목';
              const titleLen = rawTitle.length;
              let titleFontSize = 18;
              if (titleLen > 85) titleFontSize = 10;
              else if (titleLen > 70) titleFontSize = 12;
              else if (titleLen > 60) titleFontSize = 14;
              else if (titleLen > 50) titleFontSize = 16;

              const headerHTML = `
                <div class="exam-header" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px; position: relative;">
                  <div style="flex: 1; margin-right: 15px; height: 50px; display: flex; align-items: flex-end;">
                    <div style="font-size: ${titleFontSize}px; font-weight: bold; text-align: left; line-height: 1.3; width: 100%; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                      ${sanitizeInlineHTML(rawTitle)}
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; justify-content: space-between; height: 50px; text-align: right; font-size: 17px; font-weight: bold; line-height: 1.1; position: relative; z-index: 10; flex-shrink: 0;">
                    <div>${dateStr}</div>
                    <div>${studentName ? sanitizeInlineHTML(studentName) : '이름: _________'}</div>
                  </div>
                </div>
              `;
              let bodyHTML = '<div class="exam-columns">';
  const symbols = ['①','②','③','④','⑤'];
  const groups = new Map();
  qs.forEach((q, idx)=>{
    // groupHash가 있을 때만 연계로 묶고, 없으면 지문 내용이 같아도 개별 분리
    let key = q.groupHash ? q.groupHash : 'ID:' + (q.extId || q.qid || idx);
    if(!groups.has(key)) groups.set(key, { passage: [q.box1,q.box2,q.box3,q.box4], items: [] });
    groups.get(key).items.push({ q, idx: idx + 1 });
  });

  let qNum = 0;
      groups.forEach((group) => {
        bodyHTML += `<div class="exam-q-block">`;
        
        const p1 = group.passage[0] ? sanitizeInlineHTML(group.passage[0]) : '';
        const p2 = group.passage[1] ? sanitizeInlineHTML(group.passage[1]) : '';
        const p3 = group.passage[2] ? sanitizeInlineHTML(group.passage[2]) : '';
        const p4 = group.passage[3] ? sanitizeInlineHTML(group.passage[3]) : '';
        
        // 지문 통합 로직 추가
        const combinedPassage = [p1, p2, p3, p4].filter(p => p.trim() !== '').join('<div style="height:6px;"></div>');

        const isMulti = group.items.length > 1;
        const makePBox = (html) => html ? `<div class="exam-passage ${isMulti ? 'boxed' : ''}">${html}</div>` : '';
        // [수정] 지문이 길 경우 단(Column) 분할은 허용(auto)하고, 페이지 분할만 방지합니다.
        const wrapAvoid = (html) => html ? `<div style="break-inside: auto !important; page-break-inside: avoid !important;">${html}</div>` : '';

        if (isMulti) {
            // 연계 문제 분절 로직
            const startNum = qNum + 1;
            const endNum = qNum + group.items.length; 
            const rangeHTML = `<div class="exam-q-range-title">[${startNum} ~ ${endNum}] 다음 글을 읽고, 물음에 답하시오.</div>`;
            
            // 첫 번째 문항과 공통 지문을 하나로 묶어 페이지 갈라짐 방지
            let firstItemHtml = '';
            const firstItem = group.items[0];
            if (firstItem) {
                qNum++; const q = firstItem.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                firstItemHtml += `<div class="exam-q-id"><span>${escapeHTML(displayId)}</span><span style="font-weight: bold;">${q.difficulty ? `Lv. ${q.difficulty}` : ''}</span></div>`;
                firstItemHtml += `<div class="exam-q-title-row"><span class="exam-q-num">${qNum}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) firstItemHtml += extractedBox;
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   let optHtml = `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) optHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   optHtml += `</div>`;
                   firstItemHtml += optHtml;
                }
            }

            // 범위 타이틀 + 공통 지문 + 첫 번째 문항을 하나의 묶음(wrapAvoid)으로 처리
            let multiFirstChunk = rangeHTML;
            if (combinedPassage) multiFirstChunk += makePBox(combinedPassage);
            multiFirstChunk += firstItemHtml;
            bodyHTML += wrapAvoid(multiFirstChunk);
            
            // 두 번째 문항부터 순차 루프
            group.items.forEach((item, i) => {
                if (i === 0) return; // 첫 번째 문항은 위에서 처리했으므로 건너뜀
                qNum++; const q = item.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                let qHtml = `<div class="exam-q-id"><span>${escapeHTML(displayId)}</span><span style="font-weight: bold;">${q.difficulty ? `Lv. ${q.difficulty}` : ''}</span></div>`;
                qHtml += `<div class="exam-q-title-row"><span class="exam-q-num">${qNum}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) qHtml += extractedBox;
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   qHtml += `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) qHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   qHtml += `</div>`;
                }
                bodyHTML += wrapAvoid(qHtml);
                if(i < group.items.length - 1) bodyHTML += `<div style="height:8px;"></div>`;
            });
        } else {
            // 단일 문제 분절 로직
            group.items.forEach((item, i) => {
                qNum++; const q = item.q;
                let preservedHTML = sanitizeInlineHTML(q.question).replace(/^\d+[\.．]\s*/, '');
                let displayId = q.extId ? q.extId : (q.qid ? q.qid : '');
                
                let extractedBox = '';
                const boxRegex = /<div class="exam-q-box">([\s\S]*?)<\/div>/i;
                const boxMatch = preservedHTML.match(boxRegex);
                if (boxMatch) {
                    extractedBox = boxMatch[0];
                    preservedHTML = preservedHTML.replace(boxRegex, '');
                }
                let finalQText = toOneLine(preservedHTML).trim();
                
                let chunk1 = `<div class="exam-q-id"><span>${escapeHTML(displayId)}</span><span style="font-weight: bold;">${q.difficulty ? `Lv. ${q.difficulty}` : ''}</span></div>`;
                chunk1 += `<div class="exam-q-title-row"><span class="exam-q-num">${qNum}</span><span class="exam-q-text">${finalQText}</span></div>`;
                if (extractedBox) chunk1 += extractedBox;
                if (combinedPassage) chunk1 += makePBox(combinedPassage);
                
                if(q.options && q.options.some(o=>o.trim())) {
                   let maxVisualLen = 0;
                   q.options.forEach(opt => {
                       const cleanOpt = String(opt).replace(/<[^>]*>?/gm, '');
                       let visualLen = 0;
                       for (let j = 0; j < cleanOpt.length; j++) {
                           visualLen += (cleanOpt.charCodeAt(j) > 127) ? 3 : 1;
                       }
                       if (visualLen > maxVisualLen) maxVisualLen = visualLen;
                   });
                   let gridClass = maxVisualLen <= 5 ? ' grid-5' : (maxVisualLen <= 10 ? ' grid-3' : (maxVisualLen <= 20 ? ' grid-2' : ' grid-1'));
                   
                   let optHtml = `<div class="exam-options${gridClass}">`;
                   q.options.forEach((opt, optIdx)=>{ 
                      if(opt.trim()) optHtml += `<div class="exam-opt-row"><span class="exam-opt-num">${symbols[optIdx]}</span><span class="exam-opt-text">${sanitizeInlineHTML(opt)}</span></div>`; 
                   });
                   optHtml += `</div>`;
                   chunk1 += optHtml;
                }
                bodyHTML += wrapAvoid(chunk1);
            });
        }
        bodyHTML += `</div>`;
      });
  bodyHTML += '</div>';

              // [수정] 테이블 충돌 없이 매 페이지 상단 헤더(제목+QR), 하단 로고, 1페이지 메인 헤더 배치
  const qrUrl = 'https://' + 'i.imgur.com/R9QpYH9.jpeg';
  const logoUrl = 'https://' + 'i.imgur.com/NVHBqH2.png';

  const pageLayoutHTML = `
    <div style="position: relative; width: 100%; height: auto;">
      <div class="print-running-header no-print-img-bug">
        <span class="running-title-txt">${sanitizeInlineHTML(rawTitle)}</span>
      </div>

      ${headerHTML}

      <div class="exam-body-wrap">
        ${bodyHTML}
      </div>

      <div class="print-running-footer no-print-img-bug">
        <img class="running-qr-img" src="${qrUrl}" alt="QR">
        <img class="running-logo-img" src="${logoUrl}" alt="Logo">
      </div>
    </div>
  `;

  printZone.innerHTML = controlsHTML + pageLayoutHTML;

  const printStyle = document.createElement('style');
  printStyle.innerHTML = `
    /* 출력용 강력한 색상 보존 */
    #printSection .txt-red { color: #dc2626 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-blue { color: #2b6cb0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-green { color: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    #printSection .txt-orange { color: #d97706 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .exam-passage, .exam-q-box {
        font-family: "Times New Roman", serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        text-align: justify !important;
        background: transparent !important;
    }

    .exam-q-box {
        border: 1px solid #000 !important;
        padding: 10px !important;
        margin: 10px 0 !important;
        display: block !important;
    }

    /* 미리보기에서도 이미지를 미리 디코딩하도록 display:none 대신 투명 처리 */
    .print-running-header {
        display: flex;
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 12mm;
        padding: 0 20mm; /* 좌우 2cm 여백 */
        box-sizing: border-box;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
    }
    .running-title-txt {
        flex: 1;
        font-size: 10pt;
        font-weight: bold;
        color: #6b7280;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .print-running-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0;
        width: 100%;
        box-sizing: border-box;
    }
    #printSection .running-qr-img,
    #printSection .running-logo-img {
        height: 11mm !important;
        max-height: 11mm !important;
        width: auto !important;
        margin: 0 !important;
        border: none !important;
        display: block !important;
        object-fit: contain !important;
    }

    @media print {
      @page { size: A4; margin: 10mm 15mm 10mm 15mm !important; }
      
      html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; display: block !important; background: #fff !important; }
      #printSection { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }

      /* 매 페이지 상단 반복 헤더 (2페이지부터 노출, 좌우 2cm 여백 적용) */
      .print-running-header {
          display: flex !important;
          position: fixed !important;
          top: 0 !important;
          bottom: auto !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: 12mm !important;
          padding: 0 20mm !important;
          opacity: 1 !important;
          background: #ffffff !important;
          justify-content: center !important;
          align-items: center !important;
          border-bottom: 1px solid #ccc !important;
          z-index: 500 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 매 페이지 최하단 좌측 QR / 우측 학원 로고 고정 (하단 여백 최대 사이즈 11mm) */
      .print-running-footer {
          display: flex !important;
          position: fixed !important;
          top: auto !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          height: 11mm !important;
          padding: 0 !important;
          margin: 0 !important;
          background: #ffffff !important;
          justify-content: space-between !important;
          align-items: flex-end !important;
          z-index: 500 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 1페이지 메인 헤더 */
      #printSection .exam-header {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100% !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
          padding-top: 0 !important;
          padding-bottom: 8px !important;
          background: #ffffff !important;
          z-index: 1000 !important;
          border-bottom: 2px solid #000 !important;
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
      }

      /* 매 페이지 상단(18mm) 및 하단(12mm) 본문 여백 자동 확보 */
      .exam-body-wrap {
          display: block !important;
          width: 100% !important;
          padding-top: 18mm !important;
          padding-bottom: 12mm !important;
          -webkit-box-decoration-break: clone !important;
          box-decoration-break: clone !important;
          box-sizing: border-box !important;
      }

      .exam-columns {
          column-count: 2 !important;
          column-gap: 10mm !important;
          column-rule: 0.5px solid #ccc !important;
          margin-bottom: 0 !important;
          padding-bottom: 0 !important;
          height: auto !important;
          break-inside: auto !important;
          display: block !important;
      }

      .exam-q-block:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; border-bottom: none !important; }
      .no-print-img-bug img { max-height: 11mm !important; }

      .exam-q-block { 
          position: relative !important;
          margin-bottom: 12px !important;
          padding-left: 0 !important; 
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
      }

      .exam-q-range-title {
          font-family: "Malgun Gothic", sans-serif !important;
          font-weight: 800 !important;
          font-size: 14px !important;
          margin-left: 0 !important; 
          margin-bottom: 10px !important;
          display: block !important;
      }

      .exam-q-title-row {
          display: flex !important;
          align-items: baseline !important;
          min-height: 24px !important;
          margin-bottom: 2px !important;
          break-inside: avoid-column !important;
          page-break-inside: avoid !important;
      }

      .exam-q-num {
          margin-right: 10px !important;
          flex-shrink: 0 !important;
          text-align: left !important;
          font-family: "Malgun Gothic", sans-serif !important;
          font-weight: 800 !important;
          font-size: 20px !important;
      }

      .exam-q-text {
          font-size: 12px !important;
          display: block !important;
          line-height: 1.3 !important;
          margin-left: 0 !important;
          flex: 1 !important;
          word-break: keep-all !important;
          overflow-wrap: break-word !important;
      }

      .exam-q-id {
          display: flex !important;
          justify-content: space-between !important;
          font-size: 8px !important; color: #666 !important; margin-bottom: 2px !important;
      }

      .exam-passage, .exam-q-box, .exam-options {
          margin-left: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
      }

      .exam-options {
          display: grid !important;
          gap: 4px 10px !important;
          margin-top: 8px !important;
          break-inside: avoid-column !important;
          page-break-inside: avoid !important;
      }
      .exam-options.grid-5 { grid-template-columns: repeat(5, 1fr) !important; }
      .exam-options.grid-3 { grid-template-columns: repeat(3, 1fr) !important; }
      .exam-options.grid-2 { grid-template-columns: repeat(2, 1fr) !important; }
      .exam-options.grid-1 { grid-template-columns: 1fr !important; }

      .exam-opt-row { 
          display: flex !important; 
          align-items: baseline !important;
          break-inside: avoid !important;
      }
      .exam-opt-num { 
          font-weight: bold !important; 
          margin-right: 5px !important;
          flex-shrink: 0 !important;
          font-family: "Malgun Gothic", sans-serif !important;
      }
      .exam-opt-text { 
          font-size: 12px !important;
          font-family: "Times New Roman", serif !important;
          line-height: 1.2 !important;
          word-break: keep-all !important;
          overflow-wrap: break-word !important;
      }
    }
  `;
  printZone.appendChild(printStyle);

  // 정답지 및 이미지 처리 로직 (기존과 동일)
  const answerBtn = document.getElementById('btnPrintAnswers');
  if(answerBtn) answerBtn.onclick = () => renderAnswerSheetForPrint(qs, pageTitle, dateInput, studentName);
  const printBtn = document.getElementById('btnPrintAction');
  if (printBtn) {
      const images = printZone.querySelectorAll('img');
      let loadedCount = 0;
      const totalImages = images.length;
      const checkAllLoaded = () => {
          if (loadedCount >= totalImages) {
              printBtn.disabled = false;
              printBtn.style.background = '#2563eb';
              printBtn.style.cursor = 'pointer';
              printBtn.innerHTML = '🖨️ 인쇄하기';
              printBtn.onclick = () => { setTimeout(() => { window.print(); }, 500); };
          }
      };
      if (totalImages === 0) checkAllLoaded();
      else {
          images.forEach(img => {
              if (img.complete) { loadedCount++; } 
              else {
                  img.addEventListener('load', () => { loadedCount++; checkAllLoaded(); }, { once: true });
                  img.addEventListener('error', () => { loadedCount++; checkAllLoaded(); }, { once: true });
              }
          });
          checkAllLoaded();
      }
  }
}

/* 정답지 출력용 렌더링 함수 추가 */
function renderAnswerSheetForPrint(qs, pageTitle, dateInput, studentName) {
  const printZone = document.getElementById('printSection');
  printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#fff; z-index:9999; overflow-y:auto;";
  printZone.innerHTML = '';

  // [보조 함수] 인쇄용 정답 태그 변환
  const formatPrintAns = (ans) => {
    if (!ans) return '-';
    
    // [추가] 정답지에서도 색상 태그가 렌더링되도록 변환
    let processed = ans
        .replace(/<red>/gi, '<span class="txt-red">').replace(/<\/red>/gi, '</span>')
        .replace(/<blue>/gi, '<span class="txt-blue">').replace(/<\/blue>/gi, '</span>')
        .replace(/<green>/gi, '<span class="txt-green">').replace(/<\/green>/gi, '</span>')
        .replace(/<orange>/gi, '<span class="txt-orange">').replace(/<\/orange>/gi, '</span>');

    // || 구분자가 없는 단일 문장은 기호([]) 포함 그대로 출력
    if (!processed.includes('||')) return processed;
    
    // 서술형 (A) (B) 칸이 나뉜 경우에만 줄바꿈 처리
    const labels = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)'];
    return processed.split('||').map((v, i) => `<div style="margin-top:3px;"><b>${labels[i]}</b> ${v.trim()}</div>`).join('');
  };

  const controlsHTML = `
    <div class="print-controls no-print" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
      <div style="font-size: 16px; font-weight: bold;">🖥️ 정답지 미리보기</div>
      <div style="display:flex; gap:10px;">
        <button id="btnBackToQuestions" style="background: #059669; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">📄 문제지 보기</button>
        <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">🖨️ 인쇄하기</button>
        <button onclick="closePrintPreview()" style="background: #dc2626; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; white-space: nowrap;">닫기</button>
      </div>
    </div>
    <div class="print-controls no-print" style="height: 60px;"></div>
  `;

  // 헤더 및 테이블 구조 (기존 유지하되 내용물 가공)
              let dateStr = dateInput ? dateInput : (new Date().getMonth() + 1) + '월 ' + new Date().getDate() + '일';
              
              // [글자 수 기반 폰트 크기 계산]
              const rawTitle = pageTitle ? pageTitle : '문제 제목';
              const titleLen = (rawTitle + " (정답지)").length;
              let titleFontSize = 18;
              if (titleLen > 85) titleFontSize = 10;
              else if (titleLen > 70) titleFontSize = 12;
              else if (titleLen > 60) titleFontSize = 14;
              else if (titleLen > 50) titleFontSize = 16;

              const headerHTML = `
                <div class="exam-header" style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 20px;">
                  <div style="flex: 1; margin-right: 15px; height: 50px; display: flex; align-items: flex-end;">
                    <div style="font-size: ${titleFontSize}px; font-weight: bold; text-align: left; line-height: 1.3; width: 100%; word-break: keep-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                      ${sanitizeInlineHTML(rawTitle)} (정답지)
                    </div>
                  </div>
                  <div style="display: flex; flex-direction: column; justify-content: space-between; height: 50px; text-align: right; margin-right: 15px; font-size: 17px; font-weight: bold; line-height: 1.1;">
                    <div>${dateStr}</div>
                    <div>${studentName ? sanitizeInlineHTML(studentName) : '이름: _________'}</div>
                  </div>
                  <div style="font-size:0; height: 50px; width: 50px;"></div>
                </div>
              `;

              let bodyHTML = '<table style="width:100%; border-collapse: collapse; font-size:13px;"><tbody><tr>';
  
  qs.forEach((q, idx) => {
    if (idx > 0 && idx % 5 === 0) bodyHTML += '</tr><tr>'; // 정답이 길어질 수 있으므로 한 행에 4개로 조정 (기존 5개)
    
    const displayAns = formatPrintAns(String(q.answer || '').trim());
    
    bodyHTML += `<td style="padding: 18px 5px; border-bottom: 1px solid #eee; width: 20%; vertical-align: top; word-break: keep-all; overflow-wrap: break-word;">
              <div style="display: flex; align-items: flex-start;">
                <!-- 번호가 들어가는 곳: 25px 너비 고정 -->
                <span style="font-weight:bold; min-width:25px; color:#374151; font-size:13px;">${idx + 1}.</span> 
                
                <!-- 정답이 들어가는 곳: 나머지 공간(flex:1)을 다 쓰면서 자동 줄바꿈 -->
                <span style="color:#dc2626; font-weight:bold; font-size:13px; line-height: 1.4; flex: 1;">${displayAns}</span>
              </div>
            </td>`;
  });

  bodyHTML += '</tr></tbody></table>';

              // [테이블 반복 기법 적용] 정답지도 표(Table)로 감싸고 1페이지 가림막 삽입
              const tableWrapperHTML = `
                <div style="position: relative; width: 100%; height: auto;">
                    <div class="first-page-cover"></div>
                    <table style="width: 100%; border-collapse: collapse; border: none; margin-bottom: 0;">
                        <thead>
                            <tr>
                                <td style="padding: 0; border: none; height: 12mm;">
                                    <div class="print-table-header no-print-img-bug">
                                        <span style="flex: 1; font-size: 10pt; font-weight: bold; color: #6b7280; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sanitizeInlineHTML(rawTitle)} (정답지)</span>
                                    </div>
                                </td>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 0; border: none;">
                                    ${headerHTML}
                                    ${bodyHTML}
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="padding: 0; border: none; height: 12mm;">
                                    <div class="print-table-footer no-print-img-bug">
                                        <img src="https://i.imgur.com/R9QpYH9.jpeg" style="height: 11mm !important; width: auto !important; max-height: 11mm !important; object-fit: contain; margin: 0 !important;" alt="QR">
                                        <img src="https://i.imgur.com/NVHBqH2.png" style="height: 11mm !important; width: auto !important; max-height: 11mm !important; object-fit: contain; margin: 0 !important;" alt="Logo">
                                    </div>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
              `;
              printZone.innerHTML = controlsHTML + tableWrapperHTML;

              // [테이블 반복 기법 적용] 정답지용 CSS
              const ansPrintStyle = document.createElement('style');
              ansPrintStyle.innerHTML = `
                .print-table-header {
                    display: flex; align-items: center; justify-content: center; height: 12mm; padding: 0 20mm; box-sizing: border-box; overflow: hidden; border-bottom: 1px solid #ccc;
                }
                .print-table-footer {
                    display: flex; justify-content: space-between; align-items: flex-end; height: 11mm; overflow: hidden;
                }
                @media print {
                  @page { margin: 10mm 15mm 10mm 15mm !important; }
                  /* 빈 페이지 방지용 높이/여백 강제 초기화 */
                  html, body { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; display: block !important; }
                  #printSection { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
                  table { page-break-after: avoid !important; page-break-inside: auto !important; margin-bottom: 0 !important; border-spacing: 0 !important; width: 100% !important; }
                  tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                  
                  /* 빈 페이지 버그 방지: height: max-content 강제 할당 제거 */
                  .exam-columns { margin-bottom: 0 !important; padding-bottom: 0 !important; break-inside: auto !important; display: block !important; }
                  .exam-q-block:last-child { margin-bottom: 0 !important; padding-bottom: 0 !important; border-bottom: none !important; }
                  
                  /* 테이블 내 헤더/푸터 스타일 */
                  .print-table-header {
                      display: flex !important; align-items: center !important; justify-content: center !important; height: 12mm !important; padding: 0 20mm !important; box-sizing: border-box !important; overflow: hidden !important; border-bottom: 1px solid #ccc !important;
                  }
                  .print-table-footer {
                      display: flex !important; justify-content: space-between !important; align-items: flex-end !important; height: 11mm !important; overflow: hidden !important;
                  }
                  
                  /* 1페이지 상단 테이블 헤더 가림막 */
                  .first-page-cover {
                      position: absolute; top: 0; left: 0; right: 0;
                      height: 13mm; background: white !important;
                      -webkit-print-color-adjust: exact; print-color-adjust: exact;
                      z-index: 110;
                  }

                  /* 1페이지 메인 헤더 */
                  .exam-header {
                      position: relative !important; background: transparent !important; z-index: 120 !important;
                      margin-top: -12mm !important; padding-top: 0 !important;
                      -webkit-print-color-adjust: exact; print-color-adjust: exact;
                  }
                  .no-print-img-bug img { max-height: 11mm !important; }
                }
              `;
              printZone.appendChild(ansPrintStyle);
              document.getElementById('btnBackToQuestions').onclick = () => renderQuestionsForPrint(qs, pageTitle, dateInput, studentName);
}

/* 닫기 버튼용 함수 */
function closePrintPreview(){
  const printZone = document.getElementById('printSection');
  printZone.style.display = 'none';
  printZone.innerHTML = '';
}

// 혹시 모르니 window 객체에 등록
window.closePrintPreview = closePrintPreview;

/* ===================== [신규] 주간평가 리포트 로직 ===================== */
let chartRadarInst = null;
let chartLineInst = null;

function openWeeklyReport(assignmentId, isSharedMode = false) {
    const printZone = document.getElementById('printSection');
// 로딩 표시
    const loadEl = document.getElementById('loadingOverlay');
if(loadEl) { 
        loadEl.querySelector('.loading-text').innerHTML = '학습 리포트를 생성 중입니다...';
        loadEl.classList.add('active');
}

    google.script.run.withSuccessHandler(res => {
        if(loadEl) loadEl.classList.remove('active');
        if(res.error) { showCustomAlert(res.error); return; }
        
        // 1. 인쇄 영역(printSection) 보이기 및 스타일 초기화
        printZone.style.cssText = "display:block; position:fixed; top:0; left:0; width:100%; height:100%; background:#f3f4f6; z-index:9999; overflow-y:auto;";
        
        // 2. 상단 컨트롤 바 (공유 모드일 때는 버튼 숨김, 관리자일 때는 카톡 버튼 추가)
        let controlsHTML = '';
        if (isSharedMode) {
            controlsHTML = `
              <div class="print-controls" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 16px; font-weight: bold;">📊 케이투학원 주간평가 리포트</div>
              </div>
              <div class="print-controls" style="height: 60px;"></div>
            `;
        } else {
            const btnStyle = "width: 88px; padding: 6px 0; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; white-space: nowrap; flex-shrink: 0; text-align: center; box-sizing: border-box;";
            controlsHTML = `
              <div class="print-controls" style="position: fixed; top: 0; left: 0; right: 0; background: #374151; color: white; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                <div style="font-size: 16px; font-weight: bold;">🖥️ 리포트 미리보기</div>
                <div style="display:flex; gap:6px;">
                  <button onclick="shareKakao('${assignmentId}', '${res.meta.name}', '${res.meta.score}')" style="background: #FEE500; color: #000; ${btnStyle}">💬 카톡 공유</button>
                  <button onclick="downloadReportImage('${res.meta.title}', '${res.meta.name}')" style="background: #10b981; color: white; ${btnStyle}">🖼️ 이미지 저장</button>
                  <button onclick="window.print()" style="background: #2563eb; color: white; ${btnStyle}">🖨️ 인쇄</button>
                  <button onclick="closePrintPreview()" style="background: #dc2626; color: white; ${btnStyle}">닫기</button>
                </div>
              </div>
              <div class="print-controls" style="height: 60px;"></div>
            `;
        }

        // 3. 표(Table) 내부 행(tr) HTML 생성
        let tbodyHtml = '';
        res.questions.forEach(q => {
            const resultHtml = q.isCorrect 
                ? `<span style="color:#059669; font-weight:bold;">O</span>`
                : `<span style="color:#dc2626; font-weight:bold;">X</span>`;
            const bgStyle = q.isCorrect ? '' : 'background-color:#fef2f2;';
            
            tbodyHtml += `
                <tr style="border-bottom:1px solid #eee; ${bgStyle}">
                    <td style="padding:4px;">${q.no}</td>
                    <td style="padding:4px; text-align:left; padding-left:10px;">${q.type}</td>
                    <td style="padding:4px; text-align:left;">${q.source}</td>
                    <td style="padding:4px;">${q.difficulty}</td>
                    <td style="padding:4px;">${resultHtml}</td>
                </tr>
            `;
        });

// [추가] 과제 제목에서 'N월 N주차' 정보만 추출
        const weekMatch = String(res.meta.title).match(/\d+월\s*\d+주차/);
        const weekStr = weekMatch ? ` <span style="font-size:20px; font-weight:bold; color:#4b5563;">(${weekMatch[0]})</span>` : '';

        // [신규] 과제 제목에서 'Lv.N' 정보 추출 및 난이도 UI 동적 생성
        const levelMatch = String(res.meta.title).match(/Lv\.(\d+)/i);
        const levelVal = levelMatch ? parseInt(levelMatch[1], 10) : 0;
        let levelUIHtml = '';
        
        if (levelVal > 0) {
            const safeLevel = Math.max(1, Math.min(15, levelVal));
            // 1~15단계를 0% ~ 100% 백분율로 매핑 (점 위치 계산)
            const percent = ((safeLevel - 1) / 14) * 100;
            
            // 5단계 명칭 매핑
            let stageName = '';
            if (safeLevel <= 3) stageName = 'Essential';
            else if (safeLevel <= 6) stageName = 'Intermediate';
            else if (safeLevel <= 9) stageName = 'Advanced';
            else if (safeLevel <= 12) stageName = 'Expert';
            else stageName = 'Mastery';
            
            levelUIHtml = `
              <div style="margin: 45px 0 35px 0;">
                  <div style="position: relative; width: 100%; height: 12px; border-radius: 6px; background: linear-gradient(to right, #3b82f6, #10b981, #f59e0b, #ef4444); box-shadow: inset 0 1px 3px rgba(0,0,0,0.2);">
                      
                      <div style="position: absolute; left: ${percent}%; top: 50%; transform: translate(-50%, -50%); z-index: 10; display: flex; flex-direction: column; align-items: center;">
                          <div style="position: absolute; bottom: 18px; background: #111827; color: #fff; font-size: 13px; font-weight: bold; padding: 6px 10px; border-radius: 6px; white-space: nowrap; box-shadow: 0 4px 6px rgba(0,0,0,0.3);">
                              목표 난이도: Lv.${safeLevel} (${stageName})
                              <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 5px solid #111827;"></div>
                          </div>
                          <div style="width: 22px; height: 22px; background: #fff; border: 5px solid #111827; border-radius: 50%; box-sizing: border-box; box-shadow: 0 0 0 2px rgba(255,255,255,0.8);"></div>
                      </div>
                  </div>
                  <div style="position: relative; margin-top: 12px; height: 15px; font-size: 11px; font-weight: bold; color: #6b7280;">
                      <div style="position: absolute; left: 0%; transform: translateX(0%);">Essential</div>
                      <div style="position: absolute; left: 25%; transform: translateX(-50%);">Intermediate</div>
                      <div style="position: absolute; left: 50%; transform: translateX(-50%);">Advanced</div>
                      <div style="position: absolute; left: 75%; transform: translateX(-50%);">Expert</div>
                      <div style="position: absolute; left: 100%; transform: translateX(-100%);">Mastery</div>
                  </div>
              </div>
            `;
        }

        // 4. 리포트 본문 HTML 구성 (A4 인쇄 맞춤형 CSS 및 여백/높이 축소)
        const reportHTML = `
          <style>
             @media print {
                 @page { size: A4; margin: 10mm; }
                 body, html { margin: 0; padding: 0; }
                 #printSection { overflow: hidden !important; }
                 #reportPaper { margin: 0 !important; box-shadow: none !important; width: 100% !important; height: 100% !important; page-break-after: avoid; }
             }
          </style>
          <div id="reportPaper" style="background:#fff; width:210mm; height:297mm; padding:10mm; margin:20px auto; box-shadow:0 0 20px rgba(0,0,0,0.2); position:relative; box-sizing:border-box; color:#111827; overflow:hidden;">
              
              <div style="border-bottom:3px solid #111827; padding-bottom:8px; display:flex; justify-content:space-between; align-items:flex-end;">
                  <div>
                      <div style="font-size:26px; font-weight:900; letter-spacing:-1px;">주간 학습 리포트${weekStr}</div>
                  </div>
                  <div style="text-align:right;">
                      <div style="font-size:26px; font-weight:900;">${res.meta.name}</div>
                  </div>
              </div>

              ${levelUIHtml}

              <div style="background:#f3f4f6; border-radius:8px; padding:12px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                  <div style="font-size:18px; font-weight:bold; color:#374151;">이번 주 성취도</div>
                  <div style="display:flex; align-items:baseline; gap:15px;">
                      <div style="font-size:15px; color:#4b5563;">맞은 개수: <strong style="color:#111827;">${res.meta.correctCount}</strong> / ${res.meta.totalCount}</div>
                      <div style="font-size:26px; font-weight:900; color:#2563eb;">${res.meta.score}점</div>
                  </div>
              </div>

              <div style="display:flex; justify-content:space-between; gap:20px; margin-bottom:15px; height:200px; page-break-inside: avoid;">
                  <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; width:48%; display:flex; flex-direction:column; box-sizing:border-box;">
                      <div style="font-size:14px; font-weight:bold; margin-bottom:5px; text-align:center; color:#111827;">📊 영역별 정답률</div>
                      <div style="flex:1; position:relative; min-height:0;">
                          <canvas id="chartRadar"></canvas>
                      </div>
                  </div>
                  <div style="border:1px solid #e5e7eb; border-radius:8px; padding:10px; width:48%; display:flex; flex-direction:column; box-sizing:border-box;">
                      <div style="font-size:14px; font-weight:bold; margin-bottom:5px; text-align:center; color:#111827;">📈 최근 5주 성적 변화</div>
                      <div style="flex:1; position:relative; min-height:0;">
                          <canvas id="chartLine"></canvas>
                      </div>
                  </div>
              </div>

              <div>
                  <div style="font-size:15px; font-weight:bold; margin-bottom:8px; border-left:4px solid #2563eb; padding-left:10px;">문항별 상세 분석</div>
                  <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:center;">
                      <thead style="background:#f9fafb; border-top:2px solid #374151; border-bottom:1px solid #374151;">
                          <tr style="height:30px;">
                              <th style="width:10%;">번호</th>
                              <th style="width:25%;">유형</th>
                              <th style="width:35%;">출처</th>
                              <th style="width:15%;">난이도</th>
                              <th style="width:15%;">결과</th>
                          </tr>
                      </thead>
                      <tbody>
                          ${tbodyHtml}
                      </tbody>
                  </table>
              </div>
          </div>
        `;

        // 5. 생성한 HTML을 화면(printSection)에 투입
        printZone.innerHTML = controlsHTML + reportHTML;

        // 6. 차트 그리기 (HTML이 문서에 들어간 직후 실행)
        if(chartRadarInst) chartRadarInst.destroy();
        if(chartLineInst) chartLineInst.destroy();

        const ctxRadar = document.getElementById('chartRadar').getContext('2d');
        chartRadarInst = new Chart(ctxRadar, {
            type: 'radar',
            data: {
                labels: ['빈칸/추론', '논리/흐름', '대의파악', '어법/어휘', '세부/장문'],
                datasets: [{
                    label: '나의 정답률 (%)',
                    data: res.radar,
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderColor: 'rgba(37, 99, 235, 1)',
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#2563eb',
                    borderWidth: 2
                }]
            },
            options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { r: { angleLines: { color: '#e5e7eb' }, grid: { color: '#e5e7eb' }, pointLabels: { font: { size: 12, weight: 'bold', family:"'Noto Sans KR'" }, color: '#111827' }, suggestedMin: 0, suggestedMax: 100, ticks: { stepSize: 20, display: false } } }, plugins: { legend: { display: false } } }
        });

        const ctxLine = document.getElementById('chartLine').getContext('2d');
        chartLineInst = new Chart(ctxLine, {
            type: 'line',
            data: {
                labels: res.trend.map(t => t.label),
                datasets: [{
                    label: '점수',
                    data: res.trend.map(t => t.score),
                    borderColor: '#10b981', backgroundColor: '#10b981', borderWidth: 2, tension: 0.1, pointRadius: 4
                }]
            },
            options: { animation: false, responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { borderDash: [2, 2] } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
        });

    }).withFailureHandler(err => {
        if(loadEl) loadEl.classList.remove('active');
        showCustomAlert('리포트 생성 실패: ' + err);
    }).getWeeklyReportData(assignmentId);
}

function closeWeeklyReport() {
    document.getElementById('weeklyReportModal').style.display = 'none';
}

// [추가] 카카오톡 공유 API 실행 함수
function shareKakao(assignmentId, studentName, score) {
    const KAKAO_KEY = '여기에_발급받을_자바스크립트_키를_넣으세요'; // 추후 변경 필요
    
    if (KAKAO_KEY === '여기에_발급받을_자바스크립트_키를_넣으세요') {
        showCustomAlert('카카오 API 키가 아직 설정되지 않았습니다.\n코드를 수정한 뒤 다시 시도해 주세요.');
        return;
    }

    if (!Kakao.isInitialized()) {
        Kakao.init(KAKAO_KEY);
    }

    google.script.url.getLocation(function(location) {
        // 현재 배포된 웹앱 주소에서 파라미터 부분을 제외한 순수 Base URL 추출
        const baseUrl = location.href.split('?')[0]; 
        const shareUrl = baseUrl + '?report=' + assignmentId;

        Kakao.Share.sendDefault({
          objectType: 'feed',
          content: {
            title: '케이투학원 주간 학습 리포트',
            description: studentName + ' 학생의 이번 주 평가 결과가 도착했습니다. (점수: ' + score + '점)',
            imageUrl: 'https://i.imgur.com/aXAiKUV.jpeg', // 현재 난이도 가이드용 이미지를 임시 썸네일로 사용
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
          buttons: [
            {
              title: '결과 리포트 확인하기',
              link: {
                mobileWebUrl: shareUrl,
                webUrl: shareUrl,
              },
            },
          ],
        });
    });
}

function downloadReportImage(title, studentName) {
    const target = document.getElementById('reportPaper');
    if (!target) return;

    const btn = event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 처리 중...';
    btn.disabled = true;

    const weekMatch = String(title).match(/(\d+)주차/);
    const weekStr = weekMatch ? weekMatch[1] + '주차' : '';

    const today = new Date();
    const yy = String(today.getFullYear()).slice(-2);
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = yy + mm + dd;

    const fileName = `${weekStr}주간평가리포트_${studentName}(${dateStr}).png`;

    html2canvas(target, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
        btn.innerHTML = originalText;
        btn.disabled = false;
    }).catch(err => {
        alert('이미지 렌더링 중 오류가 발생했습니다.');
        btn.innerHTML = originalText;
        btn.disabled = false;
    });
}
