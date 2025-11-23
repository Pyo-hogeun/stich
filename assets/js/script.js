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

import noUiSlider from 'nouislider';
import 'nouislider/dist/nouislider.css';

// 드래그 파일업로더
const FILE_UPLOAD_VARIANTS = {
  BASIC: 'basic',
  SORTABLE: 'sortable',
  AUTO: 'auto',
};

const DEFAULT_UPLOAD_SELECTORS = {
  uploadArea: '#fileUploadArea',
  fileInput: '#fileInput',
  fileList: '#fileList',
};

const isDomElement = (value) => typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;

const resolveElement = (ref, fallbackSelector) => {
  if (isDomElement(ref)) {
    return ref;
  }

  if (typeof ref === 'string' && ref.length > 0) {
    return document.querySelector(ref) ?? document.getElementById(ref);
  }

  if (!fallbackSelector) {
    return null;
  }

  return (
    document.querySelector(fallbackSelector) ||
    document.getElementById(
      fallbackSelector.startsWith('#') ? fallbackSelector.slice(1) : fallbackSelector
    )
  );
};

const resolveTargets = (options = {}) => {
  const uploadArea = resolveElement(options.uploadArea, DEFAULT_UPLOAD_SELECTORS.uploadArea);
  const fileInput = resolveElement(options.fileInput, DEFAULT_UPLOAD_SELECTORS.fileInput);
  const fileList = resolveElement(options.fileList, DEFAULT_UPLOAD_SELECTORS.fileList);

  return { uploadArea, fileInput, fileList };
};

const determineVariant = (requestedVariant, targets) => {
  if (requestedVariant && requestedVariant !== FILE_UPLOAD_VARIANTS.AUTO) {
    return requestedVariant;
  }

  const areaVariant = targets.uploadArea?.dataset?.uploadVariant?.toLowerCase();
  const listVariant = targets.fileList?.dataset?.uploadVariant?.toLowerCase();

  if (areaVariant === FILE_UPLOAD_VARIANTS.SORTABLE || listVariant === FILE_UPLOAD_VARIANTS.SORTABLE) {
    return FILE_UPLOAD_VARIANTS.SORTABLE;
  }

  return FILE_UPLOAD_VARIANTS.BASIC;
};

const markInitialized = (targets, variant) => {
  if (targets.uploadArea) {
    targets.uploadArea.dataset.fileUploadInitialized = 'true';
    targets.uploadArea.dataset.fileUploadActiveVariant = variant;
  }

  if (targets.fileList) {
    targets.fileList.dataset.fileUploadInitialized = 'true';
    targets.fileList.dataset.fileUploadActiveVariant = variant;
  }
};

const clearInitializationFlag = (targets) => {
  if (targets.uploadArea) {
    delete targets.uploadArea.dataset.fileUploadInitialized;
    delete targets.uploadArea.dataset.fileUploadActiveVariant;
  }

  if (targets.fileList) {
    delete targets.fileList.dataset.fileUploadInitialized;
    delete targets.fileList.dataset.fileUploadActiveVariant;
  }
};

const setupBasicUpload = (targets) => {
  const { uploadArea, fileInput, fileList } = targets;
  if (!uploadArea || !fileInput || !fileList) {
    return null;
  }

  const openFileDialog = () => fileInput.click();

  const createFileItem = (file) => {
    const fileItem = document.createElement('div');
    fileItem.classList.add('file-item');
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

    const deleteBtn = fileItem.querySelector('.file-item__delete');
    deleteBtn.addEventListener('click', () => {
      fileItem.remove();
    });

    return fileItem;
  };

  const handleIncomingFiles = (listLike) => {
    if (!listLike) {
      return;
    }

    const files = Array.from(listLike);
    if (!files.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    files.forEach((file) => {
      fragment.appendChild(createFileItem(file));
    });

    fileList.appendChild(fragment);
  };

  const onInputChange = (event) => {
    handleIncomingFiles(event.target.files);
    event.target.value = '';
  };

  const onDragOver = (event) => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  };

  const onDragLeave = () => {
    uploadArea.classList.remove('dragover');
  };

  const onDrop = (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    handleIncomingFiles(event.dataTransfer?.files);
  };

  uploadArea.addEventListener('click', openFileDialog);
  fileInput.addEventListener('change', onInputChange);
  uploadArea.addEventListener('dragover', onDragOver);
  uploadArea.addEventListener('dragleave', onDragLeave);
  uploadArea.addEventListener('drop', onDrop);

  return {
    variant: FILE_UPLOAD_VARIANTS.BASIC,
    destroy: () => {
      uploadArea.removeEventListener('click', openFileDialog);
      fileInput.removeEventListener('change', onInputChange);
      uploadArea.removeEventListener('dragover', onDragOver);
      uploadArea.removeEventListener('dragleave', onDragLeave);
      uploadArea.removeEventListener('drop', onDrop);
      clearInitializationFlag(targets);
    },
  };
};

