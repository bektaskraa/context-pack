// build.js
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function build() {
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy assets
  const distAssetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    fs.mkdirSync(distAssetsDir, { recursive: true });
  }

  const srcAssetsDir = path.join(__dirname, 'assets');
  if (fs.existsSync(srcAssetsDir)) {
    fs.readdirSync(srcAssetsDir).forEach((file) => {
      fs.copyFileSync(path.join(srcAssetsDir, file), path.join(distAssetsDir, file));
    });
  }

  // Copy static HTML / CSS / Manifest
  fs.copyFileSync(path.join(__dirname, 'manifest.json'), path.join(distDir, 'manifest.json'));
  fs.copyFileSync(path.join(__dirname, 'src/popup/popup.html'), path.join(distDir, 'popup.html'));
  fs.copyFileSync(path.join(__dirname, 'src/popup/popup.css'), path.join(distDir, 'popup.css'));

  const commonOptions = {
    bundle: true,
    sourcemap: true,
    target: ['chrome110'],
    logLevel: 'info',
  };

  const builds = [
    // Background Service Worker
    esbuild.build({
      ...commonOptions,
      entryPoints: ['src/background/service-worker.ts'],
      outfile: 'dist/background.js',
      format: 'iife',
    }),

    // Content Script
    esbuild.build({
      ...commonOptions,
      entryPoints: ['src/content/index.ts'],
      outfile: 'dist/content.js',
      format: 'iife',
    }),

    // Popup Script
    esbuild.build({
      ...commonOptions,
      entryPoints: ['src/popup/popup.ts'],
      outfile: 'dist/popup.js',
      format: 'iife',
    }),
  ];

  await Promise.all(builds);
  console.log('✅ Build completed successfully into dist/');
}

build().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
