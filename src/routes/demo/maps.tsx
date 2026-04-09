import { createFileRoute } from '@tanstack/react-router'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import ReactPlayer from 'react-player'
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
  Scene,
  SceneTransforms,
} from 'cesium'
import { MapPin, MapPinPlus } from 'lucide-react'

// css
import 'cesium/Build/Cesium/Widgets/widgets.css'

// types
const searchSchema = z
  .object({
    nextCursor: z
      .object({
        id: z.string(),
        updatedAt: z.string(),
      })
      .optional(),
  })
  .optional()

type SearchQuery = z.infer<typeof searchSchema>

type MapMessagesInput = {
  pageSize?: number
  orderBy?: 'asc' | 'desc'
  bbox?: string
}

type HotspotConfig = {
  id: 'us' | 'uk' | 'india' | 'japan' | 'brazil' | 'western-europe'
  bbox: string
}

type MapViewport = {
  west: number
  south: number
  east: number
  north: number
  zoomBucket: 'broad' | 'medium' | 'close'
}

type TFetchMapMessages = {
  pageParam: SearchQuery
  queryKey: [
    string,
    {
      baseUrl: string
      input: MapMessagesInput
      bboxKey: string
      zoomBucket: MapViewport['zoomBucket']
    },
  ]
}

type MapMessagesPage = {
  nodes: Array<MapMessagesNodes>
  pageInfo: {
    hasNextPage: boolean
    nextCursor: {
      id: string
      updatedAt: string
    }
    totalPages: number
  }
  totalCount: number
}

interface MapMessagesNodes {
  id: string
  mapMessage: string
  latitude: number
  longitude: number
  createdAt: string | null
  userId?: string
  videoUrl?: string | null
}

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN
const MAP_MESSAGES_API_BASE_URL =
  import.meta.env.VITE_FASTIFY_API_URL ?? 'http://localhost:3006/api/v1'
const MAP_MESSAGES_API_URL = `${MAP_MESSAGES_API_BASE_URL}/map-messages`
const FLOAT_SCALE = new NearFarScalar(600, 1.2, 8_000_000, 0.45)
const FLOAT_ALPHA = new NearFarScalar(500, 1, 6_000_000, 0.25)
const MARKER_SCALE = new NearFarScalar(600, 1.1, 8_000_000, 0.55)
const LABEL_MAX_VISIBLE = 28
const CAMERA_SETTLE_DEBOUNCE_MS = 300
const BBOX_ROUNDING_FACTOR = 10
const HOTSPOT_PAGE_SIZE = 80
const MAX_RENDERED_MESSAGES = 500
const HOTSPOTS: HotspotConfig[] = [
  { id: 'us', bbox: '-125,24,-66,49' },
  { id: 'uk', bbox: '-8,49,2,59' },
  { id: 'india', bbox: '68,6,97,37' },
  { id: 'japan', bbox: '129,31,146,46' },
  { id: 'brazil', bbox: '-74,-34,-34,5' },
  { id: 'western-europe', bbox: '-11,36,18,61' },
]

function getZoomBucket(height: number): MapViewport['zoomBucket'] {
  if (height > 2_000_000) return 'broad'
  if (height > 600_000) return 'medium'
  return 'close'
}

function roundToBucket(value: number) {
  return Math.round(value * BBOX_ROUNDING_FACTOR) / BBOX_ROUNDING_FACTOR
}

function getViewportFromViewer(viewer: Viewer): MapViewport | null {
  const rectangle = viewer.camera.computeViewRectangle(
    viewer.scene.globe.ellipsoid,
  )
  if (!rectangle) return null

  const west = CesiumMath.toDegrees(rectangle.west)
  const south = CesiumMath.toDegrees(rectangle.south)
  const east = CesiumMath.toDegrees(rectangle.east)
  const north = CesiumMath.toDegrees(rectangle.north)
  const zoomBucket = getZoomBucket(viewer.camera.positionCartographic.height)

  return { west, south, east, north, zoomBucket }
}

function buildBbox(viewport: MapViewport) {
  return `${viewport.west},${viewport.south},${viewport.east},${viewport.north}`
}

function buildBboxKey(viewport: MapViewport) {
  return `${roundToBucket(viewport.west)},${roundToBucket(viewport.south)},${roundToBucket(viewport.east)},${roundToBucket(viewport.north)}`
}

