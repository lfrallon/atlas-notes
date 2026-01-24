import { createFileRoute } from '@tanstack/react-router'
import { APIProvider, Map } from '@vis.gl/react-google-maps'

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY!

export const Route = createFileRoute('/demo/maps')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: '100vw', height: '100vh' }}
          defaultCenter={{ lat: 0, lng: 0 }}
          defaultZoom={2}
          // mapId={"YOUR_MAP_ID"} // Required for 3D/Webgl
          renderingType={'VECTOR'} // Enables 3D Globe
        />
      </APIProvider>
    </>
  )
}
