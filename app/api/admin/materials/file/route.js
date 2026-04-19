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

      // Busca URL do arquivo (fetch all sem filtro, bypassa bug .eq/.in)
      let fileUrl = null;
      try {
        const { data: allRows } = await supabaseAdmin.from('material_files').select('id, url');
        const found = (allRows || []).find(function(r) { return r && r.id === id; });
        if (found && found.url) fileUrl = found.url;
      } catch {}

      // Remove storage file (se existir)
      if (fileUrl) {
        try {
          const u = new URL(fileUrl);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }

      // DELETE via RPC v2
      let deleted = 0;
      let existed = null;
      let rpcErrMsg = null;
      let rpcInnerErr = null;
      try {
        const r = await supabaseAdmin.rpc('admin_delete_material_file_v2', { p_id: id });
        if (r.error) { rpcErrMsg = r.error.message; }
        else if (r.data && typeof r.data === 'object') {
          deleted = Number(r.data.deleted) || 0;
          existed = Boolean(r.data.existed);
          if (r.data.error) rpcInnerErr = r.data.error;
        }
      } catch (e) { rpcErrMsg = String(e && e.message || e); }

      if (deleted > 0) return NextResponse.json({ ok: true, deleted });

      // Fallback: client .delete().eq()
      if (deleted === 0) {
        try {
          const r = await supabaseAdmin.from('material_files').delete().eq('id', id).select();
          if (!r.error && Array.isArray(r.data) && r.data.length > 0) {
            return NextResponse.json({ ok: true, deleted: r.data.length, method: 'client' });
          }
        } catch {}
      }

      // Idempotente: se linha nao existe, o objetivo (arquivo gone) ja esta cumprido
      if (existed === false) {
        return NextResponse.json({ ok: true, deleted: 0, note: 'ja_nao_existia_no_db' });
      }

      // Linha existe mas nenhum metodo deletou — problema real (RLS?)
      return NextResponse.json({
        error: 'delete_blocked',
        detail: 'Linha existe no DB mas todos os metodos de DELETE retornaram 0 linhas. Provavelmente RLS bloqueando — verifique policies em material_files',
        rpc_error: rpcErrMsg,
        rpc_inner_error: rpcInnerErr,
        has_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      }, { status: 500 });
    }

    if (action === 'update') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
      const link = body?.link != null ? String(body.link).trim().slice(0, 500) : '';
      const note = body?.note != null ? String(body.note).trim().slice(0, 1000) : '';

      // PATCH via REST direto (bypassa bug do client, mesma estrategia do delete)
      const patchResp = await fetch(SUPA_URL + '/rest/v1/material_files?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: {
          apikey: SUPA_KEY,
          Authorization: 'Bearer ' + SUPA_KEY,
          Prefer: 'return=representation',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ link: link || null, note: note || null }),
      });

      if (!patchResp.ok) {
        const txt = await patchResp.text().catch(function() { return ''; });
        return NextResponse.json({ error: 'update_failed', detail: txt.slice(0, 300) }, { status: 500 });
      }

      const rows = await patchResp.json().catch(function() { return []; });
      if (Array.isArray(rows) && rows.length > 0) {
        return NextResponse.json({ ok: true, file: rows[0] });
      }

      // Fallback: client update
      const r = await supabaseAdmin.from('material_files').update({ link: link || null, note: note || null }).eq('id', id).select();
      if (!r.error && Array.isArray(r.data) && r.data.length > 0) {
        return NextResponse.json({ ok: true, file: r.data[0], method: 'client' });
      }

      return NextResponse.json({ error: 'update_failed', detail: 'nenhum metodo atualizou a linha' }, { status: 500 });
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