function getPageSizeForZoomBucket(zoomBucket: MapViewport['zoomBucket']) {
  if (zoomBucket === 'broad') return 100
  if (zoomBucket === 'medium') return 250
  return 500
}

const scratchSurfaceNormal = new Cartesian3()
const scratchToCamera = new Cartesian3()

function isPointVisibleFromCamera(
  scene: Scene,
  worldPoint: Cartesian3,
): boolean {
  const globe = scene.globe
  const ellipsoid = globe?.ellipsoid
  if (!ellipsoid) return true

  const surfaceNormal = ellipsoid.geodeticSurfaceNormal(
    worldPoint,
    scratchSurfaceNormal,
  )
  const toCamera = Cartesian3.subtract(
    scene.camera.positionWC,
    worldPoint,
    scratchToCamera,
  )

  return Cartesian3.dot(surfaceNormal, toCamera) > 0
}

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

async function getMapMessages({ pageParam, queryKey }: TFetchMapMessages) {
  const [, { baseUrl, input }] = queryKey

  const response = await fetch(
    `${baseUrl}?pageSize=${input?.pageSize ?? 10}&orderBy=${input?.orderBy ?? 'asc'}${input?.bbox ? `&bbox=${encodeURIComponent(input.bbox)}` : ''}${pageParam?.nextCursor ? `&id=${pageParam.nextCursor.id}` : ''}${pageParam?.nextCursor ? `&updatedAt=${JSON.stringify(pageParam.nextCursor.updatedAt)}` : ''}`,
    {
      credentials: 'include',
    },
  )

  const data: MapMessagesPage = await response.json()
  return data
}

