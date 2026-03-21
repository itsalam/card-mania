#!/usr/bin/env node
/**
 * Minimal static file server for gojs-demo.html.
 * No external deps required.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { exec } = require('child_process')

const port = Number(process.env.PORT) || 4173
const root = path.resolve(__dirname, '..')
const defaultFile = 'design/index.html'

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0])
  const safePath =
    urlPath === '/' ? defaultFile : urlPath.startsWith('/') ? urlPath.slice(1) : urlPath

  const filePath = path.join(root, safePath)
  if (!filePath.startsWith(root)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }

  let target = filePath
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    target = path.join(filePath, 'index.html')
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    const ext = path.extname(target)
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    res.end(data)
  })
})

server.listen(port, () => {
  const url = `http://localhost:${port}/${defaultFile}`
  console.log(`Serving design doc at ${url}`)
  openBrowser(url)
  watchAndRebuild()
})

function openBrowser(url) {
  const platform = process.platform
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'

  const child = spawn(cmd, [url], { stdio: 'ignore', shell: true })
  child.on('error', () => {
    console.log(`Unable to auto-open browser. Visit ${url}`)
  })
}

function watchAndRebuild() {
  const watchPaths = ['design/src', 'design/index.html', 'design/styles.css']
  watchPaths.forEach((p) => {
    fs.watch(p, { recursive: true }, (_, filename) => {
      if (!filename) return
      console.log(`[design] change detected in ${filename}, rebuilding...`)
      const proc = exec('npm run design:build')
      proc.stdout?.on('data', (d) => process.stdout.write(d))
      proc.stderr?.on('data', (d) => process.stderr.write(d))
      proc.on('exit', (code) => {
        if (code === 0) {
          console.log('[design] rebuild complete')
        } else {
          console.log(`[design] rebuild failed with code ${code}`)
        }
      })
    })
  })
}
