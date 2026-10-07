// Domain / IP recon for Flawless Vanguard. Given a domain or IP, we pull the
// VT intel document plus recent DNS resolutions and community comments, and
// return it all as one merged JSON blob — saves the frontend from making 3
// separate round-trips (and keeps the API key on the server).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VT = 'https://www.virustotal.com/api/v3';

function isIp(s: string) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s) || /^[0-9a-fA-F:]+$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { target } = await req.json();
    if (!target || typeof target !== 'string') {
      return new Response(JSON.stringify({ error: 'target is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleaned = target.trim().replace(/^https?:\/\//, '').split('/')[0];
    const kind = isIp(cleaned) ? 'ip_addresses' : 'domains';

    const baseRes = await fetch(`${VT}/${kind}/${encodeURIComponent(cleaned)}`, {
      headers: { 'x-apikey': apiKey },
    });
    const baseJson = await baseRes.json();

    if (baseRes.status === 404) {
      return new Response(JSON.stringify({ kind, target: cleaned, not_found: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!baseRes.ok) {
      return new Response(JSON.stringify({ error: baseJson }), {
        status: baseRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fire the two extra lookups at the same time — they're independent of
    // each other and independent of the main lookup above. Any failure here
    // is non-fatal: we fall back to an empty `data` list so the rest of the
    // report still renders.
    const [resolutions, comments] = await Promise.all([
      fetch(`${VT}/${kind}/${encodeURIComponent(cleaned)}/resolutions?limit=10`, {
        headers: { 'x-apikey': apiKey },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`${VT}/${kind}/${encodeURIComponent(cleaned)}/comments?limit=5`, {
        headers: { 'x-apikey': apiKey },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]);

    return new Response(JSON.stringify({
      kind,
      target: cleaned,
      base: baseJson,
      resolutions,
      comments,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
