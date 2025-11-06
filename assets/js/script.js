window.addEventListener("DOMContentLoaded", function () {
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

  fileUpload();
})