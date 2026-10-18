import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Swords, Users, Trophy, ScrollText } from 'lucide-react'

// 🐉 종족 보스 레이드
// - 데미지/크리티컬/공격권/보상은 전부 서버(DB 함수 raid_attack)가 계산합니다. 화면은 결과를 연출만 해요.
// - 다른 사람의 공격은 Supabase Realtime 으로 받아서 실시간으로 보여줍니다.

const SKILLS = [
  { id: 'basic', name: '일반 공격', cost: 1, mult: '×1.0', crit: '10%', emoji: '⚔️', color: '#2563eb' },
  { id: 'strong', name: '강타', cost: 2, mult: '×2.3', crit: '25%', emoji: '💥', color: '#d97706' },
  { id: 'ultimate', name: '필살기', cost: 3, mult: '×4.0', crit: '35%', emoji: '🌟', color: '#dc2626' },
]
const SKILL_NAME = { basic: '일반 공격', strong: '강타', ultimate: '필살기' }

const TEAM_COLORS = {
  rakko: '#f59e0b', chiikawa: '#f472b6', hachiware: '#38bdf8', usagi: '#facc15',
  momonga: '#a78bfa', kurimanju: '#fb923c', shisa: '#34d399',
}
const teamColor = (id) => TEAM_COLORS[id] || '#94a3b8'

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'

const fmt = (n) => Number(n || 0).toLocaleString()

const reasonText = (res) => {
  switch (res?.reason) {
    case 'no_tickets': return `🎟️ 공격권이 부족해요. (남은 ${res.attacks_left}개 / 필요 ${res.cost}개)`
    case 'defeated': return '🎉 이미 보스를 쓰러뜨렸어요!'
    case 'boss_gone': return '💨 보스가 도망쳤어요. 내일 새로운 보스가 나타나요.'
    case 'no_team': return '소속된 종족이 없어 참여할 수 없어요. 디스코드에서 종족 역할을 받고 채팅을 남겨주세요.'
    case 'not_logged_in': return '로그인이 필요해요.'
    default: return '공격에 실패했어요. 잠시 후 다시 시도해 주세요.'
  }
}

// 🔊 효과음 재생 함수 (public/sounds/ 경로의 MP3 재생)
const playSfx = (type) => {
  const sfxMap = {
    hit: '/sounds/hit.wav',
    crit: '/sounds/crit.wav',
    defeat: '/sounds/defeat.wav',
  }
  const url = sfxMap[type]
  if (!url) return

  const audio = new Audio(url)
  audio.volume = 0.5 // 음량 조절 (0.0 ~ 1.0)
  audio.play().catch(() => {}) // 재생 예외 무시
}

