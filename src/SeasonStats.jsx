import React, { useCallback, useEffect, useState } from 'react'
import { Trophy, X } from 'lucide-react'

// 🏆 월간 결산 통계창
// - 매월 1일(한국 시간) 0시에 DB가 지난달 점수를 기록하고 포인트를 초기화합니다.
// - 이 컴포넌트는 기록된 결산을 보여줘요: 최고의 먼작귀(1명) / 최고의 먼작귀족(종족) / 순위 / 이달의 기록
// - 새 결산이 나오면 처음 접속했을 때 자동으로 한 번 열려요.

const SEEN_KEY = 'rakko_season_seen'
const TEAM_COLORS = {
  rakko: '#f59e0b', chiikawa: '#f472b6', hachiware: '#38bdf8', usagi: '#facc15',
  momonga: '#a78bfa', kurimanju: '#fb923c', shisa: '#34d399',
}
const teamColor = (id) => TEAM_COLORS[id] || '#94a3b8'
const MEDALS = ['🥇', '🥈', '🥉']
const fmt = (n) => Number(n || 0).toLocaleString()

const seasonLabel = (season) => {
  const m = String(season || '').match(/^(\d{4})-(\d{2})$/)
  return m ? `${m[1]}년 ${Number(m[2])}월` : season
}

const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) } catch (e) { return null } }
const writeSeen = (v) => { try { localStorage.setItem(SEEN_KEY, v) } catch (e) { /* 저장 불가 환경은 무시 */ } }

