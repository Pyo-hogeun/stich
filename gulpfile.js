// gulpfile.js (ESM)
import gulp from 'gulp';
import dartSass from 'sass';
import gulpSass from 'gulp-sass';
import postcss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import browserSync from 'browser-sync';
import { deleteAsync } from 'del';
import { globSync } from 'glob';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import babel from "gulp-babel";
import concat from "gulp-concat";
import terser from "gulp-terser";

import { rollup } from "rollup"; // rollup-stream 대신 rollup 직접 import

import source from "vinyl-source-stream";
import buffer from "vinyl-buffer";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import postcssPlugin from "rollup-plugin-postcss";


const { series, watch } = gulp;

// -------------------------------------
// 기본 설정
// -------------------------------------
const sass = gulpSass(dartSass);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const paths = {
  pages: path.join(__dirname, 'pages'),
  scss: path.join(__dirname, 'assets/style/scss/**/*.scss'),
  scssRoot: path.join(__dirname, 'assets/style/scss'),
  cssDest: path.join(__dirname, 'assets/style/css'),
  images: path.join(__dirname, 'assets/images/**/*'),
  index: path.join(__dirname, 'pages/index.html'),
  imageGallery: path.join(__dirname, 'pages/images.html'),
  htmlGlob: path.join(__dirname, 'pages/**/*.html'),
  js: path.join(__dirname, 'assets/js/**/*.js'),
  dist: path.join(__dirname, 'assets/dist/js'),
};

const HTML_GLOB = path.join(paths.pages, '**/*.html');
const OUT_INDEX = paths.index;
const OUT_IMAGE_GALLERY = paths.imageGallery;
const IMAGE_PAGE_DIR = path.dirname(OUT_IMAGE_GALLERY);
const INDEX_PAGE_DIR = path.dirname(OUT_INDEX);
const CSS_FILE = path.join(__dirname, 'assets/style/css/style.css');
const CSS_PATH_FROM_IMAGE_PAGE = path.relative(IMAGE_PAGE_DIR, CSS_FILE).replace(/\\/g, '/');
const CSS_PATH_FROM_INDEX_PAGE = path.relative(INDEX_PAGE_DIR, CSS_FILE).replace(/\\/g, '/');

