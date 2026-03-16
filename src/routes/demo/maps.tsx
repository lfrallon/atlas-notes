import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: Cesium.Viewer

    async function initCesium() {
      Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

      viewer = new Cesium.Viewer(containerRef.current!, {
        geocoder: Cesium.IonGeocodeProviderType.GOOGLE,
        terrainProvider: await Cesium.createWorldTerrainAsync(),
      })

      viewer.scene.globe.enableLighting = true

      // Apply custom imagery layer from Cesium Ion
      const layers = viewer.imageryLayers.addImageryProvider(
        await Cesium.IonImageryProvider.fromAssetId(3830186),
      )

      viewer.zoomTo(layers)

      const position = Cesium.Cartesian3.fromDegrees(122, 10)

      viewer.entities.add({
        position,
        point: {
          pixelSize: 10,
          color: Cesium.Color.RED,
        },
      })

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(122, 10, 2000000),
      })
    }

    initCesium()

    return () => {
      viewer?.destroy()
    }
  }, [CESIUM_TOKEN])

  return (
    <div
      ref={containerRef}
      style={{ width: '100vw', height: '100vh' }}
      className="bg-black"
    />
  )
}