export default function RaidGame({ supabase, session, teamConfig = {}, isMobile, onChanged }) {
  const [state, setState] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const stateRef = useRef(null)
  const refreshTimer = useRef(null)
  const sceneRef = useRef({
    hpDisplay: 1, hpTarget: 1, shake: 0, flash: 0, t: 0,
    floaters: [], particles: [], stars: [], defeated: false, defeatT: 0,
    w: 600, h: 300, img: null, imgUrl: '', ready: false,
  })

  stateRef.current = state
  const myId = state?.me?.user_id

  // ---------------- 데이터 불러오기 ----------------
  const loadState = useCallback(async () => {
    const { data, error } = await supabase.rpc('raid_get_state')
    if (error) { setLoadError(error.message); return }
    setLoadError('')
    setState(data)
    const s = sceneRef.current
    const ratio = data.max_hp > 0 ? data.hp / data.max_hp : 0
    s.hpTarget = ratio
    if (!s.ready) { s.hpDisplay = ratio; s.ready = true }
    s.defeated = data.status === 'defeated'
    if (data.boss?.image_url && s.imgUrl !== data.boss.image_url) {
      const img = new Image()
      img.src = data.boss.image_url
      s.img = img
      s.imgUrl = data.boss.image_url
    } else if (!data.boss?.image_url) {
      s.img = null
      s.imgUrl = ''
    }
  }, [supabase])

  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => { loadState() }, 1200)
  }, [loadState])

  useEffect(() => {
    if (!session) return undefined
    loadState()
    const interval = setInterval(loadState, 30000) // 실시간 연결이 끊겨도 30초마다 보정
    return () => { clearInterval(interval); if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, [session, loadState])

  // ---------------- 연출 ----------------
  const spawnHit = useCallback((damage, crit, mine) => {
    // 🔊 효과음 재생
    playSfx(crit ? 'crit' : 'hit')

    const s = sceneRef.current
    const cx = s.w / 2
    const cy = s.h * 0.5
    s.floaters.push({
      x: cx + (Math.random() - 0.5) * s.w * 0.28,
      y: cy - 20 + (Math.random() - 0.5) * 40,
      vy: -38 - Math.random() * 18,
      life: 1,
      text: fmt(damage),
      crit,
      mine,
    })
    const n = crit ? 22 : 10
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 60 + Math.random() * (crit ? 220 : 130)
      s.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 1, r: 2 + Math.random() * (crit ? 4 : 3), color: crit ? '#fde047' : '#ffffff',
      })
    }
    s.shake = Math.max(s.shake, crit ? 1.6 : 1)
    s.flash = Math.max(s.flash, crit ? 1 : 0.55)
  }, [])

  const spawnDefeat = useCallback(() => {
    // 🔊 효과음 재생
    playSfx('defeat')

    const s = sceneRef.current
    s.defeated = true
    s.defeatT = 0
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 80 + Math.random() * 320
      s.particles.push({
        x: s.w / 2, y: s.h * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 1.4,
        r: 3 + Math.random() * 5, color: ['#fde047', '#f97316', '#ef4444', '#ffffff'][i % 4],
      })
    }
    s.shake = 2.4
    s.flash = 1
  }, [])

  // ---------------- 실시간 구독 ----------------
 // ---------------- 실시간 구독 ----------------
  useEffect(() => {
    if (!session) return undefined
    const channel = supabase
      .channel('raid-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raid_attacks' }, (payload) => {
        const row = payload.new
        const cur = stateRef.current
        if (!cur || String(row.day) !== String(cur.day)) return
        if (row.user_id === cur.me?.user_id) return // 내 공격은 이미 화면에 반영됨
        spawnHit(row.damage, row.crit, false)
        setState((prev) => prev && ({
          ...prev,
          recent: [
            { id: row.id, username: row.username, team_id: row.team_id, skill: row.skill, damage: row.damage, crit: row.crit, at: Math.floor(new Date(row.created_at).getTime() / 1000) },
            ...(prev.recent || []),
          ].slice(0, 15),
        }))
        refreshSoon()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'raid_days' }, (payload) => {
        const row = payload.new
        const cur = stateRef.current
        if (!cur || String(row.day) !== String(cur.day)) return
        const s = sceneRef.current
        s.hpTarget = row.max_hp > 0 ? row.hp / row.max_hp : 0
        if (row.status === 'defeated' && cur.status !== 'defeated') { spawnDefeat(); refreshSoon() }
        setState((prev) => prev && ({ ...prev, hp: row.hp, status: row.status }))
      })
      // 🔄 보스 리셋(DELETE) 감지 시 자동으로 화면 상태 재로드 추가
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'raid_days' }, () => {
        loadState()
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'raid_attacks' }, () => {
        loadState()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [session, supabase, spawnHit, spawnDefeat, refreshSoon, loadState])
  // ---------------- 캔버스 루프 ----------------
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return undefined
    const ctx = canvas.getContext('2d')
    const s = sceneRef.current
    if (s.stars.length === 0) {
      for (let i = 0; i < 40; i++) s.stars.push({ x: Math.random(), y: Math.random() * 0.7, p: Math.random() * 6, r: 0.6 + Math.random() * 1.4 })
    }

    const resize = () => {
      const w = Math.max(240, wrap.clientWidth)
      const h = isMobile ? 250 : 310
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      s.w = w
      s.h = h
    }
    resize()
    let ro = null
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(wrap) }

    let raf = 0
    let last = performance.now()

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.arcTo(x + w, y, x + w, y + h, r)
      ctx.arcTo(x + w, y + h, x, y + h, r)
      ctx.arcTo(x, y + h, x, y, r)
      ctx.arcTo(x, y, x + w, y, r)
      ctx.closePath()
    }

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      s.t += dt
      const st = stateRef.current
      const color = st?.boss?.color || '#7c3aed'
      const { w, h } = s

      // 체력 보간
      s.hpDisplay += (s.hpTarget - s.hpDisplay) * (1 - Math.exp(-7 * dt))
      s.shake = Math.max(0, s.shake - dt * 4.5)
      s.flash = Math.max(0, s.flash - dt * 3.2)
      if (s.defeated) s.defeatT += dt

      ctx.clearRect(0, 0, w, h)

      // 배경
      const bg = ctx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, '#0b1020')
      bg.addColorStop(1, '#1b2442')
      ctx.fillStyle = bg
      roundRect(0, 0, w, h, 16)
      ctx.fill()
      ctx.save()
      roundRect(0, 0, w, h, 16)
      ctx.clip()

      // 별
      s.stars.forEach((star) => {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(s.t * 1.6 + star.p)
        ctx.fillStyle = '#e2e8f0'
        ctx.beginPath()
        ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2)
        ctx.fill()
      })
      ctx.globalAlpha = 1

      // 보스 오라
      const cx = w / 2
      const cy = h * 0.52
      const size = Math.min(w, h) * 0.52
      const aura = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 1.1)
      aura.addColorStop(0, `${color}88`)
      aura.addColorStop(1, `${color}00`)
      ctx.fillStyle = aura
      ctx.fillRect(0, 0, w, h)

      // 바닥 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.beginPath()
      ctx.ellipse(cx, h * 0.86, size * 0.55, size * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()

      // 보스
      const gone = s.defeated
      const fall = gone ? Math.min(1, s.defeatT / 1.2) : 0
      const breathe = gone ? 1 : 1 + Math.sin(s.t * 2.2) * 0.035
      const dx = (Math.random() - 0.5) * s.shake * 14
      const dy = (Math.random() - 0.5) * s.shake * 10
      ctx.save()
      ctx.translate(cx + dx, cy + dy + fall * size * 0.35)
      ctx.rotate(fall * 0.5)
      ctx.scale(breathe, breathe)
      ctx.globalAlpha = gone ? Math.max(0, 1 - fall) : 1
      if (s.img && s.img.complete && s.img.naturalWidth > 0) {
        const ratio = s.img.naturalWidth / s.img.naturalHeight
        const ih = size * 1.1
        ctx.drawImage(s.img, -ih * ratio / 2, -ih / 2, ih * ratio, ih)
      } else {
        ctx.font = `${size}px ${EMOJI_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(st?.boss?.emoji || '👹', 0, 0)
      }
      ctx.restore()
      ctx.globalAlpha = 1

      // 피격 플래시
      if (s.flash > 0) {
        ctx.globalCompositeOperation = 'lighter'
        const fl = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.8)
        fl.addColorStop(0, `rgba(255,255,255,${0.55 * s.flash})`)
        fl.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = fl
        ctx.fillRect(0, 0, w, h)
        ctx.globalCompositeOperation = 'source-over'
      }

      // 파티클
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i]
        p.life -= dt * 1.4
        if (p.life <= 0) { s.particles.splice(i, 1); continue }
        p.vy += 380 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        ctx.globalAlpha = Math.min(1, p.life)
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // 데미지 숫자
      for (let i = s.floaters.length - 1; i >= 0; i--) {
        const f = s.floaters[i]
        f.life -= dt * 0.85
        if (f.life <= 0) { s.floaters.splice(i, 1); continue }
        f.y += f.vy * dt
        ctx.globalAlpha = Math.min(1, f.life * 1.6)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const fs = f.crit ? 34 : f.mine ? 24 : 18
        ctx.font = `900 ${fs}px "Pretendard","Noto Sans KR",Arial,sans-serif`
        ctx.lineWidth = 5
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'
        ctx.strokeText(f.text, f.x, f.y)
        ctx.fillStyle = f.crit ? '#fde047' : f.mine ? '#ffffff' : 'rgba(226,232,240,0.9)'
        ctx.fillText(f.text, f.x, f.y)
        if (f.crit) {
          ctx.font = '800 12px Arial,sans-serif'
          ctx.fillStyle = '#fb923c'
          ctx.fillText('CRITICAL!', f.x, f.y - fs * 0.75)
        }
      }
      ctx.globalAlpha = 1

      // HP 바
      const barX = 14
      const barY = 14
      const barW = w - 28
      const barH = 20
      ctx.fillStyle = 'rgba(15,23,42,0.85)'
      roundRect(barX, barY, barW, barH, 10)
      ctx.fill()
      const ratio = Math.max(0, Math.min(1, s.hpDisplay))
      if (ratio > 0.002) {
        const hg = ctx.createLinearGradient(barX, 0, barX + barW, 0)
        hg.addColorStop(0, '#ef4444')
        hg.addColorStop(1, ratio > 0.5 ? '#f97316' : '#dc2626')
        ctx.fillStyle = hg
        roundRect(barX, barY, Math.max(barH, barW * ratio), barH, 10)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.lineWidth = 1
      roundRect(barX, barY, barW, barH, 10)
      ctx.stroke()
      ctx.fillStyle = '#fff'
      ctx.font = '800 12px Arial,sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const hpNow = st ? Math.round(s.hpDisplay * st.max_hp) : 0
      ctx.fillText(st ? `HP ${fmt(hpNow)} / ${fmt(st.max_hp)}` : 'HP', w / 2, barY + barH / 2 + 1)

      // 상태 문구
      if (st?.status === 'defeated' && s.defeatT > 0.6) {
        ctx.globalAlpha = Math.min(1, (s.defeatT - 0.6) * 1.5)
        ctx.font = '900 34px "Pretendard","Noto Sans KR",Arial,sans-serif'
        ctx.lineWidth = 6
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'
        ctx.strokeText('토벌 완료!', w / 2, h * 0.5)
        ctx.fillStyle = '#fde047'
        ctx.fillText('토벌 완료!', w / 2, h * 0.5)
        ctx.globalAlpha = 1
      } else if (st?.status === 'escaped') {
        ctx.font = '900 26px "Pretendard","Noto Sans KR",Arial,sans-serif'
        ctx.fillStyle = 'rgba(226,232,240,0.9)'
        ctx.fillText('보스가 도망쳤어요…', w / 2, h * 0.5)
      }

      ctx.restore()
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect() }
  }, [isMobile, session])

  // ---------------- 공격 ----------------
  const attack = async (skill) => {
    if (busy || !state?.me) return
    setBusy(true)
    setMessage('')
    try {
      const { data, error } = await supabase.rpc('raid_attack', { p_skill: skill.id })
      if (error) { setMessage(`오류: ${error.message}`); return }
      if (!data?.ok) {
        setMessage(reasonText(data))
        if (data?.reason === 'defeated' || data?.reason === 'boss_gone') loadState()
        return
      }
      spawnHit(data.damage, data.crit, true)
      sceneRef.current.hpTarget = data.max_hp > 0 ? data.hp / data.max_hp : 0
      setState((prev) => prev && ({
        ...prev,
        hp: data.hp,
        status: data.defeated ? 'defeated' : prev.status,
        rewards: data.rewards || prev.rewards,
        me: {
          ...prev.me,
          level: data.level, exp: data.exp, exp_to_next: data.exp_to_next,
          attacks_left: data.attacks_left,
          base_damage: 100 + (data.level - 1) * 20,
          my_damage: (prev.me.my_damage || 0) + data.damage,
        },
      }))
      setMessage(
        `${data.crit ? '💥 크리티컬! ' : ''}${SKILL_NAME[skill.id]}으로 ${fmt(data.damage)} 데미지!` +
        (data.leveled_up ? ` 🎉 레벨 업! Lv.${data.level}` : '')
      )
      if (data.defeated) { spawnDefeat(); if (onChanged) onChanged() }
      refreshSoon()
    } finally {
      setBusy(false)
    }
  }

  // ---------------- 화면 ----------------
  const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }
  const me = state?.me
  const active = state?.status === 'active'
  const expPct = me ? Math.min(100, Math.round((me.exp / me.exp_to_next) * 100)) : 0
  const maxTeamDmg = Math.max(1, ...(state?.team_damage || []).map((t) => Number(t.damage)))
  const rewards = state?.rewards
  const iParticipated = me && Number(me.my_damage) > 0
  const myReward = rewards && iParticipated
    ? Number(rewards.base)
      + (rewards.mvp?.user_id === myId ? Number(rewards.mvp_bonus) : 0)
      + (rewards.last_hit?.user_id === myId ? Number(rewards.last_hit_bonus) : 0)
    : 0

  const statusBadge = state && (
    <span style={{
      fontSize: '11px', fontWeight: '800', padding: '3px 9px', borderRadius: '10px',
      background: state.status === 'active' ? '#fee2e2' : state.status === 'defeated' ? '#dcfce7' : '#f1f5f9',
      color: state.status === 'active' ? '#b91c1c' : state.status === 'defeated' ? '#15803d' : '#64748b',
    }}>
      {state.status === 'active' ? '🔥 전투 중' : state.status === 'defeated' ? '🏆 토벌 완료' : '💨 도망침'}
    </span>
  )

  return (
    <section className="card" style={{ marginBottom: '16px', background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', borderColor: '#ddd6fe' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        <div>
          <h2 style={{ margin: '0 0 2px 0', fontSize: '16px', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Swords size={18} color="#7c3aed" /> 🐉 종족 합동 보스 레이드
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#6d28d9' }}>
            {state ? `오늘의 보스 · ${state.boss.emoji} ${state.boss.name}` : '모든 종족이 힘을 합쳐 매일 나타나는 보스를 쓰러뜨려요!'}
          </p>
        </div>
        {statusBadge}
      </div>

      {!session ? (
        <div style={{ ...card, textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
          로그인하면 보스 레이드에 참여할 수 있어요. 오른쪽 위의 디스코드 로그인을 눌러주세요.
        </div>
      ) : (
        <>
          {loadError && (
            <div style={{ ...card, marginBottom: '10px', color: '#b91c1c', fontSize: '12px' }}>
              레이드 정보를 불러오지 못했어요: {loadError}
            </div>
          )}

          <div ref={wrapRef} style={{ width: '100%', borderRadius: '16px', overflow: 'hidden', lineHeight: 0, boxShadow: '0 6px 18px rgba(76,29,149,0.25)' }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
          </div>

          {state?.boss?.description && (
            <p style={{ margin: '8px 2px 0', fontSize: '12px', color: '#6d28d9' }}>📜 {state.boss.description}</p>
          )}

          {/* 내 정보 */}
          {me ? (
            <div style={{ ...card, marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#334155' }}>
                  🥋 Lv.{me.level}
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginLeft: '8px' }}>
                    기본 공격력 {fmt(me.base_damage)} · 오늘 내 피해 {fmt(me.my_damage)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#7c3aed' }}>
                  🎟️ 공격권{' '}
                  {Array.from({ length: me.attacks_max }, (_, i) => (
                    <span key={i} style={{ color: i < me.attacks_left ? '#7c3aed' : '#cbd5e1' }}>●</span>
                  ))}
                  <span style={{ marginLeft: '6px', color: '#64748b', fontWeight: '600' }}>{me.attacks_left}/{me.attacks_max}</span>
                </div>
              </div>
              <div style={{ marginTop: '8px', height: '8px', borderRadius: '6px', background: '#e2e8f0', overflow: 'hidden' }}>
                <div style={{ width: `${expPct}%`, height: '100%', background: 'linear-gradient(90deg,#8b5cf6,#d946ef)', transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '3px', textAlign: 'right' }}>EXP {me.exp} / {me.exp_to_next}</div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '8px', marginTop: '8px' }}>
                {SKILLS.map((sk) => {
                  const disabled = busy || !active || me.attacks_left < sk.cost
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => attack(sk)}
                      style={{
                        padding: '10px 12px', borderRadius: '12px', border: `2px solid ${disabled ? '#e2e8f0' : sk.color}`,
                        background: disabled ? '#f8fafc' : '#fff', color: disabled ? '#94a3b8' : sk.color,
                        cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', display: 'flex',
                        flexDirection: isMobile ? 'row' : 'column', justifyContent: 'space-between', gap: '2px',
                      }}
                    >
                      <span style={{ fontSize: '14px', fontWeight: '900' }}>{sk.emoji} {sk.name}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700' }}>
                        🎟️ {sk.cost}장 · 데미지 {sk.mult} · 크리티컬 {sk.crit}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div style={{ minHeight: '20px', marginTop: '8px', fontSize: '13px', fontWeight: '800', color: '#5b21b6' }}>{message}</div>
            </div>
          ) : state && (
            <div style={{ ...card, marginTop: '10px', fontSize: '13px', color: '#64748b' }}>
              소속된 종족이 없어 공격은 할 수 없지만, 다른 제자들의 전투는 구경할 수 있어요. 디스코드에서 종족 역할을 받고 채팅을 남기면 참여할 수 있어요.
            </div>
          )}

          {/* 토벌 결과 */}
          {state?.status === 'defeated' && rewards && (
            <div style={{ ...card, marginTop: '10px', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <div style={{ fontSize: '14px', fontWeight: '900', color: '#15803d', marginBottom: '6px' }}>🏆 오늘의 보스를 쓰러뜨렸어요!</div>
              <div style={{ fontSize: '12px', color: '#166534', lineHeight: 1.7 }}>
                👑 MVP <b>{rewards.mvp?.username}</b> ({fmt(rewards.mvp?.damage)} 피해) · ⚡ 막타 <b>{rewards.last_hit?.username}</b><br />
                🏰 피해 1위 종족 <b>{teamConfig[rewards.top_team?.team_id]?.name || rewards.top_team?.team_id}</b> (종족 점수 +{rewards.team_top_bonus})<br />
                참가 보상: 참가자 전원 +{rewards.base}pt · MVP +{rewards.mvp_bonus}pt · 막타 +{rewards.last_hit_bonus}pt · 참가자 1명당 소속 종족 +{rewards.team_each}pt
                {myReward > 0 && <><br /><b style={{ color: '#15803d' }}>🎁 내가 받은 보상: +{myReward}pt</b></>}
              </div>
            </div>
          )}

          {/* 순위 / 로그 */}
          {state && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={13} /> 종족별 피해
                </div>
                {(state.team_damage || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>아직 공격이 없어요.</div>
                ) : state.team_damage.map((t) => (
                  <div key={t.team_id} style={{ marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', fontWeight: '700' }}>
                      <span>{teamConfig[t.team_id]?.name || t.team_id}</span><span>{fmt(t.damage)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '4px', background: '#f1f5f9', overflow: 'hidden' }}>
                      <div style={{ width: `${(Number(t.damage) / maxTeamDmg) * 100}%`, height: '100%', background: teamColor(t.team_id), transition: 'width .5s' }} />
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Trophy size={13} /> 오늘의 MVP 후보
                </div>
                {(state.top_players || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>아직 공격이 없어요.</div>
                ) : state.top_players.slice(0, 5).map((p, i) => (
                  <div key={`${p.username}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#334155', fontWeight: '700' }}>
                      {['🥇', '🥈', '🥉', '4.', '5.'][i]} {p.username}
                    </span>
                    <span style={{ color: teamColor(p.team_id), fontWeight: '800' }}>{fmt(p.damage)}</span>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ScrollText size={13} /> 실시간 전투 로그
                </div>
                {(state.recent || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>아직 공격이 없어요.</div>
                ) : (
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {state.recent.map((r) => (
                      <div key={r.id} style={{ fontSize: '11px', color: '#475569', marginBottom: '3px', lineHeight: 1.4 }}>
                        <b style={{ color: teamColor(r.team_id) }}>{r.username}</b> · {SKILL_NAME[r.skill] || r.skill}{' '}
                        <b style={{ color: r.crit ? '#d97706' : '#334155' }}>{fmt(r.damage)}{r.crit ? ' 💥' : ''}</b>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <p style={{ margin: '10px 2px 0', fontSize: '11px', color: '#8b5cf6' }}>
            매일 자정(한국 시간)에 새 보스가 나타나고 공격권이 5장으로 충전돼요. 못 잡은 보스는 도망쳐요. 공격할수록 경험치가 쌓여 레벨이 오르고 기본 공격력이 강해져요.
          </p>
        </>
      )}
    </section>
  )
}