function toMessageNodes(data?: MapMessagesPage) {
  if (!data) return []

  return data.nodes.map((node) => ({
    id: String(node.id),
    mapMessage: node.mapMessage,
    latitude: node.latitude,
    longitude: node.longitude,
    createdAt: node.createdAt,
    videoUrl: node.videoUrl,
  }))
}

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const selectedCardRef = useRef<HTMLDivElement | null>(null)
  const selectedPinRef = useRef<HTMLDivElement | null>(null)
  const cameraDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPinningRef = useRef(false)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [draftVideoUrl, setDraftVideoUrl] = useState('')
  const [isPinning, setIsPinning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  )
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<{
    lng: number
    lat: number
  } | null>(null)
  const [cursorPosition, setCursorPosition] = useState<{
    lat: number
    lng: number
    x: number
    y: number
  } | null>(null)

  const viewportQueryState = useMemo(() => {
    if (!viewport) return null
    const bboxKey = buildBboxKey(viewport)
    return {
      bboxKey,
      zoomBucket: viewport.zoomBucket,
      input: {
        pageSize: getPageSizeForZoomBucket(viewport.zoomBucket),
        orderBy: 'desc' as const,
        bbox: buildBbox(viewport),
      },
    }
  }, [viewport])

  const { data } = useInfiniteQuery<MapMessagesPage, Error>({
    queryKey: [
      'map-messages',
      {
        baseUrl: MAP_MESSAGES_API_URL,
        input: viewportQueryState?.input ?? {},
        bboxKey: viewportQueryState?.bboxKey ?? 'unknown',
        zoomBucket: viewportQueryState?.zoomBucket ?? 'broad',
      },
    ],
    enabled: !!viewportQueryState,
    queryFn: async ({ pageParam, queryKey }) =>
      await getMapMessages({
        pageParam: pageParam as SearchQuery,
        queryKey: queryKey as [
          string,
          {
            baseUrl: string
            input: MapMessagesInput
            bboxKey: string
            zoomBucket: MapViewport['zoomBucket']
          },
        ],
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => {
      if ('error' in lastPage) {
        return undefined
      }

      if (lastPage.pageInfo.hasNextPage) {
        return {
          nextCursor: lastPage.pageInfo.nextCursor,
        }
      }
      return undefined
    },
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  })

  const hotspotQueries = useQueries({
    queries: HOTSPOTS.map((hotspot) => ({
      queryKey: ['map-messages', { hotspot: hotspot.id }],
      queryFn: async () =>
        await getMapMessages({
          pageParam: undefined,
          queryKey: [
            'map-messages',
            {
              baseUrl: MAP_MESSAGES_API_URL,
              input: {
                pageSize: HOTSPOT_PAGE_SIZE,
                orderBy: 'desc',
                bbox: hotspot.bbox,
              },
              bboxKey: hotspot.id,
              zoomBucket: 'broad',
            },
          ],
        }),
      staleTime: 10 * 60_000,
    })),
  })

  const viewportMessages = useMemo(() => {
    if (!data || Object.keys(data).length === 0) return []
    if ('error' in data.pages[0]) return []

    return data.pages.flatMap((item) => toMessageNodes(item))
  }, [data])

  const mergedHotspotMessages = useMemo(() => {
    const merged = hotspotQueries.flatMap((hotspotQuery) =>
      toMessageNodes(hotspotQuery.data),
    )
    return Array.from(
      new Map(merged.map((message) => [message.id, message])).values(),
    )
  }, [hotspotQueries])

  const sourceMessages = useMemo(() => {
    if (hasUserInteracted) return viewportMessages

    return Array.from(
      new Map(
        [...viewportMessages, ...mergedHotspotMessages].map((message) => [
          message.id,
          message,
        ]),
      ).values(),
    )
  }, [hasUserInteracted, viewportMessages, mergedHotspotMessages])

  const messages = useMemo(() => {
    if (sourceMessages.length <= MAX_RENDERED_MESSAGES) return sourceMessages

    return [...sourceMessages]
      .sort(
        (a, b) =>
          (new Date(b.createdAt ?? 0).getTime() || 0) -
          (new Date(a.createdAt ?? 0).getTime() || 0),
      )
      .slice(0, MAX_RENDERED_MESSAGES)
  }, [sourceMessages])

  const addMapMessagesMutation = useMutation({
    mutationFn: async ({
      data,
    }: {
      data: {
        title: string
        mapMessage: string
        latitude: number
        longitude: number
        videoUrl?: string
      }
    }) =>
      fetch(`${MAP_MESSAGES_API_URL}/add`, {
        method: 'POST',
        headers: {
          accept: '*/*',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['map-messages'] }),
      ])
    },
  })

  const canSubmit =
    draftMessage.trim().length > 0 && !!selectedPosition && !isSubmitting

  useEffect(() => {
    isPinningRef.current = isPinning
  }, [isPinning])

  useEffect(() => {
    if (!isPinning) {
      setCursorPosition(null)
    }
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

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return
    if ('error' in data.pages[0]) {
      setErrorMessage('Could not load map messages. Please try again.')
      return
    }
  }, [data])

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

    for (const hotspot of HOTSPOTS) {
      queryClient.prefetchQuery({
        queryKey: ['map-messages', { hotspot: hotspot.id }],
        queryFn: async () =>
          await getMapMessages({
            pageParam: undefined,
            queryKey: [
              'map-messages',
              {
                baseUrl: MAP_MESSAGES_API_URL,
                input: {
                  pageSize: HOTSPOT_PAGE_SIZE,
                  orderBy: 'desc',
                  bbox: hotspot.bbox,
                },
                bboxKey: hotspot.id,
                zoomBucket: 'broad',
              },
            ],
          }),
        staleTime: 10 * 60_000,
      })
    }

    viewer.screenSpaceEventHandler.setInputAction(
      (event: { position: Cartesian2 }) => {
        const pickedHit = viewer.scene.pick(event.position)
        const pickedMessageId = extractMessageIdFromPick(pickedHit)

        if (!isPinningRef.current) {
          if (pickedMessageId) {
            setSelectedMessageId(pickedMessageId)
          } else {
            setSelectedMessageId(null)
          }
          return
        }

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

        if (!isPinningRef.current) {
          setCursorPosition(null)
          return
        }

        const pickedFromDepth = viewer.scene.pickPositionSupported
          ? viewer.scene.pickPosition(event.endPosition)
          : undefined
        const pickedPosition =
          pickedFromDepth ??
          viewer.camera.pickEllipsoid(
            event.endPosition,
            viewer.scene.globe.ellipsoid,
          )

        if (!pickedPosition) {
          setCursorPosition(null)
          return
        }

        const cartographic = Cartographic.fromCartesian(pickedPosition)
        setCursorPosition({
          lat: CesiumMath.toDegrees(cartographic.latitude),
          lng: CesiumMath.toDegrees(cartographic.longitude),
          x: event.endPosition.x,
          y: event.endPosition.y,
        })
      },
      ScreenSpaceEventType.MOUSE_MOVE,
    )

    viewer.screenSpaceEventHandler.setInputAction(
      () => setHasUserInteracted(true),
      ScreenSpaceEventType.WHEEL,
    )
    viewer.screenSpaceEventHandler.setInputAction(
      () => setHasUserInteracted(true),
      ScreenSpaceEventType.PINCH_START,
    )
    viewer.screenSpaceEventHandler.setInputAction(
      () => setHasUserInteracted(true),
      ScreenSpaceEventType.LEFT_DOWN,
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

    const syncViewport = () => {
      const nextViewport = getViewportFromViewer(viewer)
      if (nextViewport) {
        setViewport(nextViewport)
      }
    }

    syncViewport()

    const onCameraChanged = () => {
      if (cameraDebounceRef.current) {
        clearTimeout(cameraDebounceRef.current)
      }
      cameraDebounceRef.current = setTimeout(() => {
        syncViewport()
      }, CAMERA_SETTLE_DEBOUNCE_MS)
    }

    viewer.camera.changed.addEventListener(onCameraChanged)

    return () => {
      if (cameraDebounceRef.current) {
        clearTimeout(cameraDebounceRef.current)
      }
      viewer.camera.changed.removeEventListener(onCameraChanged)
      viewerRef.current = null
      viewer.destroy()
    }
  }, [queryClient])

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
          pixelSize: 16,
          color: Color.fromCssColorString('#38bdf8').withAlpha(0.98),
          outlineColor: Color.fromCssColorString('#e0f2fe').withAlpha(0.95),
          outlineWidth: 3,
          heightReference: 0,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: MARKER_SCALE,
          translucencyByDistance: FLOAT_ALPHA,
        },
        label: {
          text: `● ${shortMessage}`,
          font: '600 13px Inter, system-ui, sans-serif',
          fillColor: Color.fromCssColorString('#e2e8f0'),
          style: 2,
          outlineColor: Color.fromCssColorString('#020617').withAlpha(0.85),
          outlineWidth: 3,
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#0f172a').withAlpha(0.88),
          backgroundPadding: new Cartesian2(16, 10),
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
        entity.point.pixelSize = isSelected
          ? new CallbackProperty(() => {
              const ms = Date.now()
              return 20 + Math.sin(ms / 150) * 5
            }, false)
          : new ConstantProperty(isHovered ? 19 : 16)

        entity.point.color = isSelected
          ? new CallbackProperty(() => {
              const ms = Date.now()
              const alpha = 0.6 + Math.sin(ms / 150) * 0.4
              return Color.fromCssColorString('#a855f7').withAlpha(alpha)
            }, false)
          : new ConstantProperty(
              isHovered
                ? Color.fromCssColorString('#7dd3fc').withAlpha(1)
                : Color.fromCssColorString('#38bdf8').withAlpha(0.98),
            )

        entity.point.outlineWidth = new ConstantProperty(isSelected ? 4 : 3)
      }

      if (entity.label) {
        entity.label.backgroundColor = new ConstantProperty(
          isSelected
            ? Color.fromCssColorString('#581c87').withAlpha(0.86)
            : isHovered
              ? Color.fromCssColorString('#0f766e').withAlpha(0.84)
              : Color.fromCssColorString('#0f172a').withAlpha(0.88),
        )
        entity.label.backgroundPadding = new ConstantProperty(
          isSelected
            ? new Cartesian2(18, 12)
            : isHovered
              ? new Cartesian2(17, 11)
              : new Cartesian2(16, 10),
        )
        entity.label.scale = new ConstantProperty(
          isSelected ? 1.08 : isHovered ? 1.04 : 1,
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
    if (!viewer || !selectedMessage || viewer.isDestroyed()) return

    const position = Cartesian3.fromDegrees(
      selectedMessage.longitude,
      selectedMessage.latitude,
      24,
    )

    const updateCardPosition = () => {
      const card = selectedCardRef.current
      if (!card || !viewer.scene) return

      const windowPosition = SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        position,
      )

      if (windowPosition) {
        const isVisible = isPointVisibleFromCamera(viewer.scene, position)

        if (isVisible) {
          card.style.transform = `translate(${windowPosition.x}px, ${windowPosition.y}px) translate(-50%, 20px)`
          card.style.opacity = '1'
          card.style.pointerEvents = 'auto'
          card.style.visibility = 'visible'
        } else {
          card.style.opacity = '0'
          card.style.pointerEvents = 'none'
          card.style.visibility = 'hidden'
        }
      } else {
        card.style.opacity = '0'
        card.style.pointerEvents = 'none'
        card.style.visibility = 'hidden'
      }
    }

    viewer.scene.preRender.addEventListener(updateCardPosition)
    updateCardPosition()

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(updateCardPosition)
      }
    }
  }, [selectedMessage])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || !selectedPosition || !isPinning || viewer.isDestroyed()) {
      if (selectedPinRef.current) {
        selectedPinRef.current.style.opacity = '0'
      }
      return
    }

    const position = Cartesian3.fromDegrees(
      selectedPosition.lng,
      selectedPosition.lat,
      24,
    )

    const updateSelectedPinPosition = () => {
      const pin = selectedPinRef.current
      if (!pin || !viewer.scene) return

      const windowPosition = SceneTransforms.worldToWindowCoordinates(
        viewer.scene,
        position,
      )

      if (windowPosition && isPointVisibleFromCamera(viewer.scene, position)) {
        pin.style.transform = `translate(${windowPosition.x}px, ${windowPosition.y}px) translate(-50%, -100%)`
        pin.style.opacity = '1'
        pin.style.visibility = 'visible'
      } else {
        pin.style.opacity = '0'
        pin.style.visibility = 'hidden'
      }
    }

    viewer.scene.preRender.addEventListener(updateSelectedPinPosition)
    updateSelectedPinPosition()

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.preRender.removeEventListener(updateSelectedPinPosition)
      }
    }
  }, [isPinning, selectedPosition])

  async function handleSubmit() {
    if (!canSubmit || !selectedPosition) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      addMapMessagesMutation.mutateAsync(
        {
          data: {
            title: 'Map Message',
            mapMessage: draftMessage.trim(),
            latitude: selectedPosition.lat,
            longitude: selectedPosition.lng,
            ...(draftVideoUrl.trim() ? { videoUrl: draftVideoUrl.trim() } : {}),
          },
        },
        {
          onSuccess: async (response) => {
            if (!response.ok) {
              const payload = (await response.json().catch(() => null)) as {
                error?: string
              } | null
              throw new Error(
                payload?.error ?? 'Unable to publish map message.',
              )
            }

            setDraftMessage('')
            setDraftVideoUrl('')
            setIsPinning(false)
            setSelectedPosition(null)
            setCursorPosition(null)
          },
        },
      )

      setDraftMessage('')
      setDraftVideoUrl('')
      setIsPinning(false)
      setSelectedPosition(null)
      setCursorPosition(null)
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
    setDraftVideoUrl('')
    setSelectedPosition(null)
    setIsPinning(false)
    setCursorPosition(null)
  }

  return (
    <div className="relative min-h-[calc(100dvh-var(--app-header-height))] w-full overflow-hidden bg-zinc-950">
      <div className="h-[calc(100dvh-var(--app-header-height))] w-full">
        <div
          ref={containerRef}
          className={`h-full w-full ${isPinning && !selectedPosition ? '[&_canvas]:cursor-crosshair!' : ''}`}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-1.5 top-1.5 z-50 flex flex-col gap-3 sm:inset-x-auto sm:left-1.5 sm:w-104">
        {!isPinning && (
          <button
            type="button"
            onClick={() => setIsPinning(true)}
            className="sm:hidden pointer-events-auto flex justify-center items-center border border-zinc-700/70 bg-zinc-900/80 text-zinc-100 w-8.5 h-8 cursor-pointer"
          >
            <MapPinPlus className="text-cyan-500 w-8 h-7.5" />
          </button>
        )}
        <div
          className={`${isPinning ? '' : 'hidden sm:block'} pointer-events-auto rounded-2xl border border-zinc-700/70 bg-gray-900/80 p-4 text-zinc-100 shadow-xl backdrop-blur-md"`}
        >
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
              setSelectedMessageId(null)
            }}
            className="mt-3 w-full rounded-lg bg-cyan-500 px-4 py-2.5 text-base font-medium text-zinc-950 transition hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
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
                className="mt-3 h-11 w-full rounded-lg border border-zinc-600/90 bg-zinc-950/85 px-3 text-base text-zinc-100 outline-none ring-cyan-300/70 placeholder:text-zinc-400 focus:ring sm:h-10 sm:text-sm"
                maxLength={140}
              />
              <input
                type="url"
                value={draftVideoUrl}
                onChange={(event) => setDraftVideoUrl(event.target.value)}
                placeholder="Optional video URL (e.g. YouTube)..."
                className="mt-2 h-11 w-full rounded-lg border border-zinc-600/90 bg-zinc-950/85 px-3 text-base text-zinc-100 outline-none ring-cyan-300/70 placeholder:text-zinc-400 focus:ring sm:h-10 sm:text-sm"
              />
              {draftVideoUrl.trim() ? (
                <div className="mt-2 relative aspect-video w-full overflow-hidden rounded-lg bg-black/80 shadow-inner border border-zinc-700/50">
                  <ReactPlayer
                    src={draftVideoUrl.trim()}
                    width="100%"
                    height="100%"
                    controls
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                  <div className="pointer-events-none absolute top-1.5 left-1.5 flex items-center rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 backdrop-blur-md">
                    Preview
                  </div>
                </div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-zinc-400">
                  {draftMessage.trim().length}/140
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 sm:px-2.5 sm:py-1.5 sm:text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="rounded-lg bg-cyan-300 px-3 py-2 text-sm font-semibold text-zinc-950 transition enabled:hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2.5 sm:py-1.5 sm:text-xs"
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
        <div
          ref={selectedCardRef}
          className="absolute left-0 top-0 z-10 flex flex-col overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-900/80 shadow-2xl backdrop-blur-xl w-[min(24rem,calc(100%-2rem))] sm:w-[24rem] origin-top opacity-0 transition-opacity duration-200"
        >
          <button
            type="button"
            onClick={() => setSelectedMessageId(null)}
            className="absolute right-3 top-3 z-30 rounded-full bg-black/60 p-1.5 text-zinc-300 transition-colors hover:bg-black hover:text-white border border-white/10"
            aria-label="Close card"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {selectedMessage.videoUrl ? (
            <div className="relative aspect-video w-full bg-black/80">
              <ReactPlayer
                src={selectedMessage.videoUrl}
                width="100%"
                height="100%"
                playing
                controls
                loop
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
              <div className="absolute top-3 left-3 flex items-center rounded-md border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300 backdrop-blur-md">
                Focus View
              </div>
            </div>
          ) : null}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-zinc-100">
              Location Record
            </h3>
            <p className="mt-2.5 text-sm leading-relaxed text-zinc-300 wrap-break-word">
              {selectedMessage.mapMessage}
            </p>
            <div className="mt-5 flex items-center gap-4 border-t border-zinc-800/60 pt-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Coordinates
                </span>
                <span className="mt-0.5 text-xs font-mono text-zinc-400">
                  {selectedMessage.latitude.toFixed(4)},{' '}
                  {selectedMessage.longitude.toFixed(4)}
                </span>
              </div>
              <div className="ml-auto flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Timestamp
                </span>
                <span className="mt-0.5 text-xs text-zinc-400">
                  {selectedMessage.createdAt
                    ? new Date(selectedMessage.createdAt).toLocaleString()
                    : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(16px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>
      ) : null}

      {isPinning && selectedPosition ? (
        <div
          ref={selectedPinRef}
          className="pointer-events-none absolute left-0 top-0 z-20 text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.75)] transition-opacity duration-150"
          style={{ opacity: 0, visibility: 'hidden' }}
          aria-hidden="true"
        >
          <MapPin className="h-8 w-8 fill-rose-500/40" />
        </div>
      ) : null}

      {isPinning && cursorPosition ? (
        <div
          className="pointer-events-none absolute z-20 rounded-lg border border-zinc-700/70 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-100 shadow-xl backdrop-blur-md"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${cursorPosition.x + 12}px, ${cursorPosition.y + 12}px)`,
          }}
        >
          <p>Lat: {cursorPosition.lat.toFixed(5)}</p>
          <p>Lng: {cursorPosition.lng.toFixed(5)}</p>
        </div>
      ) : null}
    </div>
  )
}
