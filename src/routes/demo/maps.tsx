import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ConstantProperty,
  HorizontalOrigin,
  Ion,
  IonImageryProvider,
  JulianDate,
  Math as CesiumMath,
  NearFarScalar,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
  ConstantProperty,
} from 'cesium'

// css
import 'cesium/Build/Cesium/Widgets/widgets.css'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
const MAP_MESSAGES_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'
const MAP_MESSAGES_API_URL = `${MAP_MESSAGES_API_BASE_URL}/map-messages`

type MapMessageRecord = {
  id: string
  mapMessage: string
  latitude: number
  longitude: number
  createdAt: string | null
}

type MapMessageApiRecord = {
  id: number | string
  title?: string
  mapMessage?: string
  latitude: number
  longitude: number
  createdAt: string | null
}

const FLOAT_SCALE = new NearFarScalar(600, 1.2, 8_000_000, 0.45)
const FLOAT_ALPHA = new NearFarScalar(500, 1, 6_000_000, 0.25)
const MARKER_SCALE = new NearFarScalar(600, 1.1, 8_000_000, 0.55)
const LABEL_MAX_VISIBLE = 28
const SELECTED_PREVIEW_ID = 'selected-preview'

function extractMessageIdFromPick(picked: unknown): string | null {
  if (!picked || typeof picked !== 'object') return null

  const pickedEntity = (picked as { id?: unknown }).id

  if (typeof pickedEntity === 'string') {
    return pickedEntity.startsWith('message-') ? pickedEntity : null
  }

  if (
    pickedEntity &&
    typeof pickedEntity === 'object' &&
    'id' in pickedEntity &&
    typeof (pickedEntity as { id: unknown }).id === 'string'
  ) {
    const entityId = (pickedEntity as { id: string }).id
    return entityId.startsWith('message-') ? entityId : null
  }

  return null
}

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const isPinningRef = useRef(false)
  const [messages, setMessages] = useState<MapMessageRecord[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [isPinning, setIsPinning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  )
  const [selectedPosition, setSelectedPosition] = useState<{
    lng: number
    lat: number
  } | null>(null)

  const canSubmit =
    draftMessage.trim().length > 0 && !!selectedPosition && !isSubmitting

  useEffect(() => {
    isPinningRef.current = isPinning
  }, [isPinning])

  const selectedLabel = useMemo(() => {
    if (!selectedPosition) return null
    return `${selectedPosition.lat.toFixed(4)}, ${selectedPosition.lng.toFixed(4)}`
  }, [selectedPosition])

  const selectedMessage = useMemo(() => {
    if (!selectedMessageId) return null
    return messages.find(
      (message) => `message-${message.id}` === selectedMessageId,
    )
  }, [messages, selectedMessageId])

  async function fetchMapMessages() {
    const response = await fetch(MAP_MESSAGES_API_URL, {
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Unable to fetch map messages.')
    }

    const data = (await response.json()) as MapMessageApiRecord[]

    setMessages(
      data.map((item) => ({
        id: String(item.id),
        mapMessage: item.mapMessage ?? item.title ?? '',
        latitude: item.latitude,
        longitude: item.longitude,
        createdAt: item.createdAt,
      })),
    )
  }

  useEffect(() => {
    fetchMapMessages().catch(() => {
      setErrorMessage('Could not load map messages. Please try again.')
    })
  }, [])

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
        const pickedHit = viewer.scene.pick(event.position)
        const pickedMessageId = extractMessageIdFromPick(pickedHit)

        if (!isPinningRef.current && pickedMessageId) {
          setSelectedMessageId(pickedMessageId)
          return
        }

        if (!isPinningRef.current) return

        const pickedFromDepth = viewer.scene.pickPositionSupported
          ? viewer.scene.pickPosition(event.position)
          : undefined
        const picked =
          pickedFromDepth ??
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

    viewer.screenSpaceEventHandler.setInputAction(
      (event: { endPosition: Cartesian2 }) => {
        const picked = viewer.scene.pick(event.endPosition)
        setHoveredMessageId(extractMessageIdFromPick(picked))
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    )

    async function loadTiles() {
      try {
        viewer.scene.imageryLayers.addImageryProvider(
          await IonImageryProvider.fromAssetId(3830185),
        )

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
      const createdAtEpoch = item.createdAt
        ? new Date(item.createdAt).getTime()
        : Date.now()

      const pulseOffset = new CallbackProperty((time?: JulianDate) => {
        const safeTime = time ?? JulianDate.now()
        const phase =
          (JulianDate.toDate(safeTime).getTime() - createdAtEpoch) / 600
        const bob = Math.sin(phase) * 4
        return new Cartesian2(0, -24 + bob)
      }, false)

      const position = Cartesian3.fromDegrees(item.longitude, item.latitude, 24)
      const shortMessage =
        item.mapMessage.length > 48
          ? `${item.mapMessage.slice(0, 45).trimEnd()}…`
          : item.mapMessage

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
          text: `✦ ${shortMessage}`,
          font: '500 13px Inter, system-ui, sans-serif',
          fillColor: Color.WHITE,
          style: 2,
          outlineColor: Color.fromCssColorString('#020617').withAlpha(0.85),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.74),
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

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    viewer.entities.values.forEach((entity) => {
      const entityId = entity.id.toString()
      if (!entityId.startsWith('message-')) return

      const isSelected = entityId === selectedMessageId
      const isHovered = entityId === hoveredMessageId

      if (entity.point) {
        entity.point.pixelSize = new ConstantProperty(
          isSelected ? 16 : isHovered ? 14 : 12,
        )
        entity.point.color = new ConstantProperty(
          isSelected
            ? Color.fromCssColorString('#f0abfc').withAlpha(0.98)
            : isHovered
              ? Color.fromCssColorString('#67e8f9').withAlpha(0.98)
              : Color.fromCssColorString('#22d3ee').withAlpha(0.95),
        )
        entity.point.outlineWidth = new ConstantProperty(isSelected ? 3 : 2)
      }

      if (entity.label) {
        entity.label.backgroundColor = new ConstantProperty(
          isSelected
            ? Color.fromCssColorString('#6d28d9').withAlpha(0.78)
            : isHovered
              ? Color.fromCssColorString('#155e75').withAlpha(0.78)
              : Color.fromCssColorString('#0f172a').withAlpha(0.74),
        )
        entity.label.scale = new ConstantProperty(
          isSelected ? 1.06 : isHovered ? 1.03 : 1,
        )
      }
    })
  }, [hoveredMessageId, selectedMessageId, messages])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const applyLabelVisibility = () => {
      if (!viewer.scene) return
      const cameraPosition = viewer.camera.positionWC
      const ranked = messages
        .map((item) => {
          const position = Cartesian3.fromDegrees(
            item.longitude,
            item.latitude,
            24,
          )
          return {
            id: `message-${item.id}`,
            distance: Cartesian3.distance(cameraPosition, position),
          }
        })
        .sort((a, b) => a.distance - b.distance)

      const visibleIds = new Set(
        ranked.slice(0, LABEL_MAX_VISIBLE).map((message) => message.id),
      )
      if (selectedMessageId) visibleIds.add(selectedMessageId)

      viewer.entities.values.forEach((entity) => {
        const entityId = entity.id.toString()
        if (!entityId.startsWith('message-') || !entity.label) return
        entity.label.show = new ConstantProperty(visibleIds.has(entityId))
      })
    }

    applyLabelVisibility()
    viewer.camera.changed.addEventListener(applyLabelVisibility)

    return () => {
      if (viewer.isDestroyed()) return
      viewer.camera.changed.removeEventListener(applyLabelVisibility)
    }
  }, [messages, selectedMessageId])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const existingPreview = viewer.entities.getById(SELECTED_PREVIEW_ID)
    if (existingPreview) {
      viewer.entities.remove(existingPreview)
    }

    if (!selectedMessage) return

    viewer.entities.add({
      id: SELECTED_PREVIEW_ID,
      position: Cartesian3.fromDegrees(
        selectedMessage.longitude,
        selectedMessage.latitude,
        30,
      ),
      label: {
        text: selectedMessage.mapMessage,
        font: '600 14px Inter, system-ui, sans-serif',
        fillColor: Color.WHITE,
        style: 2,
        outlineColor: Color.fromCssColorString('#0f172a').withAlpha(0.95),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Color.fromCssColorString('#312e81').withAlpha(0.8),
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.BOTTOM,
        pixelOffset: new Cartesian2(18, -50),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new NearFarScalar(700, 1, 5_000_000, 0.55),
        translucencyByDistance: new NearFarScalar(700, 1, 5_000_000, 0.15),
      },
    })

    return () => {
      if (viewer.isDestroyed()) return
      const preview = viewer.entities.getById(SELECTED_PREVIEW_ID)
      if (preview) viewer.entities.remove(preview)
    }
  }, [selectedMessage])

  async function handleSubmit() {
    if (!canSubmit || !selectedPosition) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(MAP_MESSAGES_API_URL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mapMessage: draftMessage.trim(),
          latitude: selectedPosition.lat,
          longitude: selectedPosition.lng,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? 'Unable to publish map message.')
      }

      await fetchMapMessages()
      setDraftMessage('')
      setIsPinning(false)
      setSelectedPosition(null)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to publish map message.',
      )
    } finally {
      setIsSubmitting(false)
    }
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
            className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-zinc-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
          >
            {isPinning ? 'Choose location on globe…' : 'Add map message'}
          </button>
          {errorMessage ? (
            <p className="mt-2 text-xs text-rose-300">{errorMessage}</p>
          ) : null}
        </div>

        {isPinning && (
          <div className="pointer-events-auto rounded-2xl bg-linear-to-br from-cyan-300/35 via-violet-300/15 to-fuchsia-300/30 p-px shadow-2xl shadow-black/35">
            <div className="rounded-[calc(1rem-1px)] border border-white/15 bg-zinc-950/65 p-3 text-zinc-100 backdrop-blur-xl">
              <p className="text-sm font-semibold text-cyan-100">
                Compose message
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-cyan-300/45 bg-cyan-500/20 px-2 py-0.5 text-[11px] font-medium text-cyan-100 shadow-sm shadow-cyan-700/20">
                  Drop mode
                </span>
                <span className="rounded-full border border-violet-300/35 bg-violet-500/20 px-2 py-0.5 text-[11px] font-medium text-violet-100 shadow-sm shadow-violet-700/20">
                  {selectedLabel ? selectedLabel : 'Waiting for location'}
                </span>
              </div>
              <input
                type="text"
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder="Share a quick note for this location..."
                className="mt-3 h-10 w-full rounded-lg border border-zinc-600/90 bg-zinc-950/85 px-3 text-sm text-zinc-100 outline-none ring-cyan-300/70 placeholder:text-zinc-400 focus:ring"
                maxLength={140}
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">
                  {draftMessage.trim().length}/140
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-lg bg-cyan-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-950 transition enabled:hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isSubmitting ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedMessage ? (
        <div className="pointer-events-none absolute bottom-6 right-4 z-10 w-[min(22rem,calc(100%-2rem))] rounded-2xl border border-fuchsia-300/35 bg-zinc-950/80 p-3 text-zinc-100 shadow-xl shadow-black/40 backdrop-blur-md">
          <p className="text-[11px] uppercase tracking-wide text-fuchsia-200/90">
            Pin preview
          </p>
          <p className="mt-1 text-xs text-zinc-300">
            Expanded bubble follows the selected marker.
          </p>
        </div>
      ) : null}
    </div>
  )
}
