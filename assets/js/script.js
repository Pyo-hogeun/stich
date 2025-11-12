import Sortable from 'sortablejs';
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import "flatpickr/dist/themes/stich.css";
import { Korean } from "flatpickr/dist/l10n/ko.js";

import Swiper from "swiper";
import { Navigation, Pagination } from 'swiper/modules';
import "swiper/swiper.css";
import 'swiper/css/navigation';
import 'swiper/css/pagination';

//드래그 파일업로더
export const fileUpload = () => {
  const uploadArea = document.getElementById('fileUploadArea');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');

  if (uploadArea) {
    // 클릭으로 파일 선택
    uploadArea.addEventListener('click', () => fileInput.click());

    // 파일 선택 시
    fileInput.addEventListener('change', handleFiles);

    // 드래그 이벤트 처리
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      handleFiles({ target: { files: e.dataTransfer.files } });
    });

    // 파일 목록 표시
    function handleFiles(e) {
      const files = e.target.files;
      fileList.innerHTML = '';

      Array.from(files).forEach((file) => {
        // file-item ���테이너 생성
        const fileItem = document.createElement('div');
        fileItem.classList.add('file-item');

        // 내부 구조 작성
        fileItem.innerHTML = `
          <div class="file-item__content">
            <div class="file-item__info">
              <div class="file-item__icon">
                <img src="../../assets/images/icon_file_added.png" alt="파일">
              </div>
              <span class="file-item__name">${file.name}</span>
            </div>
            <button class="file-item__delete" aria-label="파일 삭제">
              <img src="../../assets/images/icon_file_delete.png" alt="삭제">
            </button>
          </div>
        `;

        // 삭제 버튼 클릭 시 파일 항목 제거
        const deleteBtn = fileItem.querySelector('.file-item__delete');
        deleteBtn.addEventListener('click', () => {
          fileItem.remove();
        });

        fileList.appendChild(fileItem);
      });
    }
  }
}
fileUpload();


