import fs from 'node:fs'
import path from 'node:path'

const src = 'node_modules/cesium/Build/Cesium'
const dest = 'public/cesium'

try {
  fs.cpSync(src, dest, { recursive: true })
  console.log('Cesium assets copied')
} catch (error) {
  console.error('Error copying Cesium assets:', error)
}