const formatFileSize = (bytes) => {
  if (!bytes) {
    return '0B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, exponent);
  const fixed = exponent === 0 ? value.toFixed(0) : value.toFixed(2);
  return `${fixed}${units[exponent]}`;
};

const setupSortableUpload = (targets) => {
  const { uploadArea, fileInput, fileList } = targets;
  if (!uploadArea || !fileInput || !fileList) {
    return null;
  }

  let uploadedFiles = [];
  let fileListSortable = null;

  const openFileDialog = () => fileInput.click();

  const generateFileId = (file) => `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;

  const processFiles = (fileListObj) => {
    if (!fileListObj) {
      return;
    }

    const incomingFiles = Array.from(fileListObj);
    if (!incomingFiles.length) {
      return;
    }

    let appended = false;

    incomingFiles.forEach((file) => {
      const isDuplicate = uploadedFiles.some(
        (item) =>
          item.file.name === file.name &&
          item.file.size === file.size &&
          item.file.lastModified === file.lastModified
      );

      if (isDuplicate) {
        return;
      }

      uploadedFiles.push({
        id: generateFileId(file),
        file,
      });
      appended = true;
    });

    if (appended) {
      renderFileList();
    }
  };

  const renderFileList = () => {
    fileList.innerHTML = '';

    uploadedFiles.forEach(({ id, file }) => {
      const fileItem = document.createElement('div');
      fileItem.classList.add('file-item');
      fileItem.dataset.fileId = id;

      fileItem.innerHTML = `
        <div class="file-item__content">
          <div class="file-item__info">
            <div class="file-item__icon">
              <img src="../../assets/images/icon_file_added.png" alt="파일">
            </div>
            <span class="file-item__name">${file.name}</span>
            <span class="divider"></span>
            <span class="file-item__size">${formatFileSize(file.size)}</span>
          </div>
          <div class="item-actions">
            <button class="item-drag-handle" aria-label="항목 순서 변경">
              <img src="../../assets/images/icon_handle.svg" alt="">
            </button>
            <button class="item-close-btn" aria-label="항목 삭제">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.33203 3.3335L12.6659 12.6674" stroke="#0A0A0A" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M12.668 3.3335L3.3341 12.6674" stroke="#0A0A0A" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      const deleteBtn = fileItem.querySelector('.item-close-btn');
      deleteBtn.addEventListener('click', () => {
        uploadedFiles = uploadedFiles.filter((item) => item.id !== id);
        renderFileList();
      });

      fileList.appendChild(fileItem);
    });

    initSortable();
  };

  const initSortable = () => {
    if (fileListSortable) {
      fileListSortable.destroy();
      fileListSortable = null;
    }

    if (uploadedFiles.length <= 1) {
      return;
    }

    fileListSortable = new Sortable(fileList, {
      animation: 150,
      handle: '.item-drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: syncOrderFromDom,
    });
  };

  const syncOrderFromDom = () => {
    const orderedIds = Array.from(fileList.querySelectorAll('.file-item')).map((item) => item.dataset.fileId);
    const orderMap = new Map(orderedIds.map((fileId, index) => [fileId, index]));
    uploadedFiles.sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? 0;
      const bIndex = orderMap.get(b.id) ?? 0;
      return aIndex - bIndex;
    });
  };

  const onInputChange = (event) => {
    processFiles(event.target.files);
    event.target.value = '';
  };

  const onDragOver = (event) => {
    event.preventDefault();
    uploadArea.classList.add('dragover');
  };

  const onDragLeave = () => {
    uploadArea.classList.remove('dragover');
  };

  const onDrop = (event) => {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    processFiles(event.dataTransfer?.files);
  };

  uploadArea.addEventListener('click', openFileDialog);
  fileInput.addEventListener('change', onInputChange);
  uploadArea.addEventListener('dragover', onDragOver);
  uploadArea.addEventListener('dragleave', onDragLeave);
  uploadArea.addEventListener('drop', onDrop);

  return {
    variant: FILE_UPLOAD_VARIANTS.SORTABLE,
    getFiles: () => uploadedFiles.map((item) => item.file),
    destroy: () => {
      uploadArea.removeEventListener('click', openFileDialog);
      fileInput.removeEventListener('change', onInputChange);
      uploadArea.removeEventListener('dragover', onDragOver);
      uploadArea.removeEventListener('dragleave', onDragLeave);
      uploadArea.removeEventListener('drop', onDrop);
      if (fileListSortable) {
        fileListSortable.destroy();
        fileListSortable = null;
      }
      uploadedFiles = [];
      fileList.innerHTML = '';
      clearInitializationFlag(targets);
    },
  };
};