function Avatar({ url, size = 40, fallback = '🐰' }) {
  return url ? (
    <img src={url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fde68a', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5, flexShrink: 0 }}>{fallback}</div>
  )
}

export default function SeasonStats({ supabase, teamConfig = {}, isMobile }) {
  const [seasons, setSeasons] = useState(null) // null = 불러오는 중
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const latest = seasons && seasons.length > 0 ? seasons[0] : null
  const isNew = !!latest && readSeen() !== latest.season

  // 결산 목록 (페이지당 1회 호출)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: list, error: err } = await supabase.rpc('season_get_list')
      if (cancelled) return
      if (err) { setSeasons([]); return }
      const arr = Array.isArray(list) ? list : []
      setSeasons(arr)
      if (arr.length > 0) {
        setSelected(arr[0].season)
        // 새 결산이 나온 지 10일 이내이고, 아직 못 봤다면 자동으로 열기
        const fresh = Date.now() / 1000 - arr[0].closed_at < 10 * 24 * 3600
        if (fresh && readSeen() !== arr[0].season) setOpen(true)
      }
    })()
    return () => { cancelled = true }
  }, [supabase])

  const loadSeason = useCallback(async (season) => {
    if (!season) return
    setLoading(true)
    setError('')
    const { data: d, error: err } = await supabase.rpc('season_get', { p_season: season })
    if (err) setError(err.message)
    else setData(d)
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (open && selected) loadSeason(selected) }, [open, selected, loadSeason])

  const close = () => {
    setOpen(false)
    if (latest) writeSeen(latest.season)
  }

  const s = data?.summary || {}
  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '12px' }
  const maxTeam = Math.max(1, ...((data?.teams || []).map((t) => Number(t.points))))
  const bestTeamId = s.best_team?.team_id
  const bestTeamCfg = teamConfig[bestTeamId] || {}

  return (
    <>
      {/* 홈 화면 카드 */}
      <section
        className="card"
        onClick={() => setOpen(true)}
        style={{
          marginBottom: '16px', cursor: 'pointer', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', borderColor: '#fde68a',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={22} color="#d97706" />
          <div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#92400e' }}>
              🏆 월간 결산 {latest ? `· ${seasonLabel(latest.season)}` : ''}
              {isNew && <span style={{ marginLeft: '8px', background: '#dc2626', color: '#fff', borderRadius: '8px', padding: '1px 7px', fontSize: '10px', fontWeight: '800' }}>NEW</span>}
            </div>
            <div style={{ fontSize: '11px', color: '#b45309' }}>
              {latest ? '지난달 최고의 먼작귀와 먼작귀족을 확인해 보세요!' : '매월 1일에 지난달 최고의 먼작귀와 먼작귀족이 발표돼요'}
            </div>
          </div>
        </div>
        <span style={{ fontSize: '12px', fontWeight: '800', color: '#d97706' }}>결산 보기 ›</span>
      </section>

      {/* 통계창 (모달) */}
      {open && (
        <div
          onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 1000, overflowY: 'auto', padding: isMobile ? '12px 8px' : '40px 16px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', margin: '0 auto', background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 30%)', borderRadius: '20px', padding: isMobile ? '14px' : '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Trophy size={20} color="#d97706" /> {selected ? `${seasonLabel(selected)} 결산` : '월간 결산'}
              </h2>
              <button type="button" onClick={close} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }} aria-label="닫기">
                <X size={22} color="#64748b" />
              </button>
            </div>

            {seasons === null ? (
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p>
            ) : seasons.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '28px 12px' }}>
                <div style={{ fontSize: '40px' }}>🏆</div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: '#334155', marginTop: '6px' }}>아직 결산 기록이 없어요</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.6 }}>
                  매월 1일 0시에 지난달 점수가 기록되고 포인트가 초기화돼요.<br />
                  첫 결산 발표를 기다려 주세요!
                </div>
              </div>
            ) : (
              <>
                {seasons.length > 1 && (
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', marginBottom: '12px', background: '#fff' }}
                  >
                    {seasons.map((x) => <option key={x.season} value={x.season}>{seasonLabel(x.season)} 결산</option>)}
                  </select>
                )}

                {error && <p style={{ fontSize: '12px', color: '#b91c1c' }}>불러오지 못했어요: {error}</p>}
                {loading && !data && <p style={{ fontSize: '13px', color: '#94a3b8' }}>불러오는 중...</p>}

                {data && (
                  <>
                    {/* 최고의 먼작귀 / 최고의 먼작귀족 */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
                      <div style={{ ...card, textAlign: 'center', borderColor: '#fde68a', background: 'linear-gradient(180deg,#fffbeb,#fff)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#b45309' }}>👑 최고의 먼작귀</div>
                        {s.best_user ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 6px' }}><Avatar url={s.best_user.avatar_url} size={72} /></div>
                            <div style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a' }}>{s.best_user.username}</div>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: teamColor(s.best_user.team_id), marginTop: '2px' }}>
                              {teamConfig[s.best_user.team_id]?.name || s.best_user.team_id || '소속 없음'}
                            </div>
                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#d97706', marginTop: '6px' }}>{fmt(s.best_user.points)} pt</div>
                          </>
                        ) : <div style={{ fontSize: '12px', color: '#94a3b8', padding: '20px 0' }}>기록 없음</div>}
                      </div>

                      <div style={{ ...card, textAlign: 'center', borderColor: '#bfdbfe', background: 'linear-gradient(180deg,#eff6ff,#fff)' }}>
                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#1d4ed8' }}>🏰 최고의 먼작귀족</div>
                        {s.best_team ? (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0 6px' }}>
                              <Avatar url={bestTeamCfg.image} size={72} fallback="🏰" />
                            </div>
                            <div style={{ fontSize: '17px', fontWeight: '900', color: '#0f172a' }}>{bestTeamCfg.name || s.best_team.team_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>멤버 {s.best_team.members}명</div>
                            <div style={{ fontSize: '15px', fontWeight: '900', color: '#2563eb', marginTop: '6px' }}>{fmt(s.best_team.points)} pt</div>
                          </>
                        ) : <div style={{ fontSize: '12px', color: '#94a3b8', padding: '20px 0' }}>기록 없음</div>}
                      </div>
                    </div>

                    {/* 종족 순위 */}
                    <div style={{ ...card, marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#334155', marginBottom: '8px' }}>🏰 먼작귀족 순위</div>
                      {(data.teams || []).map((t) => (
                        <div key={t.team_id} style={{ marginBottom: '7px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#334155' }}>
                            <span>{MEDALS[t.rank - 1] || `${t.rank}.`} {teamConfig[t.team_id]?.name || t.team_name}</span>
                            <span>{fmt(t.points)} pt</span>
                          </div>
                          <div style={{ height: '7px', borderRadius: '5px', background: '#f1f5f9', overflow: 'hidden', marginTop: '2px' }}>
                            <div style={{ width: `${(Number(t.points) / maxTeam) * 100}%`, height: '100%', background: teamColor(t.team_id) }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 개인 순위 */}
                    <div style={{ ...card, marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#334155', marginBottom: '8px' }}>👑 먼작귀 TOP 10</div>
                      {(data.users || []).map((u) => (
                        <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderTop: u.rank === 1 ? 'none' : '1px dashed #f1f5f9' }}>
                          <span style={{ width: '26px', textAlign: 'center', fontSize: u.rank <= 3 ? '18px' : '12px', fontWeight: '800', color: '#64748b' }}>{MEDALS[u.rank - 1] || u.rank}</span>
                          <Avatar url={u.avatar_url} size={28} />
                          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                            {u.username}
                            <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '700', color: teamColor(u.team_id) }}>{teamConfig[u.team_id]?.name || ''}</span>
                          </span>
                          <b style={{ fontSize: '12px', color: '#d97706' }}>{fmt(u.points)}</b>
                        </div>
                      ))}
                      {data.me && (
                        <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '10px', background: '#fef3c7', fontSize: '12px', fontWeight: '800', color: '#92400e' }}>
                          🙋 내 순위: {data.me.rank}위 / {data.me.of}명 · {fmt(data.me.points)} pt
                        </div>
                      )}
                    </div>

                    {/* 이달의 기록 */}
                    <div style={{ ...card, marginTop: '10px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '900', color: '#334155', marginBottom: '8px' }}>📊 이달의 기록</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                        <div>👥 참여한 먼작귀<br /><b style={{ color: '#0f172a' }}>{fmt(s.participants)}명</b></div>
                        <div>🐉 보스 토벌<br /><b style={{ color: '#0f172a' }}>{fmt(s.raid_defeated)}회</b></div>
                        <div>⚔️ 레이드 MVP<br /><b style={{ color: '#0f172a' }}>{s.raid_mvp ? `${s.raid_mvp.username} (${fmt(s.raid_mvp.damage)} 피해)` : '기록 없음'}</b></div>
                        <div>🎲 도박왕<br /><b style={{ color: '#15803d' }}>{s.gamble_king ? `${s.gamble_king.username} (+${fmt(s.gamble_king.net)})` : '기록 없음'}</b></div>
                        <div style={{ gridColumn: '1 / -1' }}>🥲 도박 거지<br /><b style={{ color: '#b91c1c' }}>{s.gamble_loser ? `${s.gamble_loser.username} (${fmt(s.gamble_loser.net)})` : '기록 없음'}</b></div>
                      </div>
                    </div>

                    <p style={{ margin: '10px 2px 0', fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>
                      포인트와 종족 점수는 매월 1일 0시에 초기화되고, 결산은 여기에 영구 보관돼요 🏆
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
