import { verifyMultipass } from '../../packages/core/src/multipass';

export interface Env {
  MULTIPASS_SECRET: string;
  STICKERS: KVNamespace;
}

export default {
  async fetch(req: Request, env: Env) {
    const jwt = new URL(req.url).searchParams.get('jwt');
    if (!jwt) return new Response('Missing jwt', { status: 400 });

    let payload;
    try { payload = verifyMultipass(jwt, env.MULTIPASS_SECRET); }
    catch { return new Response('Bad token', { status: 401 }); }

    const key  = `u:${payload.email}`;
    const ids: string[] = (await env.STICKERS.get(key, { type: 'json' })) ?? [];

    return new Response(JSON.stringify({ ids }), {
      headers: { 'content-type': 'application/json' }
    });
  }
};