const initFileUpload = (options = {}) => {
  const targets = resolveTargets(options);

  if (!targets.uploadArea || !targets.fileInput || !targets.fileList) {
    return null;
  }

  if (targets.uploadArea.dataset.fileUploadInitialized === 'true') {
    return null;
  }

  const variant = determineVariant(options.variant, targets);

  const controller =
    variant === FILE_UPLOAD_VARIANTS.SORTABLE
      ? setupSortableUpload(targets)
      : setupBasicUpload(targets);

  if (controller) {
    markInitialized(targets, controller.variant);
  }

  return controller;
};

export const fileUpload = (options = {}) =>
  initFileUpload({ ...options, variant: FILE_UPLOAD_VARIANTS.BASIC });

export const fileUploadSortable = (options = {}) =>
  initFileUpload({ ...options, variant: FILE_UPLOAD_VARIANTS.SORTABLE });

export const fileUploadAuto = (options = {}) =>
  initFileUpload({ ...options, variant: options.variant ?? FILE_UPLOAD_VARIANTS.AUTO });

const autoInitializeFileUpload = () => {
  initFileUpload({ variant: FILE_UPLOAD_VARIANTS.AUTO });
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitializeFileUpload, { once: true });
  } else {
    autoInitializeFileUpload();
  }
}


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

// 평가 템플릿 SWIPER
const evaluationFileSwiper = (() => {
  const swiperElement = document.querySelector('.eva-file-swiper .swiper');
  const linkItems = document.querySelectorAll('.eva-file-list__wrapper .link-item');
  const fractionElement = document.querySelector('.eva-file-list__topper .fraction');

  if (!swiperElement || linkItems.length === 0) return null;

  const initialSlide = Array.from(linkItems).findIndex((item) =>
    item.classList.contains('active'),
  );

  const swiperInstance = new Swiper(swiperElement, {
    modules: [Navigation, Pagination],
    slidesPerView: 1,
    spaceBetween: 16,
    grabCursor: true,
    freeMode: false,
    initialSlide: initialSlide >= 0 ? initialSlide : 0,
    // Navigation arrows
    navigation: {
      nextEl: '.button-next.file-nav',
      prevEl: '.button-prev.file-nav',
    },
    pagination: { el: '.swiper-pagination', clickable: true },
  });

  const updateFraction = () => {
    if (!fractionElement) return;

    const total = linkItems.length;
    const current = swiperInstance.realIndex + 1;

    fractionElement.textContent = `${current}/${total}`;
  };

  const updateActiveLinkItem = () => {
    linkItems.forEach((item, idx) => {
      item.classList.toggle('active', swiperInstance.realIndex === idx);
    });

    updateFraction();
  };

  linkItems.forEach((item, idx) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      swiperInstance.slideTo(idx);
    });
  });

  swiperInstance.on('slideChange', updateActiveLinkItem);

  updateActiveLinkItem();

  return swiperInstance;
})();

