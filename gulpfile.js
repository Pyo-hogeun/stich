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
  htmlGlob: path.join(__dirname, 'pages/**/*.html'),
  js: path.join(__dirname, 'assets/js/**/*.js'),
  dist: path.join(__dirname, 'assets/dist/js'),
};

const HTML_GLOB = path.join(paths.pages, '**/*.html');
const OUT_INDEX = paths.index;

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
  <link rel="stylesheet" href="/assets/style/css/style.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif; padding: 24px; line-height:1.6; }
    h1 { margin-bottom: 8px; }
    .category { margin-bottom: 18px; }
    ul { margin: 6px 0 12px 20px; padding: 0; }
    li { list-style: none; }
    a { text-decoration: none; color: #007bff; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>STICH HTML 파일 목록</h1>
  <div style="color:#666;margin-bottom:10px;">생성일: ${now.toLocaleString()}</div>
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
          html += `<li><a href="${f.relPath}" target="_blank">${f.name}</a></li>`;
        });
      html += `</ul></section>`;
    });
  }

  html += `</body></html>`;

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
        extract: true, // 별도 CSS 파일 생성
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
  watch(paths.images).on('change', browserSync.reload);
  watch(paths.js, series(bundleJSTask));

  done();
}

// -------------------------------------
// Task 등록
// -------------------------------------
export const buildIndex = series(cleanIndex, generateIndex);
export const build = series(buildIndex, compileScss, bundleJS);
export const dev = series(build, serve);
export const js = bundleJS;

export default build;
