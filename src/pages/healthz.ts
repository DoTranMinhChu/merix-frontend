import type { APIRoute } from 'astro';

/** Liveness cua chinh frontend. Khong cham backend — giong tach biet /health va /health/ready. */
export const GET: APIRoute = () =>
    new Response(JSON.stringify({ status: 'ok', service: 'frontend' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