// noUiSlider initialization for slider question cards
export const initSliderQuestionCard = () => {
  document.querySelectorAll('.question-card--slider').forEach((card) => {
    const sliderElement = card.querySelector('.range-slider__element');
    if (!sliderElement) return;

    const isViewer = card.classList.contains('answer');

    if (isViewer) {
      // [1] viewer 전용: 단일 슬라이더만 표시 (min/max 조절 없이)
      const minLabel = card.querySelector('.min');
      const maxLabel = card.querySelector('.max');

      const minValue = 0;
      const maxValue = 10;

      if (minLabel) minLabel.textContent = minValue;
      if (maxLabel) maxLabel.textContent = maxValue;

      noUiSlider.create(sliderElement, {
        start: [5],          // 초기값 중앙
        connect: [true, false],
        range: { min: minValue, max: maxValue },
        step: 1,
        tooltips: true,
        format: {
          to: (v) => Number(v).toFixed(),
          from: (v) => Number(v),
        },
      });
      return;
    }

    // [2] 일반 카드 (stepper 포함)
    const minStepper = card.querySelector('.score-stepper--min');
    const maxStepper = card.querySelector('.score-stepper--max');
    if (!minStepper || !maxStepper) return;

    const minValueSpan = minStepper.querySelector('.stepper-value');
    const maxValueSpan = maxStepper.querySelector('.stepper-value');
    const minUpBtn = minStepper.querySelector('.stepper-btn--up');
    const minDownBtn = minStepper.querySelector('.stepper-btn--down');
    const maxUpBtn = maxStepper.querySelector('.stepper-btn--up');
    const maxDownBtn = maxStepper.querySelector('.stepper-btn--down');

    let minValue = parseInt(minValueSpan.textContent) || 1;
    let maxValue = parseInt(maxValueSpan.textContent) || 10;

    noUiSlider.create(sliderElement, {
      start: [minValue, maxValue],
      connect: true,
      range: { min: 0, max: 100 },
      step: 1,
      tooltips: true,
      format: {
        to: (v) => Number(v).toFixed(2),
        from: (v) => Number(v),
      },
    });

    // 슬라이더 값 변경 시 표시 업데이트
    sliderElement.noUiSlider.on('update', (values, handle) => {
      const value = parseInt(values[handle]);
      if (handle === 0) {
        minValue = value;
        minValueSpan.textContent = value;
      } else {
        maxValue = value;
        maxValueSpan.textContent = value;
      }
    });

    // 최소 스텝 조절
    minUpBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (minValue < maxValue - 1) {
        minValue++;
        sliderElement.noUiSlider.set([minValue, null]);
      }
    });

    minDownBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (minValue > 0) {
        minValue--;
        sliderElement.noUiSlider.set([minValue, null]);
      }
    });

    // 최대 스텝 조절
    maxUpBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (maxValue < 100) {
        maxValue++;
        sliderElement.noUiSlider.set([null, maxValue]);
      }
    });

    maxDownBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (maxValue > minValue + 1) {
        maxValue--;
        sliderElement.noUiSlider.set([null, maxValue]);
      }
    });
  });
};

export const initStarRateSetting = () => {
  document.querySelectorAll('.star-rate-setting').forEach((container) => {
    const lengthStepper = container.querySelector('.score-stepper--length');
    const starRateList = container.querySelector('.star-rate ol');

    if (!lengthStepper || !starRateList) return;

    const valueElement = lengthStepper.querySelector('.stepper-value');
    const increaseButton = lengthStepper.querySelector('.stepper-btn--up');
    const decreaseButton = lengthStepper.querySelector('.stepper-btn--down');
    const templateStar = container.querySelector('.star-rate li');

    if (!valueElement || !increaseButton || !decreaseButton || !templateStar) return;

    const starTemplateHTML = templateStar.innerHTML.trim();
    const minStars = Number(lengthStepper.dataset.min) || 1;
    const maxStarsData = Number(lengthStepper.dataset.max);
    const maxStars = Number.isFinite(maxStarsData) && maxStarsData > 0 ? maxStarsData : Number.POSITIVE_INFINITY;

    const renderStars = (count) => {
      starRateList.innerHTML = '';

      for (let i = 0; i < count; i += 1) {
        const starItem = document.createElement('li');
        starItem.innerHTML = starTemplateHTML;
        starRateList.appendChild(starItem);
      }
    };

    let currentCount = parseInt(valueElement.textContent, 10);

    if (!Number.isFinite(currentCount)) {
      currentCount = starRateList.children.length || minStars;
    }

    currentCount = Math.min(Math.max(currentCount, minStars), maxStars);

    const updateUI = () => {
      valueElement.textContent = String(currentCount);
      renderStars(currentCount);
    };

    updateUI();

    increaseButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (currentCount >= maxStars) return;
      currentCount += 1;
      updateUI();
    });

    decreaseButton.addEventListener('click', (event) => {
      event.preventDefault();
      if (currentCount <= minStars) return;
      currentCount -= 1;
      updateUI();
    });
  });
};