// -------------------------------------
// assets/images → 이미지 미리보기 페이지 생성
// -------------------------------------
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** exponent;
  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[exponent]}`;
}

function generateImageGallery(done) {
  const files = globSync(paths.images, { nodir: true })
    .map((filePath) => ({
      filePath,
      relPath: path.relative(IMAGE_PAGE_DIR, filePath).replace(/\\/g, '/'),
      rootPath: path.relative(__dirname, filePath).replace(/\\/g, '/'),
      name: path.basename(filePath),
      size: fs.statSync(filePath).size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const galleryHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>이미지 자산 모음</title>
  <link rel="stylesheet" href="${CSS_PATH_FROM_IMAGE_PAGE}">
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; padding: 24px; background:#f8fafc; color:#111827; }
    h1 { margin: 0 0 6px; font-size: 26px; }
    p.meta { margin: 0 0 20px; color:#6b7280; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .card { background:#fff; border:1px solid #e5e7eb; border-radius: 12px; padding: 10px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap: 10px; }
    .thumb-wrap { background:#f9fafb; border:1px solid #e5e7eb; border-radius: 10px; padding: 8px; display:flex; align-items:center; justify-content:center; height: 120px; overflow: hidden; }
    .thumb { max-width: 100%; max-height: 100%; object-fit: contain; }
    .info { font-size: 13px; color:#374151; word-break: break-all; display:flex; flex-direction:column; gap: 4px; }
    .info strong { display:block; color:#111827; margin-bottom: 4px; font-size: 14px; }
    .meta-row { display:flex; justify-content:space-between; gap: 8px; align-items:center; }
    .meta-row span { display:block; }
    .meta-label { color:#6b7280; font-size:12px; letter-spacing: -0.01em; }
    .meta-value { color:#111827; font-weight:600; font-size: 13px; }
    .meta-value.dimensions { color:#1f2937; }
    .meta-value.loading { color:#9ca3af; font-weight:500; }
    .empty { padding: 24px; border:1px dashed #d1d5db; border-radius: 12px; text-align:center; background:#fff; color:#6b7280; }
  </style>
</head>
<body>
  <header>
    <h1>이미지 자산 모음</h1>
    <p class="meta">/assets/images 안의 모든 이미지 파일을 한눈에 확인하세요.</p>
  </header>
  <main>
    ${files.length === 0
      ? '<div class="empty">검색된 이미지가 없습니다.</div>'
      : `<section class="grid">${files
          .map(
            (file) => `
        <article class="card">
          <div class="thumb-wrap"><img class="thumb" src="${file.relPath}" data-asset-path="${file.rootPath}" alt="${file.name}"></div>
          <div class="info">
            <strong>${file.name}</strong>
            <div class="meta-row">
              <span class="meta-label">파일 크기</span>
              <span class="meta-value">${formatBytes(file.size)}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">이미지 크기</span>
              <span class="meta-value dimensions loading">계산 중...</span>
            </div>
          </div>
        </article>`
          )
          .join('')}</section>`}
  </main>
  <script>
    const cards = document.querySelectorAll('.card');

    const computeBasePath = () => {
      const segments = window.location.pathname.split('/').filter(Boolean);
      const repo = segments.length > 0 ? segments[0] : '';
      return repo ? '/' + repo : '';
    };

    const basePath = computeBasePath();

    cards.forEach((card) => {
      const img = card.querySelector('img');
      const dimensionEl = card.querySelector('.meta-value.dimensions');
      if (!img || !dimensionEl) return;

      const assetPath = img.getAttribute('data-asset-path');
      if (assetPath) {
        const normalized = (basePath + '/' + assetPath).replace(/[/\\]+/g, '/');
        img.src = normalized;
      }

      const renderDimensions = () => {
        const { naturalWidth, naturalHeight } = img;
        if (naturalWidth && naturalHeight) {
          dimensionEl.textContent = Math.round(naturalWidth) + ' × ' + Math.round(naturalHeight) + 'px';
          dimensionEl.classList.remove('loading');
        } else {
          dimensionEl.textContent = '측정 불가';
          dimensionEl.classList.remove('loading');
        }
      };

      if (img.complete) {
        renderDimensions();
      } else {
        img.addEventListener('load', renderDimensions, { once: true });
        img.addEventListener(
          'error',
          () => {
            dimensionEl.textContent = '로드 실패';
            dimensionEl.classList.remove('loading');
          },
          { once: true }
        );
      }
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(OUT_IMAGE_GALLERY, galleryHtml, 'utf8');
  console.log(`🖼️ Image gallery generated: ${OUT_IMAGE_GALLERY}`);
  if (browserSync.active) {
    browserSync.reload();
  }
  done();
}

// -------------------------------------
// index.html 생성 (자동 파일목록)
// -------------------------------------
function generateIndex(done) {
  const files = globSync(HTML_GLOB, { nodir: true, ignore: OUT_INDEX });
  const groups = {};

  files.forEach((fullPath) => {
    const dir = path.dirname(fullPath);
    const category = path.basename(dir);
    const fileName = path.basename(fullPath);
    const relPath = './' + path.relative(paths.pages, fullPath).replace(/\\/g, '/');
    if (!groups[category]) groups[category] = [];
    groups[category].push({ name: fileName, relPath });
  });

  const now = new Date();
  let html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>STICH 파일 목록</title>
  <link rel="stylesheet" href="${CSS_PATH_FROM_INDEX_PAGE}">
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; padding: 15px; line-height:1.6; background:#f6f8fb; color:#111827; }
    h1 { margin: 0 0 4px; font-size: 16px; }
    .page-header { margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    
    .meta { color:#6b7280; font-size: 13px; }
    .layout { --list-width: 20%; display: grid; grid-template-columns: minmax(100px, var(--list-width)) 10px 1fr; gap: 16px; align-items: stretch; height: 89vh}
    .list-panel, .preview-panel { background:#fff; border:1px solid #e5e7eb; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); } .list-panel{ overflow-y: auto;}
    .category { margin-bottom: 18px; }
    .category h2 { margin: 0 0 8px; font-size: 17px; color:#1f2937; }
    ul { margin: 6px 0 12px; padding: 0; }
    li { list-style: none; }
    .file-item { display:flex; gap: 10px; align-items: center; padding: 6px 8px; border-radius: 10px; border:1px solid transparent; transition: background 0.2s, border-color 0.2s; }
    .file-item:hover { background: #f9fafb; border-color:#e5e7eb; }
    .file-item.active { background:#eff6ff; border-color:#bfdbfe; }
    a.file-link { text-decoration: none; color: #2563eb; font-weight: 600; flex:1; word-break: break-all; }
    a.file-link:hover { text-decoration: underline; }
    .preview-btn { border:1px solid #d1d5db; background:#fff; color:#111827; border-radius: 8px; padding:6px 10px; cursor:pointer; font-size: 13px; transition: background 0.2s, border-color 0.2s; }
    .preview-btn:hover { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
    .divider { position: sticky; top: 50%; width: 10px; cursor: col-resize; border-radius: 12px; background: linear-gradient(180deg, #e5e7eb 0%, #cbd5e1 100%); border:1px solid #d1d5db; box-shadow: inset 0 1px 1px rgba(255,255,255,0.6); transition: background 0.2s, border-color 0.2s; height: 50px;}
    .layout.dragging .divider { background: linear-gradient(180deg, #d1d5db 0%, #9ca3af 100%); border-color:#9ca3af; }
    .preview-panel { position: sticky; top: 12px; }
    .preview-panel h2 { margin: 0 0 10px; font-size: 18px; }
    .preview-status { color:#6b7280; font-size: 13px; margin-bottom: 10px; word-break: break-all; }
    #previewFrame { width: 100%; height: 70vh; border:1px solid #e5e7eb; border-radius: 12px; background:#fff; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; gap: 12px; }
      .divider { display: none; }
      .preview-panel { position: static; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>STICH HTML 파일 목록</h1>
    <div class="meta">생성일: ${now.toLocaleString()}</div>
  </header>
  <main class="layout">
    <section class="list-panel">
`;

  const categoryNames = Object.keys(groups).sort();
  if (categoryNames.length === 0) {
    html += `<p>검색된 파일이 없습니다.</p>`;
  } else {
    categoryNames.forEach((cat) => {
      html += `<section class="category"><h2>${cat}</h2><ul>`;
      groups[cat]
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .forEach((f) => {
          html += `<li class="file-item"><a class="file-link" href="${f.relPath}" target="_blank" rel="noopener">${f.name}</a><button type="button" class="preview-btn" data-preview="${f.relPath}">미리보기</button></li>`;
        });
      html += `</ul></section>`;
    });
  }

  html += `    </section>
    <div class="divider" role="separator" aria-orientation="vertical" aria-label="목록과 미리보기 사이 조절 막대"></div>
    <section class="preview-panel" aria-live="polite">
      <h2>미리보기</h2>
      <div id="previewStatus" class="preview-status">왼쪽 목록의 '미리보기' 버튼을 클릭하면 이 영역에서 바로 확인할 수 있어요.</div>
      <iframe id="previewFrame" title="파일 미리보기" sandbox="allow-same-origin allow-forms allow-scripts allow-popups"></iframe>
    </section>
  </main>
  <script>
    const previewFrame = document.getElementById('previewFrame');
    const previewStatus = document.getElementById('previewStatus');
    const fileItems = Array.from(document.querySelectorAll('.file-item'));

    const setActiveItem = (element) => {
      fileItems.forEach((item) => item.classList.remove('active'));
      if (element) {
        element.classList.add('active');
      }
    };

    document.querySelectorAll('.file-link').forEach((link) => {
      link.addEventListener('click', () => {
        setActiveItem(link.closest('.file-item'));
      });
    });

    document.querySelectorAll('.preview-btn').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const url = btn.dataset.preview;
        const parentItem = btn.closest('.file-item');
        setActiveItem(parentItem);
        previewFrame.src = url;
        const cleanLabel = url.startsWith('./') ? url.slice(2) : url;
        previewStatus.textContent = cleanLabel;
        previewFrame.focus();
        previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const layout = document.querySelector('.layout');
    const divider = document.querySelector('.divider');
    const minPercent = 25;
    const maxPercent = 75;

    const clampPercent = (value) => Math.min(maxPercent, Math.max(minPercent, value));
    const updateWidth = (percent) => {
      layout.style.setProperty('--list-width', clampPercent(percent) + '%');
    };

    divider.addEventListener('pointerdown', (event) => {
      divider.setPointerCapture(event.pointerId);
      layout.classList.add('dragging');
    });

    divider.addEventListener('pointermove', (event) => {
      if (!divider.hasPointerCapture(event.pointerId)) return;
      const rect = layout.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      const percent = (relativeX / rect.width) * 100;
      updateWidth(percent);
    });

    const endDrag = (event) => {
      if (divider.hasPointerCapture(event.pointerId)) {
        divider.releasePointerCapture(event.pointerId);
      }
      layout.classList.remove('dragging');
    };

    divider.addEventListener('pointerup', endDrag);
    divider.addEventListener('pointercancel', endDrag);
  </script>
  </body></html>`;

  fs.writeFileSync(OUT_INDEX, html, 'utf8');
  console.log(`✅ Index generated: ${OUT_INDEX}`);
  browserSync.reload();
  done();
}

