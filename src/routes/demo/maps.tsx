import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  Cartesian3,
  Color,
  createGooglePhotorealistic3DTileset,
  Ion,
  Viewer,
} from 'cesium'

// css
import 'cesium/Build/Cesium/Widgets/widgets.css'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tilesError, setTilesError] = useState<string | null>(null)

  if (!CESIUM_TOKEN) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p>
          Missing <code>VITE_CESIUM_ION_TOKEN</code>. Add your Cesium Ion token
          to render the globe.
        </p>
      </div>
    )
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="max-w-xl space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/80 p-6">
          <h1 className="text-xl font-semibold">Missing Google Maps API key</h1>
          <p>
            Set <code>VITE_GOOGLE_MAPS_API_KEY</code> before rendering
            photorealistic 3D tiles.
          </p>
          <div>
            <h2 className="mb-1 font-medium">Local / development</h2>
            <p className="text-sm text-zinc-300">
              Add{' '}
              <code className="rounded bg-zinc-800 px-1 py-0.5">
                VITE_GOOGLE_MAPS_API_KEY=your_key_here
              </code>{' '}
              to your <code>.env</code> file, then restart the dev server.
            </p>
          </div>
          <div>
            <h2 className="mb-1 font-medium">Cloudflare deployment</h2>
            <p className="text-sm text-zinc-300">
              In Cloudflare Pages, add <code>VITE_GOOGLE_MAPS_API_KEY</code> as
              an environment variable for your target environment and redeploy.
            </p>
          </div>
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!containerRef.current) return

    Ion.defaultAccessToken = CESIUM_TOKEN
    const viewer = new Viewer(containerRef.current, {
      geocoder: true,
      baseLayerPicker: false,
      timeline: false,
      animation: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      homeButton: false,
    })

    async function loadTiles() {
      if (!GOOGLE_MAPS_API_KEY) {
        setTilesError(
          'Missing VITE_GOOGLE_MAPS_API_KEY. Configure it to load Google photorealistic 3D tiles.',
        )
        return
      }

      try {
        const tileset = await createGooglePhotorealistic3DTileset({
          key: GOOGLE_MAPS_API_KEY,
        })
        const position = Cartesian3.fromDegrees(122, 10)

        viewer.scene.primitives.add(tileset)
        viewer.entities.add({
          position,
          point: {
            pixelSize: 10,
            color: Color.GREEN,
          },
        })
        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(122, 10, 2000000),
        })
      } catch (error) {
        setTilesError(
          'Unable to load Google photorealistic 3D tiles. Verify your API key and billing/project settings.',
        )
        console.error('Error loading tiles', error)
      }
    }

    loadTiles()

    return () => viewer.destroy()
  }, [])

  return (
    <div className="relative h-screen w-screen items-center">
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
      {tilesError ? (
        <div className="pointer-events-none absolute left-4 top-4 max-w-md rounded-md border border-red-900/80 bg-red-950/90 p-3 text-sm text-red-100">
          {tilesError}
        </div>
      ) : null}
    </div>
  )
}