export const initStarRatingUI = () => {
  document.querySelectorAll('.star-rate').forEach((container) => {
    const starItems = Array.from(container.querySelectorAll('li'));

    if (!starItems.length) return;

    const getScoreForItem = (item, index) => {
      const itemScore = Number(item.dataset.score);
      return Number.isFinite(itemScore) && itemScore > 0 ? itemScore : index + 1;
    };

    let selectedScore = starItems.reduce((acc, item, index) => {
      if (item.classList.contains('active')) {
        return Math.max(acc, getScoreForItem(item, index));
      }
      return acc;
    }, 0);

    const updateActiveState = (score) => {
      starItems.forEach((item, index) => {
        const itemScore = getScoreForItem(item, index);
        if (itemScore <= score) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      container.dataset.score = String(score);
    };

    if (selectedScore > 0) {
      updateActiveState(selectedScore);
    } else {
      container.dataset.score = '0';
    }

    starItems.forEach((item, index) => {
      const interactiveTarget = item.querySelector('a') || item;

      const score = getScoreForItem(item, index);

      interactiveTarget.addEventListener('click', (event) => {
        event.preventDefault();
        selectedScore = score;
        updateActiveState(score);

        container.dispatchEvent(
          new CustomEvent('change', {
            detail: {
              score,
            },
          }),
        );
      });

      item.addEventListener('mouseenter', () => {
        updateActiveState(score);
      });

      item.addEventListener('mouseleave', () => {
        updateActiveState(selectedScore);
      });
    });
  });
};
export const initStepScoreTab = () => {

  document.querySelectorAll('.step-score-tab').forEach((container) => {
    const tabItems = Array.from(container.querySelectorAll('.step-score-tab__item'));
    if (!tabItems.length) return

    tabItems.forEach((tab) => {
      const link = tab.querySelector('a');
      link.addEventListener('click', (e)=>{
        e.preventDefault();
        tabItems.forEach((item)=>{
          item.classList.remove('active')
        });
        tab.classList.add('active');
      })

    });

  })
}


export const tooltipInit = () => {
  const tooltipTriggers = document.querySelectorAll('.info-tooltip');
  
  tooltipTriggers.forEach((trigger) => {
    const tooltip = trigger.querySelector('.tooltip');
    if (!tooltip) return;
  
    const showTooltip = () => {
      tooltip.hidden = false;
    };
  
    const hideTooltip = () => {
      tooltip.hidden = true;
    };
  
    tooltip.hidden = true;
  
    trigger.addEventListener('mouseenter', showTooltip);
    trigger.addEventListener('mouseleave', hideTooltip);
    trigger.addEventListener('focus', showTooltip);
    trigger.addEventListener('blur', hideTooltip);
  });

}
export const filelistPopTemplateInit = () => {
  const popupTemplate = document.getElementById('file-list-popup-template');
  if(!popupTemplate) return;

  const popupGap = 8;
  let activePopup = null;
  let activeButton = null;

  const closePopup = () => {
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
      activeButton = null;
    }

    document.removeEventListener('click', handleOutsideClick);
    window.removeEventListener('resize', repositionPopup);
    window.removeEventListener('scroll', repositionPopup);
  };

  const handleOutsideClick = (event) => {
    if (!activePopup) return;

    const clickedPopup = event.target.closest('.file-list-popup');
    const clickedButton = event.target.closest('.files__action-btn');
    if (!clickedPopup && !clickedButton) {
      closePopup();
    }
  };

  const repositionPopup = () => {
    if (!activePopup || !activeButton) return;
    positionPopup(activePopup, activeButton);
  };

  const positionPopup = (popup, button) => {
    const buttonRect = button.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    popup.style.position = 'absolute';
    popup.style.left = `${buttonRect.left + scrollLeft}px`;

    const proposedTop = buttonRect.bottom + scrollTop + popupGap;
    const popupHeight = popup.offsetHeight;
    const viewportBottom = scrollTop + window.innerHeight;

    if (proposedTop + popupHeight > viewportBottom && buttonRect.top - popupGap - popupHeight > 0) {
      popup.style.top = `${buttonRect.top + scrollTop - popupGap - popupHeight}px`;
    } else {
      popup.style.top = `${proposedTop}px`;
    }
  };

  const openPopup = (button) => {
    if (!popupTemplate) return;

    closePopup();

    const popup = popupTemplate.content.firstElementChild.cloneNode(true);
    document.body.appendChild(popup);
    activePopup = popup;
    activeButton = button;

    positionPopup(popup, button);

    const closeBtn = popup.querySelector('.file-list-popup__close-btn');
    closeBtn?.addEventListener('click', (event) => {
      event.stopPropagation();
      closePopup();
    });

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 0);

    window.addEventListener('resize', repositionPopup);
    window.addEventListener('scroll', repositionPopup, { passive: true });
  };

  const fileViewButtons = Array.from(
    document.querySelectorAll('.list-wrap .item.evaluation-card .files__action-btn')
  ).filter((button) => button.textContent.trim().includes('파일 전체보기'));

  fileViewButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPopup(button);
    });
  });
}

// DOM 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
  rangePickerInit("#rangePicker");
  datePickerInit("#datePicker");
  initSliderQuestionCard();
  initStarRateSetting();
  initStarRatingUI();
  initStepScoreTab();
  tooltipInit();
  filelistPopTemplateInit();
});

