import React, { useState, useEffect, useCallback } from 'react'
import { Shield, Trash2, Pencil, Save, X, RefreshCw, Search, Swords } from 'lucide-react'

// 🛡️ 관리자 페이지
const SCHEDULE_CATEGORIES = ['발로란트', '오버워치', '종합게임', '술캠', '공구', '기타']

const RANK_TIERS = [
  ['아이언', 100], ['브론즈', 200], ['실버', 300], ['골드', 400],
  ['플래티넘', 500], ['에메랄드', 550], ['다이아몬드', 600], ['초월자', 650],
  ['마스터', 700], ['그랜드마스터', 800], ['챌린저', 900], ['레디언트', 1000],
]
const KEEP_CURRENT = '__keep__'

const parseBirthday = (b) => {
  const m = String(b || '').match(/(\d{1,2})[-/.](\d{1,2})/)
  return m ? { m: String(Number(m[1])), d: String(Number(m[2])) } : { m: '', d: '' }
}
const formatBirthday = (m, d) => `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const daysInMonth = (m) => new Date(2000, Number(m), 0).getDate()
const tierLabel = (mmr) => {
  if (mmr === null || mmr === undefined) return '미설정'
  const hit = RANK_TIERS.find(([, v]) => v === mmr)
  return hit ? `${hit[0]}` : `${mmr}`
}

const SUB_TABS = [
  { id: 'schedules', label: '📅 일정' },
  { id: 'users', label: '👤 제자' },
  { id: 'teams', label: '🏰 종족' },
  { id: 'raid', label: '🐉 레이드' },
  { id: 'posts', label: '📝 게시글' },
  { id: 'logs', label: '📜 기록' },
]

const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }
const input = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', minWidth: 0, boxSizing: 'border-box', background: '#fff' }
const btn = (bg, color = '#fff', border = 'none') => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
  padding: '8px 12px', borderRadius: '8px', border, background: bg, color,
  fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap',
})
const chip = (bg, color) => ({ fontSize: '10px', fontWeight: '800', padding: '2px 6px', borderRadius: '8px', background: bg, color, whiteSpace: 'nowrap' })

const toInputDateTime = (v) => {
  if (!v) return ''
  const s = String(v).trim()
  if (s.includes('T')) return s.slice(0, 16)
  if (s.includes(' ')) return s.replace(' ', 'T').slice(0, 16)
  return `${s.slice(0, 10)}T00:00`
}

const numOrUndefined = (v) => {
  if (v === '' || v === null || v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

export default function AdminPanel({ supabase, teamConfig, isMobile, onDataChanged }) {
  const [tab, setTab] = useState('schedules')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const flash = (msg) => {
    setNotice(msg)
    setTimeout(() => setNotice(''), 3500)
  }

  const callRpc = async (fn, args, okMsg) => {
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc(fn, args)
      if (error) {
        alert(`처리 실패: ${error.message}`)
        return { ok: false }
      }
      if (okMsg) flash(okMsg)
      if (onDataChanged) onDataChanged()
      return { ok: true, data }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" style={{ padding: isMobile ? '14px' : '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield size={20} color="#dc2626" /> 관리자 페이지
        </h2>
        {notice && <span style={{ ...chip('#dcfce7', '#166534'), fontSize: '12px', padding: '4px 10px' }}>✅ {notice}</span>}
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              flex: '1 0 auto', padding: '8px 12px', borderRadius: '10px', whiteSpace: 'nowrap', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              border: tab === t.id ? '2px solid #dc2626' : '1px solid #e2e8f0',
              background: tab === t.id ? '#fef2f2' : '#fff',
              color: tab === t.id ? '#b91c1c' : '#64748b',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'schedules' && <SchedulesTab supabase={supabase} callRpc={callRpc} busy={busy} isMobile={isMobile} />}
      {tab === 'users' && <UsersTab supabase={supabase} callRpc={callRpc} busy={busy} teamConfig={teamConfig} isMobile={isMobile} />}
      {tab === 'teams' && <TeamsTab supabase={supabase} callRpc={callRpc} busy={busy} teamConfig={teamConfig} />}
      {tab === 'raid' && <RaidTab supabase={supabase} callRpc={callRpc} busy={busy} />}
      {tab === 'posts' && <PostsTab supabase={supabase} callRpc={callRpc} busy={busy} teamConfig={teamConfig} />}
      {tab === 'logs' && <LogsTab supabase={supabase} />}
    </section>
  )
}

// ---------------------------------------------------------------
// 🐉 레이드 보스 관리
// ---------------------------------------------------------------
function RaidTab({ supabase, callRpc, busy }) {
  const [bossState, setBossState] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadBossState = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('raid_get_state')
    setBossState(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadBossState() }, [loadBossState])

  const handleResetBoss = async () => {
    if (!window.confirm('오늘의 보스와 누적 데미지 기록을 초기화하고 새 보스를 생성할까요?')) return
    const res = await callRpc('admin_reset_raid_boss', {}, '오늘의 보스를 성공적으로 초기화했습니다!')
    if (res.ok) loadBossState()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={card}>
        <h3 style={{ margin: '0 0 8px', fontSize: '15px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Swords size={16} color="#7c3aed" /> 오늘 진행 중인 보스 정보
        </h3>
        {loading ? (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p>
        ) : bossState ? (
          <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
            <div>보스 이름: <b>{bossState.boss?.emoji} {bossState.boss?.name}</b></div>
            <div>현재 체력: <b>{bossState.hp?.toLocaleString()} / {bossState.max_hp?.toLocaleString()}</b></div>
            <div>상태: <b style={{ color: bossState.status === 'defeated' ? '#16a34a' : '#dc2626' }}>
              {bossState.status === 'defeated' ? '🏆 토벌 완료' : '🔥 전투 중'}
            </b></div>
          </div>
        ) : (
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>보스 정보를 불러오지 못했습니다.</p>
        )}

        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
          <button
            type="button"
            onClick={handleResetBoss}
            disabled={busy}
            style={btn('#dc2626')}
          >
            <RefreshCw size={13} /> 오늘 보스 강제 초기화 / 새 보스 생성
          </button>
          <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
            ※ 초기화 시 오늘의 보스가 리셋되며, 랜덤으로 새 보스가 등장합니다.
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------
// 📅 일정 관리
// ---------------------------------------------------------------
function SchedulesTab({ supabase, callRpc, busy, isMobile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', event_date: '', category: '기타' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('schedules').select('*').order('event_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const threadCount = {}
  rows.forEach((r) => { if (r.discord_thread_id) threadCount[r.discord_thread_id] = (threadCount[r.discord_thread_id] || 0) + 1 })

  const startEdit = (r) => {
    setEditId(r.id)
    setForm({ title: r.title || '', event_date: toInputDateTime(r.event_date), category: r.category || '기타' })
  }

  const save = async () => {
    if (!form.title.trim() || !form.event_date) { alert('제목과 일시를 입력해주세요.'); return }
    const res = await callRpc('admin_update_schedule', {
      p_id: editId, p_title: form.title.trim(), p_event_date: `${form.event_date}:00`, p_category: form.category,
    }, '일정을 수정했습니다.')
    if (res.ok) { setEditId(null); load() }
  }

  const remove = async (r) => {
    if (!window.confirm(`'${r.title}' 일정을 삭제할까요?`)) return
    const res = await callRpc('admin_delete_schedule', { p_id: r.id }, '일정을 삭제했습니다.')
    if (res.ok) load()
  }

  const dedupe = async () => {
    if (!window.confirm('같은 디스코드 스레드의 중복 일정을 최신 1건만 남기고 정리할까요?')) return
    const res = await callRpc('admin_dedupe_schedules', {})
    if (res.ok) { alert(`중복 일정 ${res.data}건을 정리했습니다.`); load() }
  }

  const dupTotal = Object.values(threadCount).reduce((a, c) => a + (c > 1 ? c - 1 : 0), 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={dedupe} disabled={busy} style={btn('#f59e0b')}>🧹 중복 일정 정리 {dupTotal > 0 ? `(${dupTotal}건 감지)` : ''}</button>
        <button type="button" onClick={load} style={btn('#fff', '#475569', '1px solid #cbd5e1')}><RefreshCw size={13} /> 새로고침</button>
        <span style={{ fontSize: '12px', color: '#64748b' }}>총 {rows.length}건</span>
      </div>

      {loading ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p> : rows.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#94a3b8' }}>등록된 일정이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rows.map((r) => {
            const dup = r.discord_thread_id && threadCount[r.discord_thread_id] > 1
            const legacy = !r.discord_thread_id
            return (
              <div key={r.id} style={{ ...card, borderColor: dup ? '#fbbf24' : '#e2e8f0' }}>
                {editId === r.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input style={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" />
                    <div style={{ display: 'flex', gap: '8px', flexDirection: isMobile ? 'column' : 'row' }}>
                      <input style={{ ...input, flex: 1 }} type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                      <select style={{ ...input, flex: 1 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        {[...new Set([...SCHEDULE_CATEGORIES, form.category])].map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={save} disabled={busy} style={btn('#16a34a')}><Save size={13} /> 저장</button>
                      <button type="button" onClick={() => setEditId(null)} style={btn('#fff', '#475569', '1px solid #cbd5e1')}><X size={13} /> 취소</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', wordBreak: 'break-word' }}>{r.title}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span>{String(r.event_date).replace('T', ' ').slice(0, 16)}</span>
                        <span>· {r.category}</span>
                        <span>· {r.created_by_name}</span>
                        {dup && <span style={chip('#fef3c7', '#b45309')}>중복</span>}
                        {legacy && <span style={chip('#f1f5f9', '#64748b')}>스레드ID 없음</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button type="button" onClick={() => startEdit(r)} style={btn('#fff', '#475569', '1px solid #cbd5e1')}><Pencil size={13} /></button>
                      <button type="button" onClick={() => remove(r)} disabled={busy} style={btn('#fef2f2', '#dc2626', '1px solid #fecdd3')}><Trash2 size={13} /></button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// 👤 제자(유저) 관리
// ---------------------------------------------------------------
function UsersTab({ supabase, callRpc, busy, teamConfig, isMobile }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, username, avatar_url, team_id, points, val_mmr, lol_mmr, tank_mmr, deal_mmr, heal_mmr, birthday')
      .order('username', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const startEdit = (r) => {
    setEditId(r.user_id)
    const bd = parseBirthday(r.birthday)
    setForm({
      bday_m: bd.m, bday_d: bd.d,
      points: r.points ?? 0, team_id: r.team_id || '',
      val_mmr: r.val_mmr ?? '', lol_mmr: r.lol_mmr ?? '',
      tank_mmr: r.tank_mmr ?? '', deal_mmr: r.deal_mmr ?? '', heal_mmr: r.heal_mmr ?? '',
    })
  }

  const save = async (orig) => {
    const args = { p_user_id: orig.user_id }
    const pts = numOrUndefined(form.points); if (pts !== undefined && pts !== (orig.points ?? 0)) args.p_points = pts
    if ((form.team_id || '') !== (orig.team_id || '')) args.p_team_id = form.team_id
    const map = { val_mmr: 'p_val_mmr', lol_mmr: 'p_lol_mmr', tank_mmr: 'p_tank_mmr', deal_mmr: 'p_deal_mmr', heal_mmr: 'p_heal_mmr' }
    Object.entries(map).forEach(([k, p]) => {
      const v = numOrUndefined(form[k])
      if (v !== undefined && v !== orig[k]) args[p] = v
    })
    if (form.bday_m && !form.bday_d) { alert('생일의 일(日)도 선택해주세요.'); return }
    const newB = form.bday_m && form.bday_d ? formatBirthday(form.bday_m, form.bday_d) : ''
    const ob = parseBirthday(orig.birthday)
    const origB = ob.m && ob.d ? formatBirthday(ob.m, ob.d) : ''
    if (newB !== origB) {
      if (newB === '' && !window.confirm(`${orig.username} 님의 생일(${origB})을 삭제할까요?`)) return
      args.p_birthday = newB
    }
    if (Object.keys(args).length === 1) { setEditId(null); return }
    const res = await callRpc('admin_update_user', args, `${orig.username} 정보를 수정했습니다.`)
    if (res.ok) { setEditId(null); load() }
  }

  const filtered = rows.filter((r) => !q.trim() || (r.username || '').toLowerCase().includes(q.trim().toLowerCase()))

  const field = (label, key, type = 'number') => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#64748b', fontWeight: '700', flex: '1 1 90px' }}>
      {label}
      <input style={input} type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </label>
  )

  const tierField = (label, key, orig) => {
    const current = numOrUndefined(form[key])
    const matched = RANK_TIERS.find(([, v]) => v === current)
    const origValue = orig[key]
    const origIsTier = RANK_TIERS.some(([, v]) => v === origValue)
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#64748b', fontWeight: '700', flex: '1 1 140px' }}>
        {label}
        <select
          style={input}
          value={matched ? String(current) : KEEP_CURRENT}
          onChange={(e) => setForm({ ...form, [key]: e.target.value === KEEP_CURRENT ? (origValue ?? '') : e.target.value })}
        >
          {!origIsTier && <option value={KEEP_CURRENT}>현재 값 유지 ({origValue ?? '미설정'})</option>}
          {RANK_TIERS.map(([name, v]) => (
            <option key={name} value={String(v)}>{name} ({v})</option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: '10px' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: '#94a3b8' }} />
        <input style={{ ...input, width: '100%', paddingLeft: '30px' }} placeholder="닉네임 검색" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map((r) => (
            <div key={r.user_id} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {r.avatar_url ? <img src={r.avatar_url} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} /> : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e2e8f0' }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.username}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {teamConfig[r.team_id]?.name || '소속 없음'} · {(r.points ?? 0).toLocaleString()}pt
                      {' · '}발 {tierLabel(r.val_mmr)} · 롤 {tierLabel(r.lol_mmr)}
                      {(() => { const b = parseBirthday(r.birthday); return b.m && b.d ? ` · 🎂 ${formatBirthday(b.m, b.d)}` : '' })()}
                    </div>
                  </div>
                </div>
                {editId !== r.user_id && (
                  <button type="button" onClick={() => startEdit(r)} style={btn('#fff', '#475569', '1px solid #cbd5e1')}><Pencil size={13} /> 수정</button>
                )}
              </div>

              {editId === r.user_id && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {field('포인트', 'points')}
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#64748b', fontWeight: '700', flex: '1 1 120px' }}>
                      종족
                      <select style={input} value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
                        <option value="">소속 없음</option>
                        {Object.entries(teamConfig).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                    🎂 생일 (월/일 — 둘 다 비우면 삭제)
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        style={{ ...input, flex: 1 }}
                        value={form.bday_m}
                        onChange={(e) => {
                          const m = e.target.value
                          setForm({
                            ...form,
                            bday_m: m,
                            bday_d: !m ? '' : (form.bday_d && Number(form.bday_d) > daysInMonth(m) ? '' : form.bday_d),
                          })
                        }}
                      >
                        <option value="">월 선택 (없음)</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={String(m)}>{m}월</option>)}
                      </select>
                      <select
                        style={{ ...input, flex: 1 }}
                        value={form.bday_d}
                        disabled={!form.bday_m}
                        onChange={(e) => setForm({ ...form, bday_d: e.target.value })}
                      >
                        <option value="">일 선택</option>
                        {Array.from({ length: form.bday_m ? daysInMonth(form.bday_m) : 31 }, (_, i) => i + 1).map((d) => <option key={d} value={String(d)}>{d}일</option>)}
                      </select>
                    </div>
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {tierField('발로란트 티어', 'val_mmr', r)}
                    {tierField('롤 티어', 'lol_mmr', r)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {field('옵치 탱', 'tank_mmr')}
                    {field('옵치 딜', 'deal_mmr')}
                    {field('옵치 힐', 'heal_mmr')}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button type="button" onClick={() => save(r)} disabled={busy} style={btn('#16a34a')}><Save size={13} /> 저장</button>
                    <button type="button" onClick={() => setEditId(null)} style={btn('#fff', '#475569', '1px solid #cbd5e1')}><X size={13} /> 취소</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8' }}>검색 결과가 없습니다.</p>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// 🏰 종족 관리
// ---------------------------------------------------------------
function TeamsTab({ supabase, callRpc, busy, teamConfig }) {
  const [rows, setRows] = useState([])
  const [points, setPoints] = useState({})
  const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const { data } = await supabase.from('team_scores').select('*').order('total_points', { ascending: false })
    setRows(data || [])
    const p = {}
    ;(data || []).forEach((t) => { p[t.team_id] = t.total_points ?? 0 })
    setPoints(p)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const savePoints = async (t) => {
    const v = numOrUndefined(points[t.team_id])
    if (v === undefined || v === t.total_points) return
    if (!window.confirm(`${teamConfig[t.team_id]?.name || t.team_id} 종족 점수를 ${v.toLocaleString()}점으로 바꿀까요?`)) return
    const res = await callRpc('admin_update_team', { p_team_id: t.team_id, p_total_points: v }, '종족 점수를 수정했습니다.')
    if (res.ok) load()
  }

  const resetWeed = async (t) => {
    if (!window.confirm(`${teamConfig[t.team_id]?.name || t.team_id} 종족의 오늘 제초 횟수를 0으로 초기화할까요?`)) return
    const res = await callRpc('admin_update_team', { p_team_id: t.team_id, p_reset_daily_weed: true }, '오늘 제초 횟수를 초기화했습니다.')
    if (res.ok) load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {rows.map((t) => {
        const todayUsed = String(t.daily_weed_date || '').slice(0, 10) === kstToday ? (t.daily_weed_count || 0) : 0
        return (
          <div key={t.team_id} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              {teamConfig[t.team_id]?.image && <img src={teamConfig[t.team_id].image} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />}
              <b style={{ fontSize: '14px', color: '#0f172a' }}>{teamConfig[t.team_id]?.name || t.team_name || t.team_id}</b>
              <span style={{ fontSize: '11px', color: '#64748b' }}>오늘 제초 {todayUsed.toLocaleString()} / 1,000회 · 누적 {(t.weed_count || 0).toLocaleString()}회</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input style={{ ...input, width: '110px' }} type="number" value={points[t.team_id] ?? ''} onChange={(e) => setPoints({ ...points, [t.team_id]: e.target.value })} />
              <button type="button" onClick={() => savePoints(t)} disabled={busy} style={btn('#16a34a')}><Save size={13} /> 점수 저장</button>
              <button type="button" onClick={() => resetWeed(t)} disabled={busy} style={btn('#fff', '#b45309', '1px solid #fde68a')}>🌱 오늘 제초 초기화</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------
// 📝 게시글 / 댓글 관리
// ---------------------------------------------------------------
function PostsTab({ supabase, callRpc, busy, teamConfig }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState(null)
  const [comments, setComments] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('posts')
      .select('id, title, author_name, team_id, category, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setPosts(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const loadComments = async (postId) => {
    const { data } = await supabase.from('comments').select('id, author_name, content, created_at').eq('post_id', postId).order('created_at', { ascending: true })
    setComments(data || [])
  }

  const toggleComments = async (postId) => {
    if (openId === postId) { setOpenId(null); return }
    setOpenId(postId)
    await loadComments(postId)
  }

  const delPost = async (p) => {
    if (!window.confirm(`'${p.title}' 게시글과 댓글을 모두 삭제할까요?`)) return
    const res = await callRpc('admin_delete_post', { p_id: p.id }, '게시글을 삭제했습니다.')
    if (res.ok) { setOpenId(null); load() }
  }

  const delComment = async (c) => {
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    const res = await callRpc('admin_delete_comment', { p_id: c.id }, '댓글을 삭제했습니다.')
    if (res.ok) loadComments(openId)
  }

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#64748b' }}>최근 게시글 50개</p>
      {loading ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {posts.map((p) => (
            <div key={p.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', wordBreak: 'break-word' }}>{p.title}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    {p.author_name} · {teamConfig[p.team_id]?.name || p.team_id} · {p.category} · {String(p.created_at).slice(0, 10)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button type="button" onClick={() => toggleComments(p.id)} style={btn('#fff', '#475569', '1px solid #cbd5e1')}>💬</button>
                  <button type="button" onClick={() => delPost(p)} disabled={busy} style={btn('#fef2f2', '#dc2626', '1px solid #fecdd3')}><Trash2 size={13} /></button>
                </div>
              </div>

              {openId === p.id && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {comments.length === 0 ? <span style={{ fontSize: '12px', color: '#94a3b8' }}>댓글이 없습니다.</span> : comments.map((c) => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12px', background: '#f8fafc', padding: '6px 8px', borderRadius: '8px' }}>
                      <span style={{ wordBreak: 'break-word', minWidth: 0 }}><b>{c.author_name}</b> {c.content}</span>
                      <button type="button" onClick={() => delComment(c)} disabled={busy} style={{ ...btn('transparent', '#dc2626'), padding: '0 4px' }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {posts.length === 0 && <p style={{ fontSize: '13px', color: '#94a3b8' }}>게시글이 없습니다.</p>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------
// 📜 활동 기록 + 관리자 목록
// ---------------------------------------------------------------
function LogsTab({ supabase }) {
  const [logs, setLogs] = useState([])
  const [admins, setAdmins] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [l, a] = await Promise.all([
      supabase.rpc('admin_list_logs', { p_limit: 50 }),
      supabase.rpc('admin_list_admins'),
    ])
    setLogs(l.data || [])
    setAdmins(a.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const fmt = (d) => new Date(d).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div>
      <div style={{ ...card, marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>🛡️ 현재 관리자 ({admins.length}명)</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {admins.map((a, i) => <span key={i} style={chip('#fef2f2', '#b91c1c')}>{a.username || a.discord_id}</span>)}
        </div>
      </div>

      {loading ? <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p> : logs.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#94a3b8' }}>아직 관리 기록이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {logs.map((l) => (
            <div key={l.id} style={{ ...card, padding: '8px 10px' }}>
              <div style={{ fontSize: '12px', color: '#0f172a' }}>
                <b>{l.admin_name}</b> · {l.action} <span style={{ color: '#94a3b8' }}>({fmt(l.created_at)})</span>
              </div>
              {l.detail && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', wordBreak: 'break-all' }}>{JSON.stringify(l.detail)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
