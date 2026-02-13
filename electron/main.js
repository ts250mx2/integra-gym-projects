const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

// Check if we are in development mode
const isDev = !app.isPackaged;
const PORT = 3011; // Port for the embedded Next.js server in production

function startServer() {
    if (isDev) {
        // In dev, we assume the Next.js server is already running on port 3010
        createWindow(`http://localhost:3010`);
        return;
    }

    // In production, the server is in the resources/server folder
    const serverPath = path.join(process.resourcesPath, 'server', 'server.js');

    console.log('Starting internal server from:', serverPath);

    // Spawn the Next.js standalone server using Electron's internal Node.js
    // This ensures we don't depend on the user having Node.js installed.
    serverProcess = spawn(process.execPath, [serverPath], {
        env: {
            ...process.env,
            PORT: PORT.toString(),
            NODE_ENV: 'production',
            ELECTRON_RUN_AS_NODE: '1', // Run as a standard Node process
            HOSTNAME: 'localhost'
        },
        cwd: path.join(process.resourcesPath, 'server'),
        stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
        console.log(`[Next.js]: ${data}`);
    });

    serverProcess.stderr.on('data', (data) => {
        console.error(`[Next.js Error]: ${data}`);
    });

    // Poll until the server is ready
    const checkServer = () => {
        http.get(`http://localhost:${PORT}`, (res) => {
            if (res.statusCode === 200) {
                createWindow(`http://localhost:${PORT}`);
            } else {
                createWindow(`http://localhost:${PORT}`);
            }
        }).on('error', (err) => {
            // Server not ready yet
            setTimeout(checkServer, 500);
        });
    };

    // Start checking
    checkServer();
}

function createWindow(url) {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        title: 'Integra Gym Projects',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
    });

    mainWindow.loadURL(url);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App Lifecycle
app.whenReady().then(startServer);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        console.log('Killing internal server...');
        serverProcess.kill();
    }
});
