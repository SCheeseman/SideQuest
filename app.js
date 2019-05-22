const {app, BrowserWindow} = require('electron');
let mainWindow;

function createWindow () {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 768,
        minWidth: 990,
        minHeight: 480,
        transparent: true,
        frame: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    mainWindow.loadFile('desktop-app/index.html');
    //mainWindow.webContents.openDevTools();
    mainWindow.on('closed', function () {
        mainWindow = null
    });
    mainWindow.setMenu(null);
}
app.on('ready', createWindow);
// Quit when all windows are closed.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
});

app.on('activate', function () {
    if (mainWindow === null) createWindow()
});
