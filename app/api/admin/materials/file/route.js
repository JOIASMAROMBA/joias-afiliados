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

      // Busca URL do arquivo pra limpar storage (via REST, bypassa bug do client)
      let fileUrl = null;
      try {
        const getResp = await fetch(SUPA_URL + '/rest/v1/material_files?id=eq.' + encodeURIComponent(id) + '&select=url', {
          headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
          cache: 'no-store',
        });
        const getJson = await getResp.json().catch(function() { return []; });
        if (Array.isArray(getJson) && getJson[0] && getJson[0].url) fileUrl = getJson[0].url;
      } catch (e) {}

      if (fileUrl) {
        try {
          const u = new URL(fileUrl);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }

      // DELETE via RPC (security definer, ignora RLS e bug do PostgREST)
      const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('admin_delete_material_file', { p_id: id });
      if (rpcErr) {
        return NextResponse.json({ error: 'delete_failed', detail: rpcErr.message }, { status: 500 });
      }
      const deleted = Number(rpcData) || 0;
      if (deleted === 0) {
        return NextResponse.json({ error: 'not_found', detail: 'Linha nao encontrada no DB' }, { status: 404 });
      }

      return NextResponse.json({ ok: true, deleted });
    }

    if (action === 'cleanup_orphans') {
      const folderId = String(body?.folder_id || '').trim();
      if (!folderId) return NextResponse.json({ error: 'missing_folder_id' }, { status: 400 });

      // Lista todos os arquivos desta pasta (sem filtro, depois filtra em JS — bug do .eq)
      const getResp = await fetch(SUPA_URL + '/rest/v1/material_files?select=id,url,folder_id', {
        headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
        cache: 'no-store',
      });
      const rows = await getResp.json().catch(function() { return []; });
      const inFolder = Array.isArray(rows) ? rows.filter(function(r) { return r && r.folder_id === folderId; }) : [];

      let removed = 0;
      for (const r of inFolder) {
        // Checa se o storage file ainda existe
        let exists = false;
        try {
          const head = await fetch(r.url, { method: 'HEAD', cache: 'no-store' });
          exists = head.ok;
        } catch {}
        if (!exists) {
          const { data: rpcData } = await supabaseAdmin.rpc('admin_delete_material_file', { p_id: r.id });
          if (Number(rpcData) > 0) removed++;
        }
      }
      return NextResponse.json({ ok: true, removed });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
