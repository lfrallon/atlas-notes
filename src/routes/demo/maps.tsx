import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Cartesian3,
  Color,
  createGooglePhotorealistic3DTileset,
  ImageryLayer,
  Ion,
  UrlTemplateImageryProvider,
  Viewer,
} from 'cesium'

// css
import 'cesium/Build/Cesium/Widgets/widgets.css'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

type LabelLayerMode = 'none' | 'open-source' | 'google'

const OPEN_SOURCE_LABEL_ATTRIBUTION =
  'Labels © OpenStreetMap contributors, rendered by CARTO basemaps.'

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const labelLayerRef = useRef<ImageryLayer | null>(null)
  const [labelMode, setLabelMode] = useState<LabelLayerMode>('open-source')

  const hasGoogleMapsApiKey = Boolean(GOOGLE_MAPS_API_KEY)

  const labelModeOptions = useMemo(
    () => [
      { value: 'none' as const, label: 'None' },
      { value: 'open-source' as const, label: 'Open-source labels' },
      {
        value: 'google' as const,
        label: hasGoogleMapsApiKey
          ? 'Google labels (requires billing-enabled key)'
          : 'Google labels (set VITE_GOOGLE_MAPS_API_KEY)',
        disabled: !hasGoogleMapsApiKey,
      },
      // Optional future work: add premium/advanced label providers here
      // (for example Mapbox, HERE, or domain-specific paid overlays).
    ],
    [hasGoogleMapsApiKey],
  )

  useEffect(() => {
    if (!CESIUM_TOKEN || !containerRef.current) return

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

    viewerRef.current = viewer

    async function loadTiles() {
      try {
        if (GOOGLE_MAPS_API_KEY) {
          const tileset = await createGooglePhotorealistic3DTileset({
            key: GOOGLE_MAPS_API_KEY,
          })

          viewer.scene.primitives.add(tileset)
        }

        const position = Cartesian3.fromDegrees(122, 10)

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

    return () => {
      labelLayerRef.current = null
      viewerRef.current = null
      viewer.destroy()
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current

    if (!viewer) return

    if (labelLayerRef.current) {
      viewer.imageryLayers.remove(labelLayerRef.current, true)
      labelLayerRef.current = null
    }

    if (labelMode === 'none') {
      return
    }

    if (labelMode === 'open-source') {
      labelLayerRef.current = viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c', 'd'],
          credit: OPEN_SOURCE_LABEL_ATTRIBUTION,
        }),
      )
      return
    }

    if (labelMode === 'google' && GOOGLE_MAPS_API_KEY) {
      labelLayerRef.current = viewer.imageryLayers.addImageryProvider(
        new UrlTemplateImageryProvider({
          url: `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`,
          credit:
            'Google Maps labels. Use is subject to Google Maps Platform Terms and billing.',
        }),
      )
    }
  }, [labelMode])

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

  return (
    <div className="relative h-screen w-screen items-center">
      <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />

      <div className="absolute left-4 top-4 z-10 w-72 rounded-md border border-zinc-700 bg-zinc-900/90 p-3 text-sm text-zinc-100 shadow-lg backdrop-blur-sm">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-300">
          Label layer
        </h2>

        <div className="flex flex-col gap-2">
          {labelModeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2 ${option.disabled ? 'opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="label-layer-mode"
                value={option.value}
                checked={labelMode === option.value}
                disabled={option.disabled}
                onChange={() => setLabelMode(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {labelMode === 'open-source' ? (
          <p className="mt-3 text-xs text-zinc-300">{OPEN_SOURCE_LABEL_ATTRIBUTION}</p>
        ) : null}

        {labelMode === 'google' ? (
          <p className="mt-3 text-xs text-amber-300">
            Google labels can incur usage-based billing and must comply with
            provider terms.
          </p>
        ) : null}
      </div>
    </div>
  )
}
