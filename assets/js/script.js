//드래그 파일업로더
const fileUpload = () => {
  const uploadArea = document.getElementById('fileUploadArea');
  const fileInput = document.getElementById('fileInput');
  const fileList = document.getElementById('fileList');

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
      // file-item 컨테이너 생성
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
//폼생성 섹션 순서 drag&drop
const sectionDragAndDrop = () => {
  const container = document.querySelector(".section-container");
    let dragged = null;
    let placeholder = document.createElement("div");
    placeholder.className = "placeholder";

    container.addEventListener("dragstart", (e) => {
      const handle = e.target.closest(".handle-drag");
      if (!handle) return;

      const section = handle.closest("section");
      dragged = section;
      section.classList.add("dragging");

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", "dragging"); // 필수 dummy 데이터
    });

    container.addEventListener("dragend", (e) => {
      if (dragged) {
        dragged.classList.remove("dragging");
        placeholder.remove();
        dragged = null;
      }
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        if (!container.contains(placeholder)) {
          container.appendChild(placeholder);
        }
      } else {
        container.insertBefore(placeholder, afterElement);
      }
    });

    container.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragged) {
        container.insertBefore(dragged, placeholder);
        placeholder.remove();
        dragged.classList.remove("dragging");
        dragged = null;
      }
    });

    // section을 드래그 가능하게 설정
    document.querySelectorAll(".section-container section").forEach((sec) => {
      sec.setAttribute("draggable", "true");
    });

    function getDragAfterElement(container, y) {
      const draggableElements = [
        ...container.querySelectorAll("section:not(.dragging)"),
      ];

      return draggableElements.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
          } else {
            return closest;
          }
        },
        { offset: Number.NEGATIVE_INFINITY }
      ).element;
    }

}
