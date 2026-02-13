import { loadEnvFile } from 'node:process'
import { existsSync } from 'node:fs'

loadEnvFile(existsSync('.env') ? '.env' : '.env.production')
// loadEnvFile('.env')

import { env } from 'node:process'
import puppeteer from 'puppeteer'

// prettier-ignore
if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID || !env.PUPPETEER_EXECUTABLE_PATH || !env.PUPPETEER_SKIP_DOWNLOAD) {
  throw new Error(`Missing environment variable.`)
}

// import jsdom from 'jsdom'
// const dom = new jsdom.JSDOM(`<!DOCTYPE html><p>Hello world</p>`)
// const text = dom.window.document.querySelector('p').textContent

let onAlert = false
let alertTimeStart // Date.now() // Get time of alert in unix timestamp format

async function run() {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: env.PUPPETEER_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  const page = await browser.newPage()

  // Navigate the page to a URL
  await page.goto('https://alerts.in.ua')

  // Wait for element to be loaded
  await page.waitForSelector('#super-lite-map > g.oblasts > path:nth-child(22)') // Not sure if it works properly
  await new Promise((r) => setTimeout(r, 1000)) // Adding timeout fix 'alertId' return 'null' sometimes

  const alertId = await page.evaluate(() => {
    // Browser context
    // Info: after many tries, I found that svg 'path' is not general html element, but it is related to ATTRIBUTE, this why, when logging html elements or nodes of html partent element of 'path' it show nothing -> 'HTMLUnknownElement'. Thus access data attributes with 'attributes' method
    // document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)').innerHTML // return empty, there are no html, only attributes
    let dataAlertId = null
    const svgPath = document.querySelector('#super-lite-map > g.oblasts > path:nth-child(22)')
    if (svgPath.attributes['data-alert-id']) dataAlertId = svgPath.attributes['data-alert-id'].value
    return dataAlertId // return 'data-alert-id' or 'null'
  })

  // Send HTTP GET request to Telegram bot API
  const telegramBotToken = env.TELEGRAM_BOT_TOKEN
  const telegramChatId = env.TELEGRAM_CHAT_ID

  // await new Promise((resolve) => setTimeout(() => resolve(), 1000)) //test time

  if (alertId && !onAlert) {
    const telegramMessageAlertOn = `🔴 Повітряна тривога у Закарпатській області.`
    alertTimeStart = Date.now()

    await fetch(
      `https://api.telegram.org/${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${telegramMessageAlertOn}`,
    )
    onAlert = true
  }

  if (!alertId && onAlert) {
    let alertTimeEnd = Date.now()
    const alertDuration = msToTime(alertTimeEnd - alertTimeStart)
    const telegramMessageAlertOff = `🟢 Кінець тривоги.\nТривалість: ${alertDuration}`

    await fetch(
      `https://api.telegram.org/${telegramBotToken}/sendMessage?chat_id=${telegramChatId}&text=${telegramMessageAlertOff}`,
    )
    onAlert = false
  }

  await browser.close()
}

// Run every 30 sec
setInterval(() => {
  run()
}, 30000)

function msToTime(milliseconds) {
  let h = Math.floor(milliseconds / 1000 / 60 / 60)
  let m = Math.floor((milliseconds / 1000 / 60 / 60 - h) * 60)
  let s = Math.floor(((milliseconds / 1000 / 60 / 60 - h) * 60 - m) * 60)
  // s < 10 ? (s = `0${s}`) : (s = `${s}`)
  // m < 10 ? (m = `0${m}`) : (m = `${m}`)
  // h < 10 ? (h = `0${h}`) : (h = `${h}`)
  return `${h}h:${m}m:${s}s`
}