/**
 * SortableJS 기반 중첩 드래그&드롭 구현
 * - 섹션 drag: handle '.handle-drag', container '.section-container'
 * - 카드 drag: handle '.question-card__drag-handle', 각 .question-card-container 별도 인스턴스
 * - 카드 이동은 같은 컨테이너 내부에서만 허용 (cross-section 이��� 비허용)
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1) 섹션용 Sortable 초기화
  const sectionContainer = document.querySelector('.section-container');
  let sectionSortable = null;

  if (sectionContainer) {
    sectionSortable = new Sortable(sectionContainer, {
      handle: '.handle-drag',          // 섹션을 끌 수 있는 핸들
      animation: 200,                  // 애니메이션 (ms)
      ghostClass: 'sortable-ghost',    // 드래그 중 복제 요소 클래스
      chosenClass: 'sortable-chosen',  // 선택된 요소 클래스
      fallbackOnBody: true,            // ghost를 body에 붙여 레이어 문제 회피
      swapThreshold: 0.65,
      dataIdAttr: 'data-section-id',   // data-*로 id를 관리하면 순서 저장에 유리
      onEnd: (evt) => {
        // 섹션 순서가 변경된 후 처리 (evt.oldIndex, evt.newIndex)
        console.log('SECTION moved:', evt);
        // 순서 저장 예시: getSectionOrder() => 서버 전송
        const order = getSectionOrder();
        console.log('New section order:', order);
        // TODO: fetch('/api/saveOrder', {method:'POST',body:JSON.stringify(order)})
      }
    });
  }

  // 2) 카드용 Sortable 초기화 (각 section에 있는 question-card-container 마다 인스턴스 생성)
  // 카드 간 이동을 "같�� 컨테이너 내에서만" 허용하려면 group: { name: 'cards', pull: false, put: false }
  const cardSortables = new Map(); // container -> Sortable instance (필요하면 destroy 가능)

  function initCardSortables() {
    // 기존 인스턴스가 있으면 닫고 새로 생성(동적 추가에 안전)
    cardSortables.forEach((inst, key) => {
      try { inst.destroy(); } catch (e) { }
      cardSortables.delete(key);
    });

    document.querySelectorAll('.question-card-container').forEach((container, idx) => {
      // container 고유 id 없는 경우 생성 (데이터 추적용)
      if (!container.hasAttribute('data-card-container-id')) {
        container.setAttribute('data-card-container-id', String(Date.now() + Math.random()));
      }

      const sortable = new Sortable(container, {
        handle: '.question-card__drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        fallbackOnBody: true,
        swapThreshold: 0.65,
        // 같은 컨테이너 내에서만 정렬 허용 (cross-section 이동 금지)
        group: { name: 'cards-' + container.getAttribute('data-card-container-id'), pull: false, put: false },
        onEnd: (evt) => {
          console.log('CARD moved within container:', container, evt);
          // 카드 순서 ���장 (특정 섹션의 카드 순서)
          const order = getCardOrder(container);
          console.log('New card order for container:', container.getAttribute('data-card-container-id'), order);
          // TODO: 서버 저장 호출
        }
      });

      cardSortables.set(container, sortable);
    });
  }

  // 초기 실행 (DOM에 이미 있는 .question-card-container 대상)
  initCardSortables();

  // ------------------------------
  // 유틸: 섹션 순서 추출 (data-section-id 있으면 해당 값, 없으면 index)
  // ------------------------------
  function getSectionOrder() {
    return [...document.querySelectorAll('.section-container > section')].map((sec, idx) => {
      return {
        id: sec.getAttribute('data-section-id') || null,
        index: idx
      };
    });
  }

  // ------------------------------
  // 유틸: 카드 순서 추출 (특정 container)
  // ------------------------------
  function getCardOrder(container) {
    return [...container.querySelectorAll('.question-card')].map((card, idx) => {
      return {
        id: card.getAttribute('data-card-id') || null,
        index: idx
      };
    });
  }
  // Export utilities to window for debugging
  // window._sortableDebug = { sectionSortable, cardSortables, getSectionOrder, getCardOrder };

});

export const rangePickerInit = (targetId) => {

  // 문서 로드 후 flatpickr 초기화
  const prevArrow = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 5L9.66939 11.2191C9.2842 11.6684 9.2842 12.3316 9.66939 12.7809L15 19" stroke="#3A3A3A" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  const nextArrow = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 5L13.6612 10.4381C14.4316 11.3369 14.4316 12.6631 13.6612 13.5619L9 19" stroke="#3A3A3A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const rangeInput = document.querySelector(targetId);
  if (!rangeInput) {
    console.warn("⚠️ datepicker input not found");
    return
  }
  // const startTimeInput = document.querySelector("#startTime");
  // const endTimeInput = document.querySelector("#endTime");
  // const result = document.querySelector("#selectedRange");

  // flatpickr 인스턴스 생성
  const picker = flatpickr(rangeInput, {
    mode: "range",           // ✅ 기간 선택 모드
    locale: Korean,          // ✅ 한국어
    dateFormat: "Y.m.d", // ✅ 날짜 + 시간 표시
    enableTime: false,        // ✅ 시간 선택 활성화
    time_24hr: false,        // ✅ 12시간제 (PM/AM)
    minuteIncrement: 5,
    showMonths: 2,           // ✅ 2개월 표시
    defaultHour: 12,
    defaultMinute: 0,
    nextArrow: nextArrow,
    prevArrow: prevArrow,
    static: true,            // ✅ position 문제 방지
    onChange: (selectedDates, dateStr) => {
      console.log(`📅 Selected range: ${dateStr}`);
      updateResult(selectedDates);
    },
  });
  // 시간 변경 시 결과 업데이트
  // [startTimeInput, endTimeInput].forEach((input) => {
  //   input.addEventListener("input", () => updateResult(picker.selectedDates));
  // });
  // // 결과 영역 업데이트 함수
  // function updateResult(dates) {
  //   if (dates.length === 2) {
  //     const [start, end] = dates;

  //     const startDateStr = `${formatDate(start)} ${startTimeInput.value}`;
  //     const endDateStr = `${formatDate(end)} ${endTimeInput.value}`;
  //     result.textContent = `${startDateStr} ~ ${endDateStr}`;
  //   }
  // }
  // function formatDate(date) {
  //   const y = date.getFullYear();
  //   const m = String(date.getMonth() + 1).padStart(2, "0");
  //   const d = String(date.getDate()).padStart(2, "0");
  //   return `${y}.${m}.${d}`;
  // }

  console.log(`✅ Initialized rangeInput flatpickr instances`);
  console.log(rangeInput);
}
rangePickerInit("#rangePicker");

export const datePickerInit = (targetId) => {

  // 문서 로드 후 flatpickr 초기화
  const prevArrow = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 5L9.66939 11.2191C9.2842 11.6684 9.2842 12.3316 9.66939 12.7809L15 19" stroke="#3A3A3A" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
  const nextArrow = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M9 5L13.6612 10.4381C14.4316 11.3369 14.4316 12.6631 13.6612 13.5619L9 19" stroke="#3A3A3A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const date_picker = document.querySelector(targetId);
  if (!date_picker) {
    console.warn("⚠️ datepicker input not found");
    return
  }
  // const startTimeInput = document.querySelector("#startTime");
  // const endTimeInput = document.querySelector("#endTime");
  // const result = document.querySelector("#selectedRange");

  // flatpickr 인스턴스 생성
  const picker = flatpickr(date_picker, {
    mode: "single",           // ✅ 기간 선택 모드
    locale: Korean,          // ✅ 한국어
    dateFormat: "Y.m.d", // ✅ 날짜 + 시간 표시
    enableTime: false,        // ✅ 시간 선택 활성화
    time_24hr: false,        // ✅ 12시간제 (PM/AM)
    minuteIncrement: 5,
    // showMonths: 2,           // ✅ 2개월 표시
    defaultHour: 12,
    defaultMinute: 0,
    nextArrow: nextArrow,
    prevArrow: prevArrow,
    static: true,            // ✅ position 문제 방지
    onChange: (selectedDates, dateStr) => {
      console.log(`📅 Selected range: ${dateStr}`);
      updateResult(selectedDates);
    },
  });
  // // 시간 변경 시 결과 업데이트
  // [startTimeInput, endTimeInput].forEach((input) => {
  //   input.addEventListener("input", () => updateResult(picker.selectedDates));
  // });
  // // 결과 영역 업데이트 함수
  // function updateResult(dates) {
  //   if (dates.length === 2) {
  //     const [start, end] = dates;

  //     const startDateStr = `${formatDate(start)} ${startTimeInput.value}`;
  //     const endDateStr = `${formatDate(end)} ${endTimeInput.value}`;
  //     result.textContent = `${startDateStr} ~ ${endDateStr}`;
  //   }
  // }
  // function formatDate(date) {
  //   const y = date.getFullYear();
  //   const m = String(date.getMonth() + 1).padStart(2, "0");
  //   const d = String(date.getDate()).padStart(2, "0");
  //   return `${y}.${m}.${d}`;
  // }

  console.log(`✅ Initialized date_picker flatpickr instances`);
  console.log(date_picker);
}
datePickerInit("#datePicker");



const swiper = new Swiper(".mySwiper", {
  modules: [Pagination, Navigation],
  slidesPerView: 1.2,
  spaceBetween: 16,
  loop: true,
  pagination: { el: ".swiper-pagination" },
  effect: "cards", // 카드 전환 효과
  grabCursor: true,


  // Navigation arrows
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },

  // And if we need scrollbar
  scrollbar: {
    el: '.swiper-scrollbar',
  },
});

// 평가 템플릿 클릭 active
function bindCardClickEvents() {
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card--selected').forEach(el =>
        el.classList.remove('template-card--selected')
      );
      card.classList.add('template-card--selected');
    });
  });
}
// 평가 템플릿 SWIPER
const templateSwiper = new Swiper(".template-swiper", {
  modules: [Navigation],
  slidesPerView: 'auto',
  spaceBetween: 16,
  grabCursor: true,
  freeMode: true,
  // Navigation arrows
  navigation: {
    nextEl: '.button-next.tmp',
    prevEl: '.button-prev.tmp',
  },
});
const templateSwiperMine = new Swiper(".template-swiper-mine", {
  modules: [Navigation],
  slidesPerView: 'auto',
  spaceBetween: 16,
  grabCursor: true,
  freeMode: true,
  // Navigation arrows
  navigation: {
    nextEl: '.button-next.tmp-mine',
    prevEl: '.button-prev.tmp-mine',
  },
});

document.addEventListener('DOMContentLoaded', bindCardClickEvents);
templateSwiper.on('slideChange', bindCardClickEvents);
templateSwiperMine.on('slideChange', bindCardClickEvents);