// -------------------------------------
// index.html 정리
// -------------------------------------
async function cleanIndex() {
  await deleteAsync([OUT_INDEX]);
  console.log('🧹 Old index.html deleted.');
}

// -------------------------------------
// SCSS → CSS 컴파일 + autoprefixer
// -------------------------------------
function compileScss() {
  return gulp
    .src('assets/style/scss/**/*.scss')
    .pipe(
      sass({
        outputStyle: 'expanded',
        includePaths: [paths.scssRoot],
      }).on('error', sass.logError)
    )
    .pipe(postcss([autoprefixer({ overrideBrowserslist: ['> 1%', 'last 2 versions', 'not dead'] })]))
    .pipe(gulp.dest(paths.cssDest))
    .pipe(browserSync.stream());
}

// -------------------------------------
// JS 번들링 & 트랜스파일링
// -------------------------------------
export async function bundleJS() {
  const bundle = await rollup({
    input: "assets/js/script.js", // 엔트리 파일
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
      commonjs(),
      postcssPlugin({
        extract: 'bundle.css', // 별도 CSS 파일 생성
        minimize: true,
      }),
      babel({
        babelHelpers: "bundled",
        presets: ["@babel/preset-env"],
      }),
    ],
  });

  await bundle.write({
    file: "assets/dist/js/bundle.js",
    format: "iife", // 즉시 실행 (브라우저용)
    name: "AppBundle",
    sourcemap: false,
  });

  await bundle.close();
  console.log("✅ JS bundle updated");
}
// Gulp가 비동기 Task를 인식하도록 callback 래핑
function bundleJSTask(done) {
  bundleJS()
    .then(() => {
      browserSync.reload();
      done();
    })
    .catch((err) => {
      console.error(err);
      done(err);
    });
}

// -------------------------------------
// 로컬 서버 구동 + Live Reload 감시
// -------------------------------------
function serve(done) {
  browserSync.init({
    server: {
      baseDir: [paths.pages, __dirname],
      index: 'index.html',
    },
    port: 3000,
    open: true,
    notify: false,
  });

  watch(paths.scss, compileScss);
  watch([paths.htmlGlob, `!${OUT_INDEX}`], generateIndex);
  watch(paths.images, series(generateImageGallery));
  watch(paths.js, series(bundleJSTask));

  done();
}

// -------------------------------------
// Task 등록
// -------------------------------------
export const buildIndex = series(cleanIndex, generateIndex);
export const build = series(generateImageGallery, buildIndex, compileScss, bundleJS);
export const dev = series(build, serve);
export const js = bundleJS;

export { generateImageGallery };
export default build;
