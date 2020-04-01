const { app, Notification, Menu, Tray, powerMonitor } = require('electron')
const { exec } = require('child_process')
const imagesPath = './assets/images'
const iconFileName = 'IconTemplate'
let appTray = null
let batteryInfo = null
let notification = null
let notificationIsShown = false
let notificationDismissed = false

// function createWindow () {
//   // Create the browser window.
//   const win = new BrowserWindow({
//     width: 800,
//     height: 600,
//     icon: `${imagesPath}/${iconFileName}.png`,
//     webPreferences: {
//       nodeIntegration: true
//     }
//   })
//
//   // and load the index.html of the app.
//   win.loadFile('index.html')
//
//   // Open the DevTools.
//   win.webContents.openDevTools()
// }

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.whenReady().then(createWindow)

// app.allowRendererProcessReuse = true

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// app.on('activate', () => {
//   // On macOS it's common to re-create a window in the app when the
//   // dock icon is clicked and there are no other windows open.
//   if (BrowserWindow.getAllWindows().length === 0) {
//     createWindow()
//   }
// })

async function getBatteryLevel() {
  await new Promise((res, rej) => {
    exec('pmset -g batt', (error, stdout, stderr) => {
      if (error) {
        ref(err)
      }
      if (stderr) {
        rej(stderr)
      }

      res(stdout)
    })
  }).then(res => {
    let batteryPowerSourceRegex = /^.+(?<source>\'\D+\')/
    let batteryPowerSource = res.match(batteryPowerSourceRegex)
    let batteryStatusRegex = /(\(id=\d+\)\s+)(?<battery_level>\d+)%.+?(?<charge_state>\w+);/
    let batteryStatus = res.match(batteryStatusRegex)

    if (res && batteryPowerSource && batteryStatus) {
      batteryInfo = {
        source: batteryPowerSource.groups.source,
        level: batteryStatus.groups.battery_level,
        state: batteryStatus.groups.charge_state,
      }
    } else {
      batteryInfo = null
    }
  })
}

async function ticker() {
  await getBatteryLevel()

  if (batteryInfo) {
    if (batteryInfo.level >= 82 && batteryInfo.state === 'charging') {
      notifyRemoveCharger()
    } else if (batteryInfo.level <= 35 && batteryInfo.state !== 'charging') {
      notifyPlugCharger()
    }
  }
}

function notifyRemoveCharger() {
  notification.body = 'You can now stop charging your device'

  if (notificationIsShown === false && notificationDismissed == false) {
    notificationDismissed = false
    notification.show()
  }
}

function notifyPlugCharger() {
  notification.body = 'Please plug-in your device\'s charger now'

  if (notificationIsShown === false && notificationDismissed == false) {
    notificationDismissed = false
    notification.show()
  }
}

function setupTray() {
  appTray = new Tray(`${imagesPath}/${iconFileName}.png`)
  const appVersion = require('./package.json').version
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Close', type: 'normal', click: () => { app.quit() } },
    { type: 'separator' },
    { label: `Version: ${appVersion}`, type: 'normal' }
  ])
  appTray.setToolTip('Battery Watchdog: We are watching for you.')
  appTray.setContextMenu(contextMenu)
}

function setupNotificationHooks() {
  notification = new Notification({
    title: 'Battery Watchdog',
    icon: `${imagesPath}/${iconFileName}@2x.png`,
    silent: false,
  })

  notification.on('show', () => {
    notificationIsShown = true
  })

  notification.on('click', () => {
    notificationIsShown = false
    notificationDismissed = true
  })
}

function setupPowerHooks() {
  powerMonitor.on('on-battery', () => {
    batteryInfo.state = 'discharging'
  })

  powerMonitor.on('on-ac', () => {
    batteryInfo.state = 'charging'
  })
}

app.on('ready', async() => {
  setupTray()
  setupNotificationHooks()
  setupPowerHooks()

  setInterval(ticker, 1000)
})
