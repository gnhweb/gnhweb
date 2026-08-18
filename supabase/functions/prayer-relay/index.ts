import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  if (!req.body) return {};
  try {
    const cloned = req.clone();
    return await cloned.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const action = body.action || 'list';

      if (action === 'list') {
        const statusFilter = String(body.status || 'active');
        const limitVal = Math.min(parseInt(String(body.limit || '20')), 50);
        const { data, error } = await supabase
          .from('prayer_relays')
          .select('*')
          .eq('status', statusFilter)
          .order('created_at', { ascending: false })
          .limit(limitVal);
        if (error) throw error;
        return new Response(JSON.stringify({ relays: data || [] }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'detail') {
        const relayId = String(body.relayId || '');
        const { data: relay, error: relayErr } = await supabase
          .from('prayer_relays')
          .select('*')
          .eq('id', relayId)
          .single();
        if (relayErr) {
          return new Response(JSON.stringify({ error: '릴레이를 찾을 수 없습니다.' }), {
            status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: entries } = await supabase
          .from('prayer_relay_entries')
          .select('*')
          .eq('relay_id', relayId)
          .order('entry_order', { ascending: true });
        return new Response(JSON.stringify({ relay, entries: entries || [] }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'create') {
        const { starter_id, title, initial_prayer, is_anonymous, max_entries, starter_nickname } = body;
        if (!starter_id || !title || !initial_prayer) {
          return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: relay, error: relayErr } = await supabase
          .from('prayer_relays')
          .insert({
            starter_id, title, initial_prayer,
            is_anonymous: is_anonymous || false,
            max_entries: max_entries || 10,
            status: 'active',
          })
          .select()
          .single();
        if (relayErr) throw relayErr;
        await supabase
          .from('prayer_relay_entries')
          .insert({
            relay_id: relay.id,
            user_id: starter_id,
            nickname: starter_nickname || '익명',
            prayer_text: initial_prayer,
            entry_order: 1,
          });
        return new Response(JSON.stringify({ success: true, relay }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'join') {
        const { relay_id, user_id, nickname, prayer_text } = body;
        if (!relay_id || !user_id || !prayer_text) {
          return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: relay } = await supabase
          .from('prayer_relays')
          .select('*')
          .eq('id', relay_id)
          .single();
        if (!relay) {
          return new Response(JSON.stringify({ error: '릴레이를 찾을 수 없습니다.' }), {
            status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        if (relay.status !== 'active') {
          return new Response(JSON.stringify({ error: '이미 종료된 릴레이입니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: existing } = await supabase
          .from('prayer_relay_entries')
          .select('id')
          .eq('relay_id', relay_id)
          .eq('user_id', user_id);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ error: '이미 이 릴레이에 참여하셨습니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: lastEntry } = await supabase
          .from('prayer_relay_entries')
          .select('entry_order')
          .eq('relay_id', relay_id)
          .order('entry_order', { ascending: false })
          .limit(1)
          .single();
        const nextOrder = (lastEntry?.entry_order || 0) + 1;
        const { error: entryErr } = await supabase
          .from('prayer_relay_entries')
          .insert({ relay_id, user_id, nickname: nickname || '익명', prayer_text, entry_order: nextOrder });
        if (entryErr) throw entryErr;
        if (nextOrder >= relay.max_entries) {
          await supabase
            .from('prayer_relays')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', relay_id);
        }
        if (relay.starter_id !== user_id) {
          await supabase.from('notifications').insert({
            user_id: relay.starter_id,
            type: 'prayer_relay',
            title: '기도 릴레이에 누군가 동참했어요',
            message: `${nickname || '익명'}님이 '${relay.title}' 기도 릴레이에 함께 기도했어요.`,
            link_url: `/prayer-relay?id=${relay_id}`,
          });
        }
        return new Response(JSON.stringify({ success: true, entryOrder: nextOrder }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      if (action === 'close') {
        const { relay_id, user_id } = body;
        if (!relay_id || !user_id) {
          return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        const { data: relay } = await supabase
          .from('prayer_relays')
          .select('*')
          .eq('id', relay_id)
          .single();
        if (!relay || relay.starter_id !== user_id) {
          return new Response(JSON.stringify({ error: '권한이 없습니다.' }), {
            status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        await supabase
          .from('prayer_relays')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .eq('id', relay_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // ★ NEW: Delete action - delete relay and its entries
      if (action === 'delete') {
        const relayId = String(body.relayId || '');

        if (!relayId) {
          return new Response(JSON.stringify({ error: '릴레이 ID가 필요합니다.' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // First delete all entries (cascade)
        const { error: entriesErr } = await supabase
          .from('prayer_relay_entries')
          .delete()
          .eq('relay_id', relayId);

        if (entriesErr) {
          console.error('[prayer-relay] Failed to delete entries:', entriesErr.message);
          return new Response(JSON.stringify({ error: '릴레이 항목 삭제 중 오류가 발생했습니다: ' + entriesErr.message }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        // Then delete the relay itself
        const { error: relayErr } = await supabase
          .from('prayer_relays')
          .delete()
          .eq('id', relayId);

        if (relayErr) {
          console.error('[prayer-relay] Failed to delete relay:', relayErr.message);
          return new Response(JSON.stringify({ error: '릴레이 삭제 중 오류가 발생했습니다: ' + relayErr.message }), {
            status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: '알 수 없는 action입니다.' }), {
        status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const relayId = url.searchParams.get('relayId');
      const statusFilter = url.searchParams.get('status') || 'active';
      const limitVal = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
      if (relayId) {
        const { data: relay } = await supabase.from('prayer_relays').select('*').eq('id', relayId).single();
        const { data: entries } = await supabase.from('prayer_relay_entries').select('*').eq('relay_id', relayId).order('entry_order', { ascending: true });
        return new Response(JSON.stringify({ relay: relay || null, entries: entries || [] }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const { data } = await supabase.from('prayer_relays').select('*').eq('status', statusFilter).order('created_at', { ascending: false }).limit(limitVal);
      return new Response(JSON.stringify({ relays: data || [] }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류';
    console.error('prayer-relay error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
