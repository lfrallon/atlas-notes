import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
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

  if (!CESIUM_TOKEN || !GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p>
          Missing required maps env key(s):{' '}
          {!CESIUM_TOKEN && <code>VITE_CESIUM_ION_TOKEN</code>}
          {!CESIUM_TOKEN && !GOOGLE_MAPS_API_KEY && ', '}
          {!GOOGLE_MAPS_API_KEY && <code>VITE_GOOGLE_MAPS_API_KEY</code>}.
        </p>
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
        console.error('Error loading tiles', error)
      }
    }

    loadTiles()

    return () => viewer.destroy()
  }, [])

  return (
    <div className="relative h-screen w-screen items-center">
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
    </div>
  )
}
