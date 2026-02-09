import fs from 'fs'

fs.cp('src', 'dist', { recursive: true }, (err) => {
  if (err) console.error('Error while copying folder:', err), process.exit(1)
})
