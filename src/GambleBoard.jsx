import React, { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw, Trophy } from 'lucide-react'

// 🎲 커뮤니티 도박장
// - 사이트 포인트로 하는 가상 도박입니다 (내전 베팅 칩 / LeaderBoard 경험치와 무관)
// - 주사위 결과, 승패, 포인트 증감은 전부 서버(DB 함수)가 계산합니다. 화면은 결과를 보여주기만 해요.
// - 혼자 하기(PvE): 홀짝 x1.9 / 주사위 맞추기 x5.7
// - 종족 대결(PvP): 방을 만들면 "다른 종족" 제자가 수락 → 서버가 주사위를 굴려 승자가 판돈의 95%를 가져가요.
// - 개인 손익의 50%가 소속 종족 점수에도 반영돼요.

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅']
const TEAM_COLORS = {
  rakko: '#f59e0b', chiikawa: '#f472b6', hachiware: '#38bdf8', usagi: '#facc15',
  momonga: '#a78bfa', kurimanju: '#fb923c', shisa: '#34d399',
}
const teamColor = (id) => TEAM_COLORS[id] || '#94a3b8'
const fmt = (n) => Number(n || 0).toLocaleString()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const QUICK_STAKES = [10, 50, 100, 500, 1000]

const REASONS = (res, limits) => {
  switch (res?.reason) {
    case 'not_logged_in': return '로그인이 필요해요.'
    case 'no_team': return '소속된 종족이 없어 참여할 수 없어요. 디스코드에서 종족 역할을 받고 채팅을 남겨주세요.'
    case 'bad_stake': return `베팅 금액은 ${fmt(res.min)} ~ ${fmt(res.max)}pt 사이여야 해요.`
    case 'insufficient': return `포인트가 부족해요. (보유 ${fmt(res.points)}pt)`
    case 'daily_limit': return `오늘 할 수 있는 판수(${limits?.daily_max ?? 60}판)를 모두 채웠어요. 내일 다시 오세요!`
    case 'loss_limit': return `오늘 손실 한도(-${fmt(limits?.loss_max ?? 3000)}pt)에 도달했어요. 내일 다시 도전하세요!`
    case 'too_fast': return '너무 빨라요! 잠깐 쉬었다 눌러주세요 😅'
    case 'bad_choice': return '선택이 올바르지 않아요.'
    case 'own_room': return '내가 만든 방에는 도전할 수 없어요.'
    case 'same_team': return '같은 종족 제자와는 대결할 수 없어요. 다른 종족의 방에 도전하세요!'
    case 'room_closed': return '이미 마감되었거나 사라진 방이에요.'
    case 'too_many_rooms': return `동시에 열 수 있는 방은 ${res.max}개까지예요.`
    case 'not_owner': return '내가 만든 방만 취소할 수 있어요.'
    default: return '요청에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }
}

const MODE_LABEL = {
  pve_oddeven: '홀짝', pve_dice: '주사위 맞추기', pvp_dice: '주사위 대결', pvp_oddeven: '홀짝 대결',
}

function Dice({ value, rolling, size = 56 }) {
  return (
    <span
      className={rolling ? 'gb-dice gb-rolling' : 'gb-dice'}
      style={{ fontSize: `${size}px`, lineHeight: 1, display: 'inline-block', color: '#1e293b' }}
    >
      {FACES[Math.max(0, Math.min(5, (value || 1) - 1))]}
    </span>
  )
}

export default function GambleBoard({ supabase, session, teamConfig = {}, isMobile, onChanged }) {
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [mode, setMode] = useState('solo') // solo | pvp
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())

  // 혼자 하기
  const [game, setGame] = useState('oddeven')
  const [choice, setChoice] = useState('odd')
  const [stake, setStake] = useState(100)

  // 종족 대결 방 만들기
  const [roomGame, setRoomGame] = useState('dice')
  const [roomSide, setRoomSide] = useState('odd')
  const [roomStake, setRoomStake] = useState(100)

  // 결과 연출
  const [display, setDisplay] = useState(null) // { kind, rolling, rolls, theirRolls, win, net, text, teamDelta }
  const refreshTimer = useRef(null)
  const changedTimer = useRef(null)

  const limits = state?.limits
  const me = state?.me

  const loadState = useCallback(async () => {
    const { data, error } = await supabase.rpc('gamble_get_state')
    if (error) { setLoadError(error.message); return }
    setLoadError('')
    setState(data)
  }, [supabase])

  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { loadState() }, 1500)
  }, [loadState])

  // 부모(사이트)의 포인트/종족 점수 갱신은 10초에 한 번만 (요청 수 절감)
  const notifyChanged = useCallback(() => {
    if (!onChanged || changedTimer.current) return
    changedTimer.current = setTimeout(() => { changedTimer.current = null; onChanged() }, 10000)
  }, [onChanged])

  useEffect(() => {
    if (!session) return undefined
    loadState()
    const onVisible = () => { if (!document.hidden) loadState() }
    document.addEventListener('visibilitychange', onVisible)
    const tick = setInterval(() => setNow(Date.now()), 20000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(tick)
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      if (changedTimer.current) clearTimeout(changedTimer.current)
    }
  }, [session, loadState])

  // 실시간: 새 방 / 방 상태 변화 / 새 결과
  useEffect(() => {
    if (!session) return undefined
    const channel = supabase
      .channel('gamble-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gamble_rooms' }, () => refreshSoon())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gamble_log' }, () => refreshSoon())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session, supabase, refreshSoon])

  const applyMyState = (patch) => setState((prev) => prev && prev.me ? ({ ...prev, me: { ...prev.me, ...patch } }) : prev)

  // ---------------- 혼자 하기 ----------------
  const play = async () => {
    if (busy || !me) return
    const s = Math.floor(Number(stake))
    if (!Number.isFinite(s) || s < 1) { setNotice('베팅 금액을 입력해 주세요.'); return }
    setBusy(true); setNotice('')
    setDisplay({ kind: 'pve', rolling: true, rolls: game === 'oddeven' ? [1, 1] : [1], win: null })
    const spin = setInterval(() => {
      setDisplay((d) => d && d.rolling ? ({ ...d, rolls: d.rolls.map(() => 1 + Math.floor(Math.random() * 6)) }) : d)
    }, 90)
    try {
      const [{ data, error }] = await Promise.all([
        supabase.rpc('gamble_play', { p_game: game, p_choice: String(choice), p_stake: s }),
        sleep(800),
      ])
      clearInterval(spin)
      if (error || !data) { setDisplay(null); setNotice(`오류: ${error?.message || '알 수 없는 오류'}`); return }
      if (!data.ok) { setDisplay(null); setNotice(REASONS(data, limits)); return }
      setDisplay({
        kind: 'pve', rolling: false, rolls: data.rolls, win: data.win, net: data.net, teamDelta: data.team_delta,
        text: game === 'oddeven'
          ? `합계 ${data.rolls.reduce((a, b) => a + b, 0)} → ${data.rolls.reduce((a, b) => a + b, 0) % 2 === 1 ? '홀' : '짝'}`
          : `주사위 눈 ${data.rolls[0]}`,
      })
      applyMyState({ points: data.points, bets_left: data.bets_left })
      notifyChanged()
      refreshSoon()
    } finally {
      clearInterval(spin)
      setBusy(false)
    }
  }

  // ---------------- 종족 대결 ----------------
  const createRoom = async () => {
    if (busy || !me) return
    const s = Math.floor(Number(roomStake))
    if (!Number.isFinite(s) || s < 1) { setNotice('판돈을 입력해 주세요.'); return }
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.rpc('gamble_create_room', { p_game: roomGame, p_side: roomGame === 'oddeven' ? roomSide : null, p_stake: s })
      if (error || !data) { setNotice(`오류: ${error?.message || '알 수 없는 오류'}`); return }
      if (!data.ok) { setNotice(REASONS(data, limits)); return }
      applyMyState({ points: data.points })
      setNotice('✅ 방을 열었어요! 다른 종족 제자가 수락하면 바로 대결이 시작돼요. (10분 뒤 자동 환불)')
      refreshSoon()
    } finally { setBusy(false) }
  }

  const cancelRoom = async (room) => {
    if (busy) return
    setBusy(true); setNotice('')
    try {
      const { data, error } = await supabase.rpc('gamble_cancel_room', { p_room_id: room.id })
      if (error || !data) { setNotice(`오류: ${error?.message || '알 수 없는 오류'}`); return }
      if (!data.ok) { setNotice(REASONS(data, limits)); refreshSoon(); return }
      applyMyState({ points: data.points })
      setNotice('판돈을 돌려받았어요.')
      refreshSoon()
    } finally { setBusy(false) }
  }

  const acceptRoom = async (room) => {
    if (busy || !me) return
    setBusy(true); setNotice('')
    setDisplay({ kind: 'pvp', rolling: true, rolls: [1, 1], theirRolls: [1, 1], win: null, game: room.game })
    const spin = setInterval(() => {
      setDisplay((d) => d && d.rolling ? ({
        ...d, rolls: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
        theirRolls: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)],
      }) : d)
    }, 90)
    try {
      const [{ data, error }] = await Promise.all([supabase.rpc('gamble_accept_room', { p_room_id: room.id }), sleep(900)])
      clearInterval(spin)
      if (error || !data) { setDisplay(null); setNotice(`오류: ${error?.message || '알 수 없는 오류'}`); return }
      if (!data.ok) { setDisplay(null); setNotice(REASONS(data, limits)); refreshSoon(); return }
      const theirSum = (data.their_roll || []).reduce((a, b) => a + b, 0)
      setDisplay({
        kind: 'pvp', rolling: false, game: data.game, rolls: data.my_roll || [], theirRolls: data.their_roll || [],
        win: data.win, net: data.net, creatorName: data.creator_name,
        text: data.game === 'dice'
          ? `${data.creator_name}님: ${theirSum} vs 나: ${(data.my_roll || []).reduce((a, b) => a + b, 0)}`
          : `${data.creator_name}님의 주사위 합계 ${theirSum} → ${theirSum % 2 === 1 ? '홀' : '짝'} (방장 선택: ${data.creator_side === 'odd' ? '홀' : '짝'})`,
      })
      applyMyState({ points: data.points })
      notifyChanged()
      refreshSoon()
    } finally { clearInterval(spin); setBusy(false) }
  }

  // ---------------- 화면 ----------------
  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }
  const inputStyle = { padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', width: '100%' }
  const pill = (active, color = '#7c3aed') => ({
    padding: '8px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap',
    border: active ? `2px solid ${color}` : '1px solid #e2e8f0', background: active ? `${color}14` : '#fff', color: active ? color : '#64748b',
  })
  const bigBtn = (color, disabled) => ({
    width: '100%', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '15px', fontWeight: '900',
    background: disabled ? '#cbd5e1' : color, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
  })

  const stakeField = (value, setValue) => (
    <div>
      <input
        type="number" inputMode="numeric" min={limits?.stake_min ?? 10} max={limits?.stake_max ?? 1000} value={value}
        onChange={(e) => setValue(e.target.value)} style={inputStyle}
      />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
        {QUICK_STAKES.map((q) => (
          <button key={q} type="button" onClick={() => setValue(q)} style={{ ...pill(Number(value) === q, '#0ea5e9'), padding: '5px 10px', fontSize: '12px' }}>{fmt(q)}</button>
        ))}
        {me && (
          <button type="button" onClick={() => setValue(Math.max(limits?.stake_min ?? 10, Math.min(limits?.stake_max ?? 1000, me.points)))} style={{ ...pill(false, '#dc2626'), padding: '5px 10px', fontSize: '12px', color: '#dc2626' }}>
            최대
          </button>
        )}
      </div>
    </div>
  )

  const resultCard = display && (
    <div style={{
      ...card, marginTop: '10px', textAlign: 'center',
      background: display.rolling ? '#f8fafc' : display.win ? '#f0fdf4' : '#fef2f2',
      borderColor: display.rolling ? '#e2e8f0' : display.win ? '#bbf7d0' : '#fecaca',
    }}>
      {display.kind === 'pvp' && (
        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
          {display.rolling ? '대결 중…' : `⚔️ ${display.creatorName}님과의 대결`}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: isMobile ? '10px' : '20px', flexWrap: 'wrap' }}>
        {display.kind === 'pvp' && (
          <div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>상대</div>
            {(display.theirRolls || []).map((v, i) => <Dice key={`t${i}`} value={v} rolling={display.rolling} size={isMobile ? 44 : 54} />)}
          </div>
        )}
        <div>
          {display.kind === 'pvp' && <div style={{ fontSize: '11px', color: '#64748b' }}>나</div>}
          {(display.rolls || []).map((v, i) => <Dice key={`m${i}`} value={v} rolling={display.rolling} size={isMobile ? 44 : 54} />)}
        </div>
      </div>
      {!display.rolling && (
        <>
          <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>{display.text}</div>
          <div style={{ fontSize: '20px', fontWeight: '900', marginTop: '4px', color: display.win ? '#15803d' : '#b91c1c' }}>
            {display.win ? `🎉 승리! +${fmt(display.net)}pt` : `💥 패배… ${fmt(display.net)}pt`}
          </div>
          {display.teamDelta !== undefined && display.teamDelta !== 0 && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>내 종족 점수 {display.teamDelta > 0 ? '+' : ''}{fmt(display.teamDelta)}</div>
          )}
        </>
      )}
    </div>
  )

  const minutesLeft = (epoch) => Math.max(0, Math.ceil((epoch * 1000 - now) / 60000))

  return (
    <section className="card" style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', borderColor: '#fed7aa' }}>
      <style>{`
        @keyframes gbRoll { 0% { transform: rotate(0deg) translateY(0); } 25% { transform: rotate(90deg) translateY(-8px); } 50% { transform: rotate(180deg) translateY(0); } 75% { transform: rotate(270deg) translateY(-8px); } 100% { transform: rotate(360deg) translateY(0); } }
        .gb-rolling { animation: gbRoll 0.35s linear infinite; }
        .gb-dice { margin: 0 3px; text-shadow: 0 2px 6px rgba(0,0,0,0.15); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', color: '#9a3412' }}>🎲 도박장</h2>
          <p style={{ margin: 0, fontSize: '11px', color: '#c2410c' }}>
            사이트 포인트로 하는 가상 도박이에요 (내전 칩·경험치와 무관). 손익의 50%가 우리 종족 점수에도 반영돼요!
          </p>
        </div>
        <button type="button" onClick={loadState} style={{ ...pill(false, '#c2410c'), padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <RefreshCw size={13} /> 새로고침
        </button>
      </div>

      {!session ? (
        <div style={{ ...card, marginTop: '10px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          로그인하면 도박장에 입장할 수 있어요. 오른쪽 위의 디스코드 로그인을 눌러주세요.
        </div>
      ) : (
        <>
          {loadError && <div style={{ ...card, marginTop: '10px', fontSize: '12px', color: '#b91c1c' }}>불러오지 못했어요: {loadError}</div>}

          {me ? (
            <div style={{ ...card, marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#9a3412' }}>
                💰 {fmt(me.points)}pt
                <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '700', color: teamColor(me.team_id) }}>
                  {teamConfig[me.team_id]?.name || me.team_id}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
                오늘 손익 <b style={{ color: me.net_today >= 0 ? '#15803d' : '#b91c1c' }}>{me.net_today >= 0 ? '+' : ''}{fmt(me.net_today)}</b>
                {' · '}남은 판수 <b>{me.bets_left}</b>{' · '}손실 한도 <b>{fmt(me.loss_left)}</b>
              </div>
            </div>
          ) : state && (
            <div style={{ ...card, marginTop: '10px', fontSize: '13px', color: '#64748b' }}>
              소속된 종족이 없어 도박은 할 수 없어요. 구경은 자유예요 👀 (디스코드에서 종족 역할을 받고 채팅을 남기면 참여할 수 있어요)
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button type="button" onClick={() => { setMode('solo'); setNotice('') }} style={{ ...pill(mode === 'solo', '#ea580c'), flex: 1 }}>🎰 혼자 하기</button>
            <button type="button" onClick={() => { setMode('pvp'); setNotice('') }} style={{ ...pill(mode === 'pvp', '#dc2626'), flex: 1 }}>⚔️ 종족 대결</button>
          </div>

          {mode === 'solo' && (
            <div style={{ ...card, marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <button type="button" onClick={() => { setGame('oddeven'); setChoice('odd') }} style={pill(game === 'oddeven', '#ea580c')}>🎲 홀짝 <span style={{ fontSize: '11px' }}>(×{limits?.mult_oddeven ?? 1.9})</span></button>
                <button type="button" onClick={() => { setGame('dice'); setChoice('1') }} style={pill(game === 'dice', '#ea580c')}>🎯 주사위 맞추기 <span style={{ fontSize: '11px' }}>(×{limits?.mult_dice ?? 5.7})</span></button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                {game === 'oddeven' ? '주사위 2개의 합이 홀인지 짝인지 맞춰보세요.' : '주사위 1개의 눈을 정확히 맞춰보세요.'}
              </div>

              {game === 'oddeven' ? (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  <button type="button" onClick={() => setChoice('odd')} style={{ ...pill(choice === 'odd', '#2563eb'), flex: 1 }}>홀</button>
                  <button type="button" onClick={() => setChoice('even')} style={{ ...pill(choice === 'even', '#dc2626'), flex: 1 }}>짝</button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} type="button" onClick={() => setChoice(String(n))} style={{ ...pill(choice === String(n), '#2563eb'), padding: '6px 0', fontSize: '22px', lineHeight: 1 }}>{FACES[n - 1]}</button>
                  ))}
                </div>
              )}

              <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>베팅 금액 (pt)</div>
              {stakeField(stake, setStake)}
              <div style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 10px' }}>
                적중하면 {fmt(Math.floor((Number(stake) || 0) * (game === 'oddeven' ? (limits?.mult_oddeven ?? 1.9) : (limits?.mult_dice ?? 5.7))))}pt를 받아요.
              </div>
              <button type="button" onClick={play} disabled={busy || !me} style={bigBtn('#ea580c', busy || !me)}>
                {busy ? '굴리는 중…' : '🎲 주사위 굴리기!'}
              </button>
            </div>
          )}

          {mode === 'pvp' && (
            <>
              <div style={{ ...card, marginTop: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '900', color: '#b91c1c', marginBottom: '8px' }}>⚔️ 도전장 던지기</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <button type="button" onClick={() => setRoomGame('dice')} style={pill(roomGame === 'dice', '#dc2626')}>🎲 주사위 대결 (높은 합 승리)</button>
                  <button type="button" onClick={() => setRoomGame('oddeven')} style={pill(roomGame === 'oddeven', '#dc2626')}>🔮 홀짝 대결</button>
                </div>
                {roomGame === 'oddeven' && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>내 선택</span>
                    <button type="button" onClick={() => setRoomSide('odd')} style={{ ...pill(roomSide === 'odd', '#2563eb'), flex: 1 }}>홀</button>
                    <button type="button" onClick={() => setRoomSide('even')} style={{ ...pill(roomSide === 'even', '#dc2626'), flex: 1 }}>짝</button>
                  </div>
                )}
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '4px' }}>판돈 (pt)</div>
                {stakeField(roomStake, setRoomStake)}
                <div style={{ fontSize: '11px', color: '#64748b', margin: '6px 0 10px' }}>
                  방을 열면 판돈이 먼저 맡겨져요. 다른 종족 제자가 수락하면 즉시 대결하고, 승자가 판돈 합계의 95%를 가져가요(5% 소각). 10분 안에 아무도 안 오면 자동 환불!
                </div>
                <button type="button" onClick={createRoom} disabled={busy || !me} style={bigBtn('#dc2626', busy || !me)}>방 열기</button>
              </div>

              <div style={{ ...card, marginTop: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '900', color: '#334155', marginBottom: '8px' }}>🚪 열려 있는 방 ({state?.rooms?.length || 0})</div>
                {(state?.rooms || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>열려 있는 방이 없어요. 먼저 도전장을 던져보세요!</div>
                ) : state.rooms.map((r) => {
                  const mine = me && r.creator_id === me.user_id
                  const sameTeam = me && r.creator_team === me.team_id
                  const afford = me && me.points >= r.stake
                  const canAccept = me && !mine && !sameTeam && afford && !busy
                  return (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px dashed #e2e8f0' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                          <span style={{ color: teamColor(r.creator_team) }}>{r.creator_name}</span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>{teamConfig[r.creator_team]?.name || r.creator_team}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {r.game === 'dice' ? '🎲 주사위 대결' : `🔮 홀짝 대결 (방장: ${r.creator_side === 'odd' ? '홀' : '짝'} → 도전자: ${r.creator_side === 'odd' ? '짝' : '홀'})`}
                          {' · '}판돈 <b>{fmt(r.stake)}pt</b>{' · '}{minutesLeft(r.expires_at)}분 남음
                        </div>
                      </div>
                      {mine ? (
                        <button type="button" onClick={() => cancelRoom(r)} disabled={busy} style={{ ...pill(false, '#64748b'), padding: '6px 10px', fontSize: '12px' }}>취소(환불)</button>
                      ) : (
                        <button
                          type="button" onClick={() => acceptRoom(r)} disabled={!canAccept}
                          style={{ ...pill(false, '#dc2626'), padding: '6px 12px', fontSize: '12px', background: canAccept ? '#dc2626' : '#f1f5f9', color: canAccept ? '#fff' : '#94a3b8', border: 'none', cursor: canAccept ? 'pointer' : 'not-allowed' }}
                        >
                          {sameTeam ? '같은 종족' : !afford ? '포인트 부족' : '⚔️ 도전 수락'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {notice && <div style={{ marginTop: '10px', fontSize: '13px', fontWeight: '800', color: '#9a3412' }}>{notice}</div>}
          {resultCard}

          {state && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trophy size={13} /> 오늘의 도박왕 / 도박 거지
                </div>
                {(state.top_winners || []).length === 0 && (state.top_losers || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>아직 기록이 없어요.</div>
                ) : (
                  <>
                    {(state.top_winners || []).map((p, i) => (
                      <div key={`w${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '700', color: '#334155' }}>{i === 0 ? '👑' : '🤑'} {p.username}</span>
                        <b style={{ color: '#15803d' }}>+{fmt(p.net)}</b>
                      </div>
                    ))}
                    {(state.top_losers || []).length > 0 && <div style={{ borderTop: '1px dashed #e2e8f0', margin: '6px 0' }} />}
                    {(state.top_losers || []).map((p, i) => (
                      <div key={`l${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                        <span style={{ fontWeight: '700', color: '#334155' }}>{i === 0 ? '🥲' : '😭'} {p.username}</span>
                        <b style={{ color: '#b91c1c' }}>{fmt(p.net)}</b>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px' }}>📜 실시간 도박 기록</div>
                {(state.recent || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>아직 기록이 없어요.</div>
                ) : (
                  <div style={{ maxHeight: '170px', overflowY: 'auto' }}>
                    {state.recent.map((l) => {
                      const pvp = String(l.mode).startsWith('pvp')
                      return (
                        <div key={l.id} style={{ fontSize: '11px', color: '#475569', marginBottom: '4px', lineHeight: 1.45 }}>
                          {pvp ? (
                            <>
                              ⚔️ <b style={{ color: teamColor(l.detail?.creator_team) }}>{l.detail?.creator}</b> vs{' '}
                              <b style={{ color: teamColor(l.detail?.opponent_team) }}>{l.detail?.opponent}</b>
                              {' → '}<b>{l.detail?.winner}</b> 승 <b style={{ color: '#15803d' }}>+{fmt(l.net)}</b> ({MODE_LABEL[l.mode]}, {fmt(l.stake)}pt)
                            </>
                          ) : (
                            <>
                              <b style={{ color: teamColor(l.team_id) }}>{l.username}</b> {MODE_LABEL[l.mode] || l.mode}{' '}
                              <b style={{ color: l.net >= 0 ? '#15803d' : '#b91c1c' }}>{l.net >= 0 ? '+' : ''}{fmt(l.net)}</b>
                              {l.detail?.win ? ' 🎉' : ''}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <p style={{ margin: '10px 2px 0', fontSize: '11px', color: '#c2410c' }}>
            ⚠️ 가상 포인트로만 즐기는 게임이에요. 한 번에 최대 {fmt(limits?.stake_max ?? 1000)}pt, 하루 {limits?.daily_max ?? 60}판, 하루 손실 한도 {fmt(limits?.loss_max ?? 3000)}pt까지예요. 적당히 즐겨요!
          </p>
        </>
      )}
    </section>
  )
}
