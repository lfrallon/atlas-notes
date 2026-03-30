import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  HorizontalOrigin,
  Ion,
  IonImageryProvider,
  JulianDate,
  Math as CesiumMath,
  NearFarScalar,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
} from 'cesium'

// css
import 'cesium/Build/Cesium/Widgets/widgets.css'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
// const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

type MessageRecord = {
  id: string
  message: string
  lng: number
  lat: number
  height: number
  createdAt: number
}

const FLOAT_SCALE = new NearFarScalar(600, 1.2, 8_000_000, 0.45)
const FLOAT_ALPHA = new NearFarScalar(500, 1, 6_000_000, 0.25)
const MARKER_SCALE = new NearFarScalar(600, 1.1, 8_000_000, 0.55)

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const isPinningRef = useRef(false)
  const [messages, setMessages] = useState<MessageRecord[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [isPinning, setIsPinning] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<{
    lng: number
    lat: number
  } | null>(null)

  const canSubmit = draftMessage.trim().length > 0 && !!selectedPosition

  useEffect(() => {
    isPinningRef.current = isPinning
  }, [isPinning])

  const selectedLabel = useMemo(() => {
    if (!selectedPosition) return null
    return `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`
  }, [selectedPosition])

  if (!CESIUM_TOKEN) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--app-header-height))] w-full items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p>
          Missing <code>VITE_CESIUM_ION_TOKEN</code>. Add your Cesium Ion token
          to render the globe.
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

    viewerRef.current = viewer

    viewer.screenSpaceEventHandler.setInputAction(
      (event: { position: Cartesian2 }) => {
        if (!isPinningRef.current) return

        const picked =
          viewer.scene.pickPosition(event.position) ??
          viewer.camera.pickEllipsoid(
            event.position,
            viewer.scene.globe.ellipsoid,
          )

        if (!picked) return

        const cartographic = Cartographic.fromCartesian(picked)
        setSelectedPosition({
          lng: CesiumMath.toDegrees(cartographic.longitude),
          lat: CesiumMath.toDegrees(cartographic.latitude),
        })
      },
      ScreenSpaceEventType.LEFT_CLICK,
    )

    async function loadTiles() {
      try {
        // const tileset = await createGooglePhotorealistic3DTileset({
        //   key: GOOGLE_MAPS_API_KEY,
        // })

        viewer.scene.imageryLayers.addImageryProvider(
          await IonImageryProvider.fromAssetId(3830185),
        )
        // viewer.scene.primitives.add(tileset)

        viewer.camera.flyTo({
          destination: Cartesian3.fromDegrees(122, 10, 2000000),
        })
      } catch (error) {
        console.log('Error loading tiles', error)
      }
    }

    loadTiles()

    return () => {
      viewerRef.current = null
      viewer.destroy()
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer) return

    viewer.entities.values
      .filter((entity) => entity.id.toString().startsWith('message-'))
      .forEach((entity) => viewer.entities.remove(entity))

    for (const item of messages) {
      const pulseOffset = new CallbackProperty((time?: JulianDate) => {
        const safeTime = time ?? JulianDate.now()
        const phase = (JulianDate.toDate(safeTime).getTime() - item.createdAt) / 600
        const bob = Math.sin(phase) * 4
        return new Cartesian2(0, -24 + bob)
      }, false)

      const position = Cartesian3.fromDegrees(item.lng, item.lat, item.height)
      const shortMessage =
        item.message.length > 48
          ? `${item.message.slice(0, 45).trimEnd()}…`
          : item.message

      viewer.entities.add({
        id: `message-${item.id}`,
        position,
        point: {
          pixelSize: 12,
          color: Color.fromCssColorString('#22d3ee').withAlpha(0.95),
          outlineColor: Color.fromCssColorString('#0f172a').withAlpha(0.8),
          outlineWidth: 2,
          heightReference: 0,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: MARKER_SCALE,
          translucencyByDistance: FLOAT_ALPHA,
        },
        label: {
          text: shortMessage,
          font: '500 13px Inter, system-ui, sans-serif',
          fillColor: Color.WHITE,
          style: 2,
          outlineColor: Color.fromCssColorString('#020617').withAlpha(0.85),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.7),
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: pulseOffset,
          eyeOffset: new Cartesian3(0, 0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: FLOAT_SCALE,
          translucencyByDistance: FLOAT_ALPHA,
        },
      })
    }
  }, [messages])

  function handleSubmit() {
    if (!canSubmit || !selectedPosition) return

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        message: draftMessage.trim(),
        lng: selectedPosition.lng,
        lat: selectedPosition.lat,
        height: 24,
        createdAt: Date.now(),
      },
    ])

    setDraftMessage('')
    setIsPinning(false)
    setSelectedPosition(null)
  }

  function handleCancel() {
    setDraftMessage('')
    setSelectedPosition(null)
    setIsPinning(false)
  }

  return (
    <div className="relative min-h-[calc(100dvh-var(--app-header-height))] w-full overflow-hidden bg-zinc-950">
      <div className="h-[calc(100dvh-var(--app-header-height))] w-full">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex w-[min(26rem,calc(100%-2rem))] flex-col gap-3">
        <div className="pointer-events-auto rounded-2xl border border-zinc-700/70 bg-zinc-900/80 p-4 text-zinc-100 shadow-xl backdrop-blur-md">
          <p className="text-sm font-medium text-zinc-200">Community pins</p>
          <p className="mt-1 text-xs text-zinc-400">
            {isPinning
              ? 'Click on the globe to choose a location, then write your message.'
              : 'Drop floating messages directly onto the map.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsPinning(true)
              setSelectedPosition(null)
            }}
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-cyan-400"
          >
            {isPinning ? 'Choose location on globe…' : 'Add map message'}
          </button>
        </div>

        {isPinning && (
          <div className="pointer-events-auto rounded-2xl border border-cyan-400/40 bg-zinc-900/85 p-4 text-zinc-100 shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold text-cyan-200">
              Compose message
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              {selectedLabel
                ? `Selected coordinates: ${selectedLabel}`
                : 'Pick a location by clicking the globe.'}
            </p>
            <textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder="Share a quick note for this location..."
              className="mt-3 min-h-24 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-cyan-300/60 placeholder:text-zinc-500 focus:ring"
              maxLength={140}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">
                {draftMessage.trim().length}/140 chars
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition enabled:hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Publish pin
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
