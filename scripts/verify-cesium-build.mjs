import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const outputDir = process.argv[2] ?? path.join('dist', 'client')

const requiredPaths = [
  path.join('cesium', 'Workers'),
  path.join('cesium', 'Assets'),
  path.join('cesium', 'ThirdParty'),
  path.join('cesium', 'Widgets'),
]

const missing = requiredPaths.filter(
  (relativePath) => !existsSync(path.join(outputDir, relativePath)),
)

if (missing.length > 0) {
  console.error(
    `Missing Cesium build assets in ${outputDir}:\n${missing.map((item) => `- ${item}`).join('\n')}`,
  )
  process.exit(1)
}

console.log(`Cesium build assets found in ${outputDir}.`)
