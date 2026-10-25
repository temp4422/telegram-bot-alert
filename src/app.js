import { loadEnvFile, env } from 'node:process'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

loadEnvFile(existsSync('.env') ? '.env' : '.env.production')

// prettier-ignore
if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.PUPPETEER_EXECUTABLE_PATH || !env.PUPPETEER_SKIP_DOWNLOAD) {
  throw new Error(`Missing environment variable.`)
}

let wasAlertActive = false
let alertTimeStart // Date.now() // Get time of alert in unix timestamp format

// Schedule the next check only after the current check and cleanup finish.
setTimeout(poll, 30000)

async function poll() {
  try {
    await run()
  } catch (error) {
    console.error('Alert check failed:', error)
  } finally {
    setTimeout(poll, 30000)
  }
}

async function run() {
  let browser
  try {
    // Launch the browser
    browser = await puppeteer.launch({
      headless: true,
      executablePath: env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    // Open page and go to URL
    const page = await browser.newPage()
    const response = await page.goto('https://alerts.in.ua', {
      waitUntil: 'networkidle2',
    })
    if (!response?.ok()) throw new Error('Page not loaded.')

    // Add timeout fix
    await new Promise((r) => setTimeout(r, 1000))

    // A missing region means the check failed, not that the alert ended.
    const region = await page.$('[data-oblast="Закарпатська область"]')
    if (!region) throw new Error('Region not found: Закарпатська область')
    const isAlertActive = await region.evaluate((element) =>
      element.hasAttribute('data-alert-id'),
    )

    // Send HTTP GET request to Telegram bot API
    const telegramBotToken = env.TELEGRAM_BOT_TOKEN
    const telegramChatId = env.TELEGRAM_CHAT_ID

    if (isAlertActive && !wasAlertActive) {
      const telegramMessageAlertOn = `🔴 Повітряна тривога у Закарпатській області.`
      const nextAlertTimeStart = Date.now()

      await fetch(
        `https://api.telegram.org/${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${telegramMessageAlertOn}`,
      )
      alertTimeStart = nextAlertTimeStart
      wasAlertActive = true
    }

    if (!isAlertActive && wasAlertActive) {
      let alertTimeEnd = Date.now()
      const alertDuration = msToTime(alertTimeEnd - alertTimeStart)
      const telegramMessageAlertOff = `🟢 Кінець тривоги.\nТривалість: ${alertDuration}`

      await fetch(
        `https://api.telegram.org/${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${telegramMessageAlertOff}`,
      )
      wasAlertActive = false
    }
  } finally {
    if (browser) {
      try {
        await browser.close()
      } catch (error) {
        console.error('Browser cleanup failed:', error)
      }
    }
  }
}

// Helper functions
function msToTime(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000)
  let h = Math.floor(seconds / 3600)
  let m = Math.floor((seconds % 3600) / 60)
  let s = seconds % 60
  return `${h}h:${m}m:${s}s`
}

//   // Info: after many tries, I found that svg 'path' is not general html element, but it is related to ATTRIBUTE, this why, when logging html elements or nodes of html partent element of 'path' it show nothing -> 'HTMLUnknownElement'. Thus access data attributes with 'attributes' method
//   // document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)').innerHTML // return empty, there are no html, only attributes
//   let dataAlertId = null
//   const svgPath = document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)')
//   if (svgPath.attributes['data-alert-id']) dataAlertId = svgPath.attributes['data-alert-id'].value
//   return dataAlertId // return 'data-alert-id' or 'null'
// })

//ok
