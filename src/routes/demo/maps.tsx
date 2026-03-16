import { createFileRoute } from '@tanstack/react-router'
import { APIProvider, Map } from '@vis.gl/react-google-maps'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID

export const Route = createFileRoute('/demo/maps')({
  ssr: false,
  component: RouteComponent,
})

function RouteComponent() {
  if (!API_KEY) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p>
          Missing <code>VITE_GOOGLE_MAPS_API_KEY</code>. Add your Google Maps key
          to run a fully functional map.
        </p>
      </div>
    )
  }

  if (!MAP_ID) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 p-6 text-center text-zinc-100">
        <p>
          Missing <code>VITE_GOOGLE_MAPS_MAP_ID</code>. A vector map ID is required
          for the globe/3D camera experience.
        </p>
      </div>
    )
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        style={{ width: '100vw', height: '100vh' }}
        mapId={MAP_ID}
        renderingType="VECTOR"
        mapTypeId="satellite"
        defaultCenter={{ lat: 14.5995, lng: 120.9842 }}
        defaultZoom={2}
        defaultTilt={67.5}
        defaultHeading={20}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl
        fullscreenControl
        streetViewControl
        zoomControl
        rotateControl
      />
    </APIProvider>
  )
}
