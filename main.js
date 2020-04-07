const { app, Notification, Menu, Tray, powerMonitor } = require('electron')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
let appTray = null
let batteryInfo = null
let notification = null
let lastNotificationBody = null
let lastNotificationTime = null

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

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

  if (shouldDisplayNotification() === true) {
    notification.show()
  }
}

function notifyPlugCharger() {
  notification.body = 'Please plug-in your device\'s charger now'

  if (shouldDisplayNotification() === true) {
    notification.show()
  }
}

function timeNow() {
  return Math.floor( new Date().getTime() / 1000)
}

function shouldDisplayNotification() {
  return lastNotificationBody !== notification.body && lastNotificationTime !== timeNow()
}

function setupTray() {
  appTray = new Tray(path.join(__dirname, 'assets', 'images', 'IconTemplate.png'))
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
    icon: path.join(__dirname, 'assets', 'images', 'IconTemplate@2x.png'),
    silent: false,
  })

  notification.on('show', () => {
    lastNotificationBody = notification.body
    lastNotificationTime = timeNow()
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
