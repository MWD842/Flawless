// Thin proxy in front of the VirusTotal v3 API. Lives on Supabase Edge so that
// the API key never ships to the browser — the frontend only ever talks to
// this function with an action name + params.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VT_BASE = 'https://www.virustotal.com/api/v3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('VIRUSTOTAL_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const { action, url, hash, analysisId } = body

    if (action === 'scan-url') {
      // VT's URL flow is two steps: POST the URL here to get back an analysis
      // id, then the client polls `get-analysis` with that id until the engines
      // finish. This branch is just the first half.
      const formData = new URLSearchParams()
      formData.append('url', url)

      const submitRes = await fetch(`${VT_BASE}/urls`, {
        method: 'POST',
        headers: {
          'x-apikey': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      })

      const submitData = await submitRes.json()
      if (!submitRes.ok) {
        return new Response(JSON.stringify({ error: submitData }), {
          status: submitRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const analysisIdFromVt = submitData.data?.id
      return new Response(JSON.stringify({ analysisId: analysisIdFromVt }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'get-analysis') {
      // Second half of the URL flow — the client hits this in a loop until the
      // response has `status: 'completed'`, which means every engine has voted.
      const analysisRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey },
      })

      const analysisData = await analysisRes.json()
      if (!analysisRes.ok) {
        return new Response(JSON.stringify({ error: analysisData }), {
          status: analysisRes.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(analysisData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'scan-file') {
      // File scans are a single hop: we send the SHA-256 computed in the
      // browser and ask VT what it already knows about that hash. The actual
      // file bytes never leave the user's machine.
      const fileRes = await fetch(`${VT_BASE}/files/${hash}`, {
        headers: { 'x-apikey': apiKey },
      })

      const fileData = await fileRes.json()

      // A 404 from VT just means they've never seen this hash — that's a
      // normal, expected case, not an error. We translate it into a 200 with
      // a `not_found` flag so the UI can show a nicer "unknown file" state
      // rather than a generic "request failed" toast.
      if (fileRes.status === 404) {
        return new Response(JSON.stringify({
          data: {
            attributes: {
              last_analysis_stats: { malicious: 0, suspicious: 0, undetected: 0, harmless: 0 },
              last_analysis_results: {},
            }
          },
          meta: { not_found: true, message: 'File hash not found in VirusTotal database. The file may not have been previously submitted for analysis.' }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify(fileData), {
        status: fileRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
