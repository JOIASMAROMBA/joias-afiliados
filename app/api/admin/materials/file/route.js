import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const SUPA_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const SUPA_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

      // Busca o URL do arquivo via REST direto (bypassa bug do client)
      let fileUrl = null;
      try {
        const getResp = await fetch(SUPA_URL + '/rest/v1/material_files?id=eq.' + encodeURIComponent(id) + '&select=url', {
          headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
          cache: 'no-store',
        });
        const getJson = await getResp.json().catch(function() { return []; });
        if (Array.isArray(getJson) && getJson[0] && getJson[0].url) fileUrl = getJson[0].url;
      } catch (e) {}

      // Remove do storage
      if (fileUrl) {
        try {
          const u = new URL(fileUrl);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }

      // DELETE via REST direto (bypassa bug do client)
      const delResp = await fetch(SUPA_URL + '/rest/v1/material_files?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: {
          apikey: SUPA_KEY,
          Authorization: 'Bearer ' + SUPA_KEY,
          Prefer: 'return=representation',
          'Content-Type': 'application/json',
        },
      });

      if (!delResp.ok) {
        const txt = await delResp.text().catch(function() { return ''; });
        return NextResponse.json({ error: 'delete_failed', status: delResp.status, detail: txt.slice(0, 300) }, { status: 500 });
      }

      const delJson = await delResp.json().catch(function() { return []; });
      const deleted = Array.isArray(delJson) ? delJson.length : 0;

      return NextResponse.json({ ok: true, deleted: deleted });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
