// import { createFileRoute } from '@tanstack/react-router'

// libs
// import { auth } from '@/lib/auth'

// export const Route = createFileRoute('/api/auth/$')({
//   server: {
//     handlers: {
//       GET: async ({ request }: { request: Request }) => {
//         return await auth.handler(request)
//       },
//       POST: async ({ request }: { request: Request }) => {
//         return await auth.handler(request)
//       },
//     },
//   },
// })

// import { createFileRoute } from '@tanstack/react-router'
// import { auth } from '@/lib/auth'

// const allowedOrigins = new Set([
//   'http://localhost:3000', // Development environment
//   'http://localhost:3006', // Customer app
// ])

// const corsHeaders = {
//   'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
//   'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//   'Access-Control-Allow-Credentials': 'true',
// }

// function isOriginAllowed(origin: string): boolean {
//   return allowedOrigins.has(origin)
// }

// function buildCorsResponse(
//   origin: string,
//   status: number,
//   body: BodyInit | null = null,
// ) {
//   return new Response(body, {
//     status,
//     headers: {
//       ...corsHeaders,
//       'Access-Control-Allow-Origin': origin,
//     },
//   })
// }

// function withCors(handler: (req: Request) => Promise) {
//   return async (req: Request): Promise => {
//     const origin = req.headers.get('origin') ?? ''

//     if (!isOriginAllowed(origin)) {
//       return new Response('CORS not allowed', { status: 403 })
//     }

//     if (req.method === 'OPTIONS') {
//       return buildCorsResponse(origin, 204)
//     }

//     const res = await handler(req)

//     const response = new Response(res.body, res)

//     for (const [key, value] of Object.entries(corsHeaders)) {
//       response.headers.set(key, value)
//     }

//     response.headers.set('Access-Control-Allow-Origin', origin)

//     return response
//   }
// }

// const baseHandler = withCors(auth.handler)

// export const Route = createFileRoute('/api/auth/$')({
//   server: {
//     handlers: {
//       GET: async ({ request }: { request: Request }) => {
//         return await baseHandler(request)
//       },
//       POST: async ({ request }: { request: Request }) => {
//         return await baseHandler(request)
//       },
//       OPTIONS: async ({ request }: { request: Request }) => {
//         const origin = request.headers.get('origin') ?? ''
//         if (!isOriginAllowed(origin)) {
//           return new Response('CORS not allowed', { status: 403 })
//         }
//         return buildCorsResponse(origin, 204)
//       },
//     },
//   },
// })
