const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist', 'integra-gym-pos');
const ELECTRON_DIST = path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist');

console.log('Starting manual package...');

// 1. Clean and Create Dist Directory
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// 2. Copy Electron Binaries
console.log('Copying Electron binaries...');
execSync(`xcopy "${ELECTRON_DIST}" "${DIST_DIR}" /E /I /Y`);

// 3. Rename Executable
const oldExe = path.join(DIST_DIR, 'electron.exe');
const newExe = path.join(DIST_DIR, 'Integra Gym POS.exe');
if (fs.existsSync(oldExe)) {
    fs.renameSync(oldExe, newExe);
}

// 4. Setup Resources/App
const RESOURCES_DIR = path.join(DIST_DIR, 'resources');
const APP_DIR = path.join(RESOURCES_DIR, 'app');
fs.mkdirSync(APP_DIR, { recursive: true });

console.log('Copying App files...');
fs.copyFileSync(path.join(PROJECT_ROOT, 'package.json'), path.join(APP_DIR, 'package.json'));
fs.mkdirSync(path.join(APP_DIR, 'electron'), { recursive: true });
fs.copyFileSync(path.join(PROJECT_ROOT, 'electron', 'main.js'), path.join(APP_DIR, 'electron', 'main.js'));
fs.copyFileSync(path.join(PROJECT_ROOT, 'electron', 'preload.js'), path.join(APP_DIR, 'electron', 'preload.js'));

// 5. Setup Resources/Server (Next.js Standalone)
const SERVER_DIR = path.join(RESOURCES_DIR, 'server');
fs.mkdirSync(SERVER_DIR, { recursive: true });

console.log('Copying Next.js Standalone server...');
// Copy .next/standalone content to server/
execSync(`xcopy "${path.join(PROJECT_ROOT, '.next', 'standalone')}" "${SERVER_DIR}" /E /I /Y`);

console.log('Copying Public assets...');
const SERVER_PUBLIC = path.join(SERVER_DIR, 'public');
// public needs to be under server/public
if (fs.existsSync(path.join(PROJECT_ROOT, 'public'))) {
    execSync(`xcopy "${path.join(PROJECT_ROOT, 'public')}" "${SERVER_PUBLIC}" /E /I /Y`);
}

console.log('Copying Static assets...');
const SERVER_STATIC = path.join(SERVER_DIR, '.next', 'static');
// .next/static needs to be under server/.next/static
if (!fs.existsSync(path.join(SERVER_DIR, '.next'))) {
    fs.mkdirSync(path.join(SERVER_DIR, '.next'));
}
if (fs.existsSync(path.join(PROJECT_ROOT, '.next', 'static'))) {
    execSync(`xcopy "${path.join(PROJECT_ROOT, '.next', 'static')}" "${SERVER_STATIC}" /E /I /Y`);
}

console.log('Manual packaging complete!');
console.log(`Output: ${newExe}`);
