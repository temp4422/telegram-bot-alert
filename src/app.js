import { loadEnvFile, env } from 'node:process'
import { existsSync } from 'node:fs'
import puppeteer from 'puppeteer'

loadEnvFile(existsSync('.env') ? '.env' : '.env.production')

// prettier-ignore
if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.PUPPETEER_EXECUTABLE_PATH || !env.PUPPETEER_SKIP_DOWNLOAD) {
  throw new Error(`Missing environment variable.`)
}

let wasAlertActive = false
let isAlertActive = false
let alertTimeStart // Date.now() // Get time of alert in unix timestamp format

async function run() {
  // Launch the browser, open page, go to URL
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()
  const response = await page.goto('https://alerts.in.ua')
  if (!response?.ok()) throw new Error('Page not loaded.')

  // Adding timeout fix 'isAlertActive' return 'null' sometimes.
  // Probably site is not able to generate content fast enough.
  await new Promise((r) => setTimeout(r, 1000))

  // Check svg attribute
  isAlertActive = await page.$eval('#super-lite-map > g.oblasts > path:nth-child(3)', (element) =>
    element.getAttribute('class').includes('active'),
  )

  // Send HTTP GET request to Telegram bot API
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN
  const telegramChatId = env.TELEGRAM_CHAT_ID

  if (isAlertActive && !wasAlertActive) {
    const telegramMessageAlertOn = `🔴 Повітряна тривога у Закарпатській області. КИЇВСЬКА ОБЛ`
    alertTimeStart = Date.now()

    await fetch(
      `https://api.telegram.org/${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${telegramMessageAlertOn}`,
    )
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

  await browser.close()
}

// Run every 30 sec
setInterval(() => {
  run()
}, 30000)

function msToTime(milliseconds) {
  let seconds = Math.floor(milliseconds / 1000)
  let h = Math.floor(seconds / 3600)
  let m = Math.floor((seconds % 3600) / 60)
  let s = seconds % 60
  return `${h}h:${m}m:${s}s`
}

// // Graceful shutdown
//   process.on('SIGINT', () => {
//     // mongoDbClient.close()
//     // bot.stop('SIGINT')
//     process.exit(0)
//   })
//   process.on('SIGTERM', () => {
//     // mongoDbClient.close()
//     // bot.stop('SIGTERM')
//     process.exit(0)
//   })

// // Wait for element to be loaded
// await page.waitForSelector('#super-lite-map > g.oblasts > path:nth-child(22)') // Not sure if it works properly
// const isAlertActive = await page.evaluate(() => {
//   // Browser context
//   // Info: after many tries, I found that svg 'path' is not general html element, but it is related to ATTRIBUTE, this why, when logging html elements or nodes of html partent element of 'path' it show nothing -> 'HTMLUnknownElement'. Thus access data attributes with 'attributes' method
//   // document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)').innerHTML // return empty, there are no html, only attributes
//   let dataAlertId = null
//   const svgPath = document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)')
//   if (svgPath.attributes['data-alert-id']) dataAlertId = svgPath.attributes['data-alert-id'].value
//   return dataAlertId // return 'data-alert-id' or 'null'
// })
