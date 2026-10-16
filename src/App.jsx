import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { 
  Trophy, LogIn, LogOut, Sparkles, MessageSquare, Flame, Send, 
  Heart, User, Clock, Trash2, X, Users, Upload, MessageCircle, 
  Gift, LayoutDashboard, Target, Swords, Gamepad2, FileText, 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, RotateCcw,
  Shield, ExternalLink, Download, CalendarPlus
} from 'lucide-react'
import AdminPanel from './AdminPanel'

// 상단 헤더 및 랏코 대표 이미지 (public/ 폴더 로컬 PNG)
const RAKKO_MASTER_IMAGE = '/rakko.png'

// 종족(팀) ID별 대표 캐릭터 및 이름 매핑 (public/ 폴더 로컬 PNG)
const TEAM_CONFIG = {
  rakko: { name: '랏코', image: '/rakko.png' },
  chiikawa: { name: '치이카와', image: '/chiikawa.png' },
  hachiware: { name: '하치와레', image: '/hachiware.png' },
  usagi: { name: '우사기', image: '/usagi.png' },
  momonga: { name: '모몽가', image: '/momonga.png' },
  kurimanju: { name: '크리만쥬', image: '/kurimanju.png' },
  shisa: { name: '시사', image: '/shisa.png' },
}

// 🔮 랏코 스승의 운세 목록 데이터
const FORTUNES = [
  { grade: '대길 🌟', quote: '오늘 너의 검 끝은 매섭군! 무슨 일이든 당당하게 임하라.', points: 5 },
  { grade: '중길 ⚔️', quote: '기본 자세가 제일 중요하다. 방심하지 마라!', points: 3 },
  { grade: '소길 🍨', quote: '달콤한 파르페를 먹으면 오늘은 기분 좋은 일이 생길 것이다.', points: 2 },
  { grade: '평길 🍵', quote: '쉬는 것도 수련의 일부다. 따뜻한 차 한 잔의 여유를 가져라.', points: 1 },
  { grade: '말길 🍃', quote: '과자는 적당히 먹고, 제초 수련부터 차근차근 시작해라.', points: 1 },
]

// 🏅 포인트 구간별 자동 칭호 산정 함수
const getTitleByPoints = (points = 0) => {
  if (points >= 20000) return { name: '👑 랏코의 오른팔', color: '#8b5cf6', bg: '#f3e8ff' }
  if (points >= 10000) return { name: '⚔️ 랏코의 수제자', color: '#d97706', bg: '#fef3c7' }
  if (points >= 5000) return { name: '🍨 파르페 중독자', color: '#ec4899', bg: '#fce7f3' }
  if (points >= 2000) return { name: '🌱 1급 제초사', color: '#16a34a', bg: '#dcfce7' }
  return { name: '🌱 견습 제자', color: '#64748b', bg: '#f1f5f9' }
}

// 🛡️ 오버워치 최고 역할군 및 점수 계산 함수 (탱/딜/힐 중 최고점 산출)
const getHighestOwMMR = (profile) => {
  if (!profile) return '언랭크'

  const roles = [
    { name: '탱', score: profile.tank_mmr || 0 },
    { name: '딜', score: profile.deal_mmr || 0 },
    { name: '힐', score: profile.heal_mmr || 0 },
  ]

  roles.sort((a, b) => b.score - a.score)

  const highest = roles[0]
  if (!highest || highest.score <= 1000) {
    return '언랭크'
  }

  return `${highest.name} ${highest.score} pt`
}

// 📅 날짜 문자열에서 'MM-DD' 추출 함수
const getMMDD = (dateStr) => {
  if (!dateStr) return ''
  const clean = String(dateStr).split('T')[0].split(' ')[0].trim()
  const parts = clean.split('-')
  if (parts.length >= 2) {
    const m = parts[parts.length - 2].padStart(2, '0')
    const d = parts[parts.length - 1].padStart(2, '0')
    return `${m}-${d}`
  }
  return ''
}

// ⏰ 시간 문자열 (HH:MM) 추출 함수
const getTimeStr = (dateStr) => {
  if (!dateStr) return ''
  const str = String(dateStr).trim()
  let timePart = ''
  if (str.includes('T')) {
    timePart = str.split('T')[1]
  } else if (str.includes(' ') && str.split(' ').length > 1 && str.split(' ')[1].includes(':')) {
    timePart = str.split(' ')[1]
  }
  if (!timePart) return ''
  const parts = timePart.split(':')
  if (parts.length >= 2) {
    const hh = parts[0].padStart(2, '0')
    const mm = parts[1].padStart(2, '0')
    if (hh === '00' && mm === '00') return ''
    return `${hh}:${mm}`
  }
  return ''
}

// 📅 일정 날짜 비교 판별 함수
const isScheduleForDate = (schedule, targetDateStr) => {
  if (!schedule || !schedule.event_date) return false
  
  const isBirthday = schedule.category && schedule.category.includes('생일')
  if (isBirthday) {
    return getMMDD(schedule.event_date) === getMMDD(targetDateStr)
  }
  
  const cleanEventDate = String(schedule.event_date).split('T')[0].split(' ')[0].trim()
  const cleanTargetDate = String(targetDateStr).split('T')[0].split(' ')[0].trim()
  return cleanEventDate === cleanTargetDate
}


// 🔗 디스코드 서버(길드) ID — 값을 넣으면 일정 카드에 "디스코드에서 보기" 버튼이 나타납니다.
// (디스코드 개발자 모드 → 서버 아이콘 우클릭 → 서버 ID 복사)
const DISCORD_GUILD_ID = '1529434801134637106'

// 🕘 한국 시간(KST) 기준 오늘 날짜 (YYYY-MM-DD)
const getKstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)

// 📱 모바일 화면 감지 (기본: 너비 640px 이하)
const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= breakpoint
  )
  // 🛡️ 관리자 여부 확인 (서버 함수 is_admin 이 판정)
  useEffect(() => {
    let cancelled = false
    const checkAdmin = async () => {
      if (!session) {
        setIsAdmin(false)
        return
      }
      const { data, error } = await supabase.rpc('is_admin')
      if (!cancelled) setIsAdmin(!error && data === true)
    }
    checkAdmin()
    return () => { cancelled = true }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isAdmin && activeTab === 'admin') setActiveTab('home')
  }, [isAdmin, activeTab])

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const onChange = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [breakpoint])
  return isMobile
}

// 🏷️ 일정 분류별 색상
const CATEGORY_STYLE = {
  '발로란트': { bg: '#ffe4e6', color: '#be123c' },
  '오버워치': { bg: '#ffedd5', color: '#c2410c' },
  '종합게임': { bg: '#dbeafe', color: '#1d4ed8' },
  '술캠': { bg: '#ede9fe', color: '#6d28d9' },
  '공구': { bg: '#dcfce7', color: '#15803d' },
}
const getCategoryStyle = (category) => CATEGORY_STYLE[category] || { bg: '#f1f5f9', color: '#475569' }

// 📆 일정 날짜 → { y, mo, d, hh, mm } (시간이 없으면 hh/mm 는 null)
const parseScheduleStart = (dateStr) => {
  const m = String(dateStr || '').trim().match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3], hh: m[4] != null ? +m[4] : null, mm: m[5] != null ? +m[5] : null }
}

// ⏳ D-day 라벨 (오늘 / D-n / 종료)
const getDDay = (dateStr) => {
  const st = parseScheduleStart(dateStr)
  if (!st) return null
  const [ty, tm, td] = getKstToday().split('-').map(Number)
  const diff = Math.round((Date.UTC(st.y, st.mo - 1, st.d) - Date.UTC(ty, tm - 1, td)) / 86400000)
  if (diff === 0) return { label: '오늘', bg: '#fee2e2', color: '#b91c1c' }
  if (diff > 0) return { label: `D-${diff}`, bg: '#dbeafe', color: '#1d4ed8' }
  return { label: '종료', bg: '#f1f5f9', color: '#94a3b8' }
}

const pad2 = (n) => String(n).padStart(2, '0')
// 시간 정보가 있으면 2시간짜리 일정으로, 없으면 종일 일정으로 만든다 (모두 한국 시간)
const getCalendarRange = (dateStr) => {
  const st = parseScheduleStart(dateStr)
  if (!st) return null
  const hasTime = st.hh != null && !(st.hh === 0 && st.mm === 0)
  if (!hasTime) {
    const next = new Date(Date.UTC(st.y, st.mo - 1, st.d + 1))
    return {
      allDay: true,
      start: `${st.y}${pad2(st.mo)}${pad2(st.d)}`,
      end: `${next.getUTCFullYear()}${pad2(next.getUTCMonth() + 1)}${pad2(next.getUTCDate())}`,
    }
  }
  const startMs = Date.UTC(st.y, st.mo - 1, st.d, st.hh, st.mm)
  const fmt = (ms) => {
    const t = new Date(ms)
    return `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}T${pad2(t.getUTCHours())}${pad2(t.getUTCMinutes())}00`
  }
  return { allDay: false, start: fmt(startMs), end: fmt(startMs + 2 * 3600 * 1000) }
}

// 📅 구글 캘린더에 추가하는 링크
const buildGoogleCalendarUrl = (sch) => {
  const range = getCalendarRange(sch.event_date)
  if (!range) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `[${sch.category || '내전'}] ${sch.title}`,
    dates: `${range.start}/${range.end}`,
    details: `랏코와 제자들 일정${sch.created_by_name ? ` (등록: ${sch.created_by_name})` : ''}`,
  })
  if (!range.allDay) params.set('ctz', 'Asia/Seoul')
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// 💾 .ics 파일 다운로드 (아이폰 캘린더, 삼성 캘린더, 아웃룩 등)
const downloadIcs = (sch) => {
  const range = getCalendarRange(sch.event_date)
  if (!range) return
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//rakko-disciples//schedule//KO',
    'BEGIN:VEVENT',
    `UID:schedule-${sch.id}@rakko-disciples`,
    `DTSTAMP:${stamp}`,
    range.allDay ? `DTSTART;VALUE=DATE:${range.start}` : `DTSTART;TZID=Asia/Seoul:${range.start}`,
    range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND;TZID=Asia/Seoul:${range.end}`,
    `SUMMARY:${esc(`[${sch.category || '내전'}] ${sch.title}`)}`,
    `DESCRIPTION:${esc('랏코와 제자들 일정')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${String(sch.title || 'schedule').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function App() {
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const isMobile = useIsMobile()
  const [isAdmin, setIsAdmin] = useState(false)

  const [teams, setTeams] = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [userPoints, setUserPoints] = useState(0)

  // 🔮 오늘의 운세 관련 상태
  const [todayFortune, setTodayFortune] = useState(null)
  const [hasDrawnFortune, setHasDrawnFortune] = useState(false)

  // 🗡️ 토벌 수련 관련 상태
  const [subjugationStatus, setSubjugationStatus] = useState('idle')
  const [subjugationResult, setSubjugationResult] = useState(null)
  const [monsterStartTime, setMonsterStartTime] = useState(null)
  const [subjugationTimer, setSubjugationTimer] = useState(null)

  // 🌿 제초 관련 상태 (종족(팀)당 하루 1,000회 제한 — DB 함수 try_team_weed 가 서버에서 검사)
  const [myTeamInfo, setMyTeamInfo] = useState(null)
  const [teamDailyWeedUsed, setTeamDailyWeedUsed] = useState(0)
  const [weedingCooldown, setWeedingCooldown] = useState(false)

  // 🎴 제자 프로필 모달 상태
  const [selectedProfileModal, setSelectedProfileModal] = useState({
    isOpen: false,
    loading: false,
    profile: null,
    userPosts: []
  })

  // 💬 게시판 관련 상태
  const [posts, setPosts] = useState([])
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all')
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('자유')
  const [postTeam, setPostTeam] = useState('rakko')

  // 이미지 업로드 상태
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 댓글 관련 상태
  const [expandedPostIds, setExpandedPostIds] = useState([])
  const [commentsMap, setCommentsMap] = useState({})
  const [commentInputs, setCommentInputs] = useState({})

  // 좋아요 목록 (localStorage 연동)
  const [likedPostIds, setLikedPostIds] = useState(() => {
    try {
      const saved = localStorage.getItem('rakko_liked_posts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // 📅 일정/달력 관련 상태
  const [schedules, setSchedules] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDateStr, setSelectedDateStr] = useState(getKstToday())

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)

    const savedFortuneDate = localStorage.getItem('rakko_fortune_date')
    const savedFortuneData = localStorage.getItem('rakko_fortune_data')
    if (savedFortuneDate === todayStr && savedFortuneData) {
      setHasDrawnFortune(true)
      try { setTodayFortune(JSON.parse(savedFortuneData)) } catch {}
    }

    const syncUserProfile = async (currentSession) => {
      if (!currentSession?.user) return

      const user = currentSession.user
      const discordId = user.user_metadata?.provider_id || user.user_metadata?.sub || ''
      const username = user.user_metadata?.full_name || user.user_metadata?.name || '익명'
      const avatarUrl = user.user_metadata?.avatar_url || ''

      if (!discordId) return

      try {
        const { data: profiles, error } = await supabase
          .from('user_profiles')
          .select('*')
          .or(`user_id.eq.${user.id},discord_id.eq.${discordId}`)

        if (error) {
          console.error('프로필 조회 실패:', error.message)
          return
        }

        const existingProfile = profiles && profiles.length > 0 ? profiles[0] : null

        if (existingProfile) {
          await supabase.from('user_profiles').update({
            username: username,
            avatar_url: avatarUrl
          }).or(`user_id.eq.${user.id},discord_id.eq.${discordId}`)

          setUserPoints(existingProfile.points || 0)

          if (existingProfile.team_id) {
            setPostTeam(existingProfile.team_id)
            fetchMyTeamInfo(existingProfile.team_id)
          }
        } else {
          await supabase.from('user_profiles').insert({
            user_id: user.id,
            discord_id: discordId,
            username: username,
            avatar_url: avatarUrl,
            points: 0,
            chat_count: 0
          })
        }
      } catch (err) {
        console.error('프로필 동기화 중 예외 발생:', err)
      }
    }

    supabase.auth.getSession().then(({ data: { session: initSession } }) => {
      setSession(initSession)
      if (initSession) syncUserProfile(initSession)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) syncUserProfile(newSession)
    })

    fetchTeamScores()
    fetchUserProfiles()
    fetchPosts()
    fetchSchedules()

    return () => subscription.unsubscribe()
  }, [])

  const fetchMyTeamInfo = async (teamId) => {
    if (!teamId) return
    const { data } = await supabase
      .from('team_scores')
      .select('*')
      .eq('team_id', teamId)
      .maybeSingle()

    if (data) {
      setMyTeamInfo(data)
      const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const dbDate = data.daily_weed_date ? String(data.daily_weed_date).split('T')[0] : ''
      setTeamDailyWeedUsed(dbDate === kstToday ? (data.daily_weed_count || 0) : 0)
    }
  }

  // 🌿 제초 1회 처리: 팀당 하루 1,000회 제한 검사 + 개인/팀 포인트 + 팀 제초 횟수를 DB 함수 하나로 원자적 처리
  const executeWeedingRpc = async () => {
    try {
      const { data, error } = await supabase.rpc('try_team_weed')
      if (error) {
        console.error('제초 처리 중 오류 발생:', error)
        alert('제초 처리 중 오류가 발생했습니다: ' + error.message)
        return
      }

      const result = Array.isArray(data) ? data[0] : data

      if (!result?.allowed) {
        if (result?.reason === 'limit_reached') {
          setTeamDailyWeedUsed(1000)
          alert('⚠️ 오늘 우리 종족의 제초 한도(1,000회)를 모두 채웠습니다! 내일 다시 도전해 주세요.')
        } else if (result?.reason === 'no_team') {
          alert('소속된 종족(팀)이 없어 제초 수련을 진행할 수 없습니다.')
        } else if (result?.reason === 'not_logged_in') {
          alert('로그인이 필요한 수련입니다!')
        } else {
          alert('해당 팀의 점수 데이터를 찾을 수 없습니다.')
        }
        return
      }

      setUserPoints(result.user_points)
      setTeamDailyWeedUsed(result.used)
      setMyTeamInfo((prev) => prev ? { ...prev, total_points: result.team_points, weed_count: result.team_weed_count } : prev)
      fetchTeamScores()
      fetchUserProfiles()
    } catch (err) {
      console.error('제초 처리 중 오류 발생:', err)
    }
  }

  // 🌟 공통 포인트 DB 동시 업데이트 함수 (운세/토벌 등 제초 외 포인트용. 제초는 executeWeedingRpc 사용)
  const updateUserAndTeamPoints = async (pointsToAdd, isWeeding = false) => {
    if (!session) return

    if (isWeeding) {
      await executeWeedingRpc()
      return
    }

    try {
      const discordId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub || ''
      const userId = session.user.id

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('team_id, points')
        .or(`user_id.eq.${userId},discord_id.eq.${discordId}`)
        .maybeSingle()

      if (!profile) return

      const targetTeam = profile.team_id
      const currentProfPoints = profile.points || 0
      const newProfPoints = currentProfPoints + pointsToAdd

      // 1. 유저 개인 프로필 DB 업데이트
      await supabase
        .from('user_profiles')
        .update({ points: newProfPoints })
        .or(`user_id.eq.${userId},discord_id.eq.${discordId}`)

      // 2. 팀 점수 및 팀 제초 횟수 DB 업데이트
      if (targetTeam) {
        const { data: teamData } = await supabase
          .from('team_scores')
          .select('total_points')
          .eq('team_id', targetTeam)
          .maybeSingle()

        if (teamData) {
          const newTeamPoints = (teamData.total_points || 0) + pointsToAdd

          await supabase
            .from('team_scores')
            .update({ total_points: newTeamPoints })
            .eq('team_id', targetTeam)

          setMyTeamInfo((prev) => prev ? { ...prev, total_points: newTeamPoints } : null)
        }
      }

      setUserPoints((prev) => prev + pointsToAdd)
      fetchTeamScores()
      fetchUserProfiles()
    } catch (err) {
      console.error('포인트 반영 중 오류 발생:', err)
    }
  }

  const fetchTeamScores = async () => {
    const { data, error } = await supabase
      .from('team_scores')
      .select('*')
      .order('total_points', { ascending: false })
    if (!error && data) setTeams(data)
  }

  const fetchUserProfiles = async () => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('points', { ascending: false })
    if (!error && data) setAllProfiles(data)
  }

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, comments(count)')
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
  }

  const fetchSchedules = async () => {
    try {
      const { data: scheduleData, error: scheduleError } = await supabase
        .from('schedules')
        .select('*')
        .order('event_date', { ascending: true })

      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, discord_id, username, avatar_url, birthday')
        .not('birthday', 'is', null)

      let combinedSchedules = []

      if (!scheduleError && scheduleData) {
        combinedSchedules = [...scheduleData]
      }

      if (!profileError && profileData) {
        const profileBirthdays = profileData
          .filter((p) => p.birthday && String(p.birthday).trim() !== '')
          .map((p) => ({
            id: `profile-bday-${p.discord_id || p.user_id}`,
            title: `${p.username} 생일`,
            category: '생일',
            event_date: p.birthday,
            created_by_name: p.username,
            created_by_avatar: p.avatar_url || RAKKO_MASTER_IMAGE
          }))

        combinedSchedules = [...combinedSchedules, ...profileBirthdays]
      }

      setSchedules(combinedSchedules)
    } catch (err) {
      console.error('일정 불러오기 중 오류 발생:', err)
    }
  }

  const handleOpenProfileModal = async (userId, authorName, authorAvatar) => {
    setSelectedProfileModal({ isOpen: true, loading: true, profile: null, userPosts: [] })

    let profileData = null
    try {
      if (userId) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .or(`user_id.eq.${userId},discord_id.eq.${userId}`)
          .maybeSingle()
        profileData = data
      }

      if (!profileData && authorName) {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('username', authorName)
          .maybeSingle()
        profileData = data
      }
    } catch (err) {
      console.error('프로필 정보 조회 실패:', err)
    }

    let postsData = []
    try {
      let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(5)
      if (userId) {
        query = query.or(`user_id.eq.${userId}`)
      } else if (authorName) {
        query = query.eq('author_name', authorName)
      }
      const { data } = await query
      if (data) postsData = data
    } catch (err) {
      console.error('유저 작성 글 조회 실패:', err)
    }

    setSelectedProfileModal({
      isOpen: true,
      loading: false,
      profile: profileData || {
        username: authorName || '익명 제자',
        avatar_url: authorAvatar || RAKKO_MASTER_IMAGE,
        points: 0,
        team_id: 'rakko'
      },
      userPosts: postsData
    })
  }

  const handleCloseProfileModal = () => {
    setSelectedProfileModal({ isOpen: false, loading: false, profile: null, userPosts: [] })
  }

  const handleDrawFortune = async () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }

    const todayStr = new Date().toISOString().slice(0, 10)
    if (hasDrawnFortune) {
      alert('오늘의 운세는 이미 뽑으셨습니다! 내일 다시 도전해 주세요.')
      return
    }

    const randomFortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
    
    setTodayFortune(randomFortune)
    setHasDrawnFortune(true)
    localStorage.setItem('rakko_fortune_date', todayStr)
    localStorage.setItem('rakko_fortune_data', JSON.stringify(randomFortune))

    await updateUserAndTeamPoints(randomFortune.points, false)
  }

  // 🗡️ 토벌 수련 시작
  const handleStartSubjugation = () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }

    setSubjugationStatus('waiting')
    const randomDelay = Math.floor(Math.random() * 2000) + 1500

    const timer = setTimeout(() => {
      setSubjugationStatus('ready')
      setMonsterStartTime(Date.now())
    }, randomDelay)

    setSubjugationTimer(timer)
  }

  // 🗡️ 토벌 몬스터 클릭
  const handleMonsterClick = async () => {
    if (subjugationStatus === 'waiting') {
      clearTimeout(subjugationTimer)
      alert('⚠️ 몬스터가 나타나기 전에 너무 일찍 공격했습니다! 수련을 다시 시작해 주세요.')
      setSubjugationStatus('idle')
      return
    }

    if (subjugationStatus === 'ready') {
      const reactionTime = Date.now() - monsterStartTime
      let result = { reactionTime, grade: 'C급 🍃', points: 1 }

      if (reactionTime < 250) {
        result = { reactionTime, grade: 'S급 🗡️', points: 10 }
      } else if (reactionTime < 350) {
        result = { reactionTime, grade: 'A급 ⚔️', points: 5 }
      } else if (reactionTime < 500) {
        result = { reactionTime, grade: 'B급 🛡️', points: 3 }
      }

      setSubjugationResult(result)
      setSubjugationStatus('finished')

      await updateUserAndTeamPoints(result.points, false)
    }
  }

  // 🗡️ 토벌 수련 다시 도전하기
  const handleRetrySubjugation = () => {
    setSubjugationStatus('idle')
    setSubjugationResult(null)
  }

  // 🌿 1. 잡초 뽑기 클릭 핸들러 (종족(팀)당 하루 1,000회 제한)
  const handleWeedingClick = async () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }
    if (weedingCooldown) return

    const discordId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub || ''
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('team_id')
      .or(`user_id.eq.${session.user.id},discord_id.eq.${discordId}`)
      .maybeSingle()

    if (!profile || !profile.team_id) {
      alert('소속된 종족(팀)이 없어 제초 수련을 진행할 수 없습니다.')
      return
    }

    const { data: teamData } = await supabase
      .from('team_scores')
      .select('daily_weed_count, daily_weed_date')
      .eq('team_id', profile.team_id)
      .maybeSingle()

    // 오늘(KST) 우리 팀이 이미 1,000회를 채웠으면 바로 안내 (최종 검사는 서버 함수가 다시 수행)
    const kstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const dbWeedDate = teamData?.daily_weed_date ? String(teamData.daily_weed_date).split('T')[0] : ''
    const teamUsedToday = dbWeedDate === kstToday ? (teamData?.daily_weed_count || 0) : 0
    setTeamDailyWeedUsed(teamUsedToday)
    if (teamUsedToday >= 1000) {
      alert('⚠️ 오늘 우리 종족의 제초 한도(1,000회)를 모두 채웠습니다! 내일 다시 도전해 주세요.')
      return
    }

    await executeWeeding()
  }

  // 🌿 2. 제초 포인트 및 팀 전체 횟수 1 증가 (0.2초 쿨타임)
  const executeWeeding = async () => {
    setWeedingCooldown(true)
    setTimeout(() => {
      setWeedingCooldown(false)
    }, 200)

    await updateUserAndTeamPoints(2, true)
  }

  const fetchCommentsForPost = async (postId) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setCommentsMap((prev) => ({ ...prev, [postId]: data }))
    }
  }

  const toggleComments = (postId) => {
    if (expandedPostIds.includes(postId)) {
      setExpandedPostIds(expandedPostIds.filter((id) => id !== postId))
    } else {
      setExpandedPostIds([...expandedPostIds, postId])
      fetchCommentsForPost(postId)
    }
  }

  const handleCreateComment = async (postId, e) => {
    e.preventDefault()
    if (!session) {
      alert('로그인이 필요한 기능입니다!')
      return
    }

    const content = (commentInputs[postId] || '').trim()
    if (!content) {
      alert('댓글 내용을 입력해 주세요.')
      return
    }

    const authorName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '무명 제자'
    const avatarUrl = session.user.user_metadata?.avatar_url || ''

    const { error } = await supabase.from('comments').insert([
      {
        post_id: postId,
        user_id: session.user.id,
        author_name: authorName,
        avatar_url: avatarUrl,
        content: content,
      }
    ])

    if (error) {
      alert('댓글 작성 중 오류가 발생했습니다: ' + error.message)
    } else {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
      fetchCommentsForPost(postId)
      fetchPosts()
    }
  }

  const handleDeleteComment = async (commentId, postId, commentUserId) => {
    if (!session) return
    if (session.user.id !== commentUserId) {
      alert('본인이 작성한 댓글만 삭제할 수 있습니다.')
      return
    }

    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message)
    } else {
      fetchCommentsForPost(postId)
      fetchPosts()
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하만 업로드 가능합니다.')
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!session) {
      alert('로그인이 필요한 기능입니다!')
      return
    }
    if (!newTitle.trim() || !newContent.trim()) {
      alert('제목과 내용을 모두 입력해 주세요.')
      return
    }

    setIsSubmitting(true)
    const authorName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || '무명 제자'
    const userId = session.user.id

    let uploadedImageUrl = null

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, imageFile)

      if (uploadError) {
        alert('이미지 업로드 실패: ' + uploadError.message)
        setIsSubmitting(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName)

      uploadedImageUrl = urlData.publicUrl
    }

    const { error } = await supabase.from('posts').insert([
      {
        user_id: userId,
        author_name: authorName,
        team_id: postTeam,
        category: newCategory,
        title: newTitle.trim(),
        content: newContent.trim(),
        image_url: uploadedImageUrl
      }
    ])

    setIsSubmitting(false)

    if (error) {
      alert('글 작성 중 오류가 발생했습니다: ' + error.message)
    } else {
      setNewTitle('')
      setNewContent('')
      setImageFile(null)
      setImagePreview(null)
      fetchPosts()
    }
  }

  const handleDeletePost = async (postId, postUserId) => {
    if (!session) return
    if (session.user.id !== postUserId) {
      alert('본인이 작성한 글만 삭제할 수 있습니다.')
      return
    }

    if (!window.confirm('정말 이 게시글을 삭제하시겠습니까?')) return

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message)
    } else {
      fetchPosts()
    }
  }

  const handleLikePost = async (postId, currentLikes) => {
    if (!session) {
      alert('로그인이 필요한 기능입니다!')
      return
    }

    const isAlreadyLiked = likedPostIds.includes(postId)
    const newLikesCount = isAlreadyLiked 
      ? Math.max(0, (currentLikes || 0) - 1) 
      : (currentLikes || 0) + 1

    const updatedLikedIds = isAlreadyLiked
      ? likedPostIds.filter((id) => id !== postId)
      : [...likedPostIds, postId]

    setLikedPostIds(updatedLikedIds)
    try {
      localStorage.setItem('rakko_liked_posts', JSON.stringify(updatedLikedIds))
    } catch (err) {
      console.error('localStorage 저장 실패:', err)
    }

    const { error } = await supabase
      .from('posts')
      .update({ likes: newLikesCount })
      .eq('id', postId)

    if (!error) {
      fetchPosts()
    }
  }

  const handleDiscordLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin,
      },
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const filteredPosts = selectedTeamFilter === 'all'
    ? posts
    : posts.filter((p) => p.team_id === selectedTeamFilter)

  // 🗓️ 달력 날짜 연산
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const currentTeamWeedCount = myTeamInfo?.weed_count || 0

  // 🗂️ 선택한 날짜의 일정 카드 (D-day, 분류 색상, 디스코드 이동, 캘린더 추가)
  const selectedSchedules = schedules.filter((s) => isScheduleForDate(s, selectedDateStr))
  const kstTodayStr = getKstToday()

  const renderScheduleCard = (sch) => {
    const isBirthday = sch.category && sch.category.includes('생일')
    const timeStr = !isBirthday ? getTimeStr(sch.event_date) : ''
    const dday = !isBirthday ? getDDay(sch.event_date) : null
    const catStyle = getCategoryStyle(sch.category)
    const isPast = dday && dday.label === '종료'
    const discordUrl = DISCORD_GUILD_ID && sch.discord_thread_id
      ? `https://discord.com/channels/${DISCORD_GUILD_ID}/${sch.discord_thread_id}`
      : null
    const googleUrl = !isBirthday ? buildGoogleCalendarUrl(sch) : null

    const actionBtn = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
      padding: isMobile ? '9px 10px' : '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
      border: '1px solid #cbd5e1', background: '#fff', color: '#334155', cursor: 'pointer',
      textDecoration: 'none', flex: isMobile ? '1 1 0' : '0 0 auto', whiteSpace: 'nowrap'
    }

    return (
      <div
        key={sch.id}
        style={{
          padding: '12px',
          background: isBirthday ? '#fff5f5' : '#f8fafc',
          borderRadius: '12px',
          border: isBirthday ? '1px solid #fecdd3' : '1px solid #e2e8f0',
          opacity: isPast ? 0.7 : 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          {isBirthday ? (
            <img
              src={sch.created_by_avatar || RAKKO_MASTER_IMAGE}
              alt="생일자 프로필"
              style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #f43f5e', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: catStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
              🎮
            </div>
          )}

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', wordBreak: 'break-word', lineHeight: 1.35 }}>
              {isBirthday ? '🎂 ' : ''}{sch.title}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              {isBirthday ? (
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: '#fce7f3', color: '#be185d' }}>생일</span>
              ) : (
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: catStyle.bg, color: catStyle.color }}>
                  {sch.category || '기타'}
                </span>
              )}
              {timeStr && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={12} /> {timeStr}
                </span>
              )}
              {dday && (
                <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: dday.bg, color: dday.color }}>
                  {dday.label}
                </span>
              )}
            </div>

            {sch.created_by_name && (
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                {sch.created_by_avatar && (
                  <img src={sch.created_by_avatar} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%' }} />
                )}
                <span>등록: <b>{sch.created_by_name}</b></span>
              </div>
            )}
          </div>
        </div>

        {(discordUrl || googleUrl) && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0' }}>
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noopener noreferrer" style={{ ...actionBtn, background: '#5865f2', borderColor: '#5865f2', color: '#fff' }}>
                <ExternalLink size={13} /> 디스코드에서 보기
              </a>
            )}
            {googleUrl && (
              <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={actionBtn}>
                <CalendarPlus size={13} /> 구글 캘린더
              </a>
            )}
            {googleUrl && (
              <button type="button" onClick={() => downloadIcs(sch)} style={actionBtn}>
                <Download size={13} /> .ics 저장
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: isMobile ? '12px 10px' : '20px 16px' }}>
      {/* 📱 모바일 전역 보정: 카드 여백 축소, 입력창 자동 확대(iOS) 방지 */}
      <style>{`
        @media (max-width: 640px) {
          .card { padding: 14px !important; }
          input, select, textarea { font-size: 16px !important; }
          button { touch-action: manipulation; }
        }
      `}</style>
      {/* 1. 상단 프로필 & 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '14px' : '20px', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src={RAKKO_MASTER_IMAGE} 
            alt="스승 랏코" 
            style={{ 
              width: '48px', 
              height: '48px', 
              borderRadius: '14px', 
              backgroundColor: '#fef3c7', 
              padding: '3px',
              objectFit: 'cover' 
            }} 
          />
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? '17px' : '20px', fontWeight: '800' }}>랏코와 제자들</h1>
            <p style={{ margin: '2px 0 0 0', color: 'var(--text-muted)', fontSize: isMobile ? '11px' : '13px' }}>디스코드 커뮤니티 대시보드</p>
          </div>
        </div>

        {session ? (
          <div 
            onClick={() => handleOpenProfileModal(session.user.id, session.user.user_metadata?.full_name, session.user.user_metadata?.avatar_url)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer' }}
          >
            <img 
              src={session.user.user_metadata?.avatar_url} 
              alt="avatar" 
              style={{ width: '28px', height: '28px', borderRadius: '50%' }}
            />
            <span style={{ fontWeight: '600', fontSize: '13px', maxWidth: isMobile ? '84px' : '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.user_metadata?.full_name}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); handleLogout(); }} 
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', padding: 0 }}
            >
              <LogOut size={15}/>
            </button>
          </div>
        ) : (
          <button onClick={handleDiscordLogin} className="btn-primary" style={{ padding: '8px 14px', fontSize: '13px' }}>
            <LogIn size={16}/> 로그인
          </button>
        )}
      </header>

      {/* 2. 메인 네비게이션 탭 */}
      <nav style={{ display: 'flex', gap: '8px', marginBottom: isMobile ? '14px' : '20px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          style={{
            flex: '1 0 auto',
            padding: isMobile ? '9px 10px' : '10px 12px',
            borderRadius: '12px',
            border: activeTab === 'home' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            background: activeTab === 'home' ? '#eff6ff' : '#fff',
            color: activeTab === 'home' ? '#1d4ed8' : '#64748b',
            fontWeight: '700',
            fontSize: isMobile ? '12px' : '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <LayoutDashboard size={16} /> 대시보드
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('training')}
          style={{
            flex: '1 0 auto',
            padding: isMobile ? '9px 10px' : '10px 12px',
            borderRadius: '12px',
            border: activeTab === 'training' ? '2px solid #d97706' : '1px solid #e2e8f0',
            background: activeTab === 'training' ? '#fffbe3' : '#fff',
            color: activeTab === 'training' ? '#b45309' : '#64748b',
            fontWeight: '700',
            fontSize: isMobile ? '12px' : '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <Swords size={16} /> 수련의 전당
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('community')}
          style={{
            flex: '1 0 auto',
            padding: isMobile ? '9px 10px' : '10px 12px',
            borderRadius: '12px',
            border: activeTab === 'community' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            background: activeTab === 'community' ? '#eff6ff' : '#fff',
            color: activeTab === 'community' ? '#1d4ed8' : '#64748b',
            fontWeight: '700',
            fontSize: isMobile ? '12px' : '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <MessageSquare size={16} /> 팀 커뮤니티
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          style={{
            flex: '1 0 auto',
            padding: isMobile ? '9px 10px' : '10px 12px',
            borderRadius: '12px',
            border: activeTab === 'calendar' ? '2px solid #8b5cf6' : '1px solid #e2e8f0',
            background: activeTab === 'calendar' ? '#f5f3ff' : '#fff',
            color: activeTab === 'calendar' ? '#6d28d9' : '#64748b',
            fontWeight: '700',
            fontSize: isMobile ? '12px' : '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            whiteSpace: 'nowrap'
          }}
        >
          <CalendarIcon size={16} /> 📅 일정 달력
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            style={{
              flex: '1 0 auto',
              padding: isMobile ? '9px 10px' : '10px 12px',
              borderRadius: '12px',
              border: activeTab === 'admin' ? '2px solid #dc2626' : '1px solid #e2e8f0',
              background: activeTab === 'admin' ? '#fef2f2' : '#fff',
              color: activeTab === 'admin' ? '#b91c1c' : '#64748b',
              fontWeight: '700',
              fontSize: isMobile ? '12px' : '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Shield size={16} /> 관리자
          </button>
        )}
      </nav>

      {/* ========================================================= */}
      {/* 📄 [PAGE 1] 메인 대시보드 */}
      {/* ========================================================= */}
      {activeTab === 'home' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy color="#f59e0b" size={20} /> 종족별 팀 순위
            </h2>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: '#f3f4f6', padding: '3px 6px', borderRadius: '6px' }}>
              실시간 자동 집계
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {teams.map((team, index) => {
              const teamMembers = allProfiles.filter((profile) => profile.team_id === team.team_id)

              return (
                <div 
                  key={team.team_id} 
                  style={{ 
                    padding: '14px', 
                    backgroundColor: index === 0 ? '#fafaf9' : '#f8fafc', 
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                        {index + 1}
                      </div>

                      <img 
                        src={TEAM_CONFIG[team.team_id]?.image || RAKKO_MASTER_IMAGE} 
                        alt={team.team_name} 
                        style={{ 
                          width: '32px', 
                          height: '32px', 
                          borderRadius: '50%', 
                          border: '2px solid #e2e8f0',
                          objectFit: 'cover',
                          backgroundColor: '#fff'
                        }} 
                      />

                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{team.team_name}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare size={13}/> {(team.weekly_chats || 0).toLocaleString()}회
                      </span>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🌱 제초: {(team.weed_count || 0).toLocaleString()}회
                      </span>
                      <span style={{ fontWeight: '800', color: '#d97706', fontSize: '15px' }}>
                        {(team.total_points || 0).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '500' }}>pt</span>
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginRight: '2px' }}>
                      소속 제자 ({teamMembers.length}명):
                    </span>

                    {teamMembers.length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>아직 소속된 제자가 없습니다.</span>
                    ) : (
                      teamMembers.map((member) => (
                        <div 
                          key={member.id || member.user_id || member.discord_id}
                          onClick={() => handleOpenProfileModal(member.user_id, member.username, member.avatar_url)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fff',
                            border: '1px solid #cbd5e1',
                            padding: '3px 8px',
                            borderRadius: '14px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#334155'
                          }}
                          title={`${member.username} 제자 프로필 보기`}
                        >
                          <img 
                            src={member.avatar_url || RAKKO_MASTER_IMAGE} 
                            alt="" 
                            style={{ width: '15px', height: '15px', borderRadius: '50%', objectFit: 'cover' }} 
                          />
                          <span>{member.username}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 📄 [PAGE 2] 🥋 수련의 전당 */}
      {/* ========================================================= */}
      {activeTab === 'training' && (
        <>
          <section className="card" style={{ background: 'linear-gradient(135deg, #fffbe3 0%, #fef3c7 100%)', borderColor: '#fde68a', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Gift color="#d97706" size={18} /> 🔮 랏코 스승의 오늘의 운세
                </h2>
                <p style={{ margin: 0, color: '#b45309', fontSize: '13px' }}>
                  하루에 한 번 스승의 지침과 보너스 점수를 획득하세요!
                </p>
              </div>

              <button
                type="button"
                onClick={handleDrawFortune}
                disabled={hasDrawnFortune}
                style={{
                  background: hasDrawnFortune ? '#cbd5e1' : '#d97706',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: hasDrawnFortune ? 'default' : 'pointer'
                }}
              >
                {hasDrawnFortune ? '완료' : '뽑기 🥠'}
              </button>
            </div>

            {todayFortune && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #fcd34d', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', padding: '3px 8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                  {todayFortune.grade}
                </span>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#78350f', flex: 1 }}>
                  "{todayFortune.quote}"
                </p>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', whiteSpace: 'nowrap' }}>
                  +{todayFortune.points} pt
                </span>
              </div>
            )}
          </section>

          <section className="card" style={{ background: '#fef2f2', borderColor: '#fecdd3', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target color="#dc2626" size={18} /> 🗡️ 오늘의 토벌 수련
                </h2>
                <p style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
                  몬스터가 나타나면 가장 빠르게 클릭하세요! (무제한 다시 도전 가능)
                </p>
              </div>

              {subjugationStatus === 'idle' && (
                <button
                  type="button"
                  onClick={handleStartSubjugation}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  시작 🗡️
                </button>
              )}
            </div>

            {subjugationStatus === 'waiting' && (
              <div 
                onClick={handleMonsterClick}
                style={{
                  background: '#fee2e2',
                  border: '2px dashed #f87171',
                  padding: '18px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#991b1b' }}>
                  👀 기회를 노리는 중... 나타날 때까지 대기하세요!
                </p>
              </div>
            )}

            {subjugationStatus === 'ready' && (
              <div 
                onClick={handleMonsterClick}
                style={{
                  background: '#ef4444',
                  padding: '22px',
                  borderRadius: '10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  boxShadow: '0 0 12px rgba(239,68,68,0.5)'
                }}
              >
                <p style={{ margin: 0, fontSize: '18px', fontWeight: '900' }}>
                  👾 몬스터 출현! 클릭하세요!!!
                </p>
              </div>
            )}

            {subjugationStatus === 'finished' && subjugationResult && (
              <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', padding: '2px 8px', borderRadius: '10px', background: '#fee2e2', color: '#991b1b' }}>
                      {subjugationResult.grade}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                      반응 속도: <b>{subjugationResult.reactionTime} ms</b>
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: '#dc2626' }}>
                    +{subjugationResult.points} pt
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRetrySubjugation}
                  style={{
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '8px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <RotateCcw size={14} /> 다시 도전하기 🗡️
                </button>
              </div>
            )}
          </section>

          <section className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles color="#16a34a" size={18} /> 🌱 오늘의 제초 수련
                </h2>
                <p style={{ margin: 0, color: '#15803d', fontSize: '13px' }}>
                  잡초를 뽑아 팀 포인트를 모으세요. (종족당 하루 1,000회 / 0.2초 쿨타임)
                </p>
              </div>
              <button 
                onClick={handleWeedingClick} 
                disabled={weedingCooldown || teamDailyWeedUsed >= 1000}
                className="btn-weed" 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '13px',
                  opacity: (weedingCooldown || teamDailyWeedUsed >= 1000) ? 0.6 : 1,
                  cursor: (weedingCooldown || teamDailyWeedUsed >= 1000) ? 'not-allowed' : 'pointer'
                }}
              >
                <Flame size={16} /> {teamDailyWeedUsed >= 1000 ? '팀 한도 달성' : weedingCooldown ? '대기 중...' : '잡초 뽑기 (+2 pt)'}
              </button>
            </div>

            {session && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #a7f3d0', color: '#166534', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div>오늘 우리 종족 제초: <b>{teamDailyWeedUsed.toLocaleString()}</b> / 1,000회</div>
                <div style={{ fontSize: '12px', color: '#15803d', background: '#dcfce7', padding: '2px 8px', borderRadius: '10px', border: '1px solid #86efac' }}>
                  팀 총 제초: <b>{currentTeamWeedCount.toLocaleString()}</b>회 (오늘 남은 횟수: <b>{Math.max(0, 1000 - teamDailyWeedUsed).toLocaleString()}</b>회)
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* ========================================================= */}
      {/* 📄 [PAGE 3] 팀 커뮤니티 */}
      {/* ========================================================= */}
      {activeTab === 'community' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare color="#3b82f6" size={20} /> 💬 제자 마을 팀 커뮤니티
            </h2>
          </div>

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '14px' }}>
            <button
              type="button"
              onClick={() => setSelectedTeamFilter('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '16px',
                border: 'none',
                background: selectedTeamFilter === 'all' ? '#3b82f6' : '#f1f5f9',
                color: selectedTeamFilter === 'all' ? '#fff' : '#475569',
                fontWeight: '600',
                fontSize: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Users size={13} /> 전체보기
            </button>
            {Object.entries(TEAM_CONFIG).map(([id, info]) => (
              <button
                type="button"
                key={id}
                onClick={() => setSelectedTeamFilter(id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  border: selectedTeamFilter === id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: selectedTeamFilter === id ? '#eff6ff' : '#fff',
                  color: selectedTeamFilter === id ? '#1d4ed8' : '#334155',
                  fontWeight: selectedTeamFilter === id ? '700' : '500',
                  fontSize: '12px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <img src={info.image} alt={info.name} style={{ width: '15px', height: '15px', borderRadius: '50%', objectFit: 'cover' }} />
                {info.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreatePost} style={{ marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select 
                  value={postTeam} 
                  onChange={(e) => setPostTeam(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', fontWeight: '600' }}
                >
                  {Object.entries(TEAM_CONFIG).map(([id, info]) => (
                    <option key={id} value={id}>[{info.name}] 게시판</option>
                  ))}
                </select>

                <select 
                  value={newCategory} 
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                >
                  <option value="자유">자유</option>
                  <option value="수련인증">수련인증</option>
                  <option value="질문">질문</option>
                </select>
              </div>

              <input 
                type="text" 
                placeholder={session ? "제목을 입력하세요" : "로그인 후 글을 쓸 수 있습니다"}
                value={newTitle}
                disabled={!session || isSubmitting}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <textarea 
              placeholder={session ? "팀원들과 나누고 싶은 이야기나 인증할 사진을 올려보세요..." : "로그인 후 이야기를 나누어 보세요!"}
              value={newContent}
              disabled={!session || isSubmitting}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '8px' }}
            />

            {imagePreview && (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '10px' }}>
                <img 
                  src={imagePreview} 
                  alt="업로드 미리보기" 
                  style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: session ? 'pointer' : 'not-allowed', color: '#475569', fontSize: '13px', background: '#fff', padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Upload size={14} color="#3b82f6" />
                <span>사진 첨부</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange} 
                  disabled={!session || isSubmitting}
                  style={{ display: 'none' }} 
                />
              </label>

              <button 
                type="submit" 
                disabled={!session || isSubmitting} 
                className="btn-primary" 
                style={{ padding: '6px 14px', fontSize: '13px', opacity: session && !isSubmitting ? 1 : 0.6 }}
              >
                <Send size={14} /> {isSubmitting ? '업로드 중...' : '작성'}
              </button>
            </div>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPosts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
                남겨진 이야기가 없습니다. 첫 번째 글을 남겨보세요!
              </p>
            ) : (
              filteredPosts.map((post) => {
                const teamInfo = TEAM_CONFIG[post.team_id] || TEAM_CONFIG.rakko
                const isLiked = likedPostIds.includes(post.id)
                const isCommentsExpanded = expandedPostIds.includes(post.id)
                const postComments = commentsMap[post.id] || []
                const commentCount = post.comments?.[0]?.count || 0

                return (
                  <div 
                    key={post.id} 
                    style={{ padding: '14px', borderRadius: '12px', border: '1px solid #edf2f7', background: '#fff' }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <img src={teamInfo.image} alt="" style={{ width: '13px', height: '13px', borderRadius: '50%', objectFit: 'cover' }} />
                            {teamInfo.name}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', background: '#f1f5f9', color: '#475569' }}>
                            {post.category || '자유'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                            type="button"
                            onClick={() => toggleComments(post.id)}
                            style={{ 
                              border: '1px solid #e2e8f0', 
                              background: isCommentsExpanded ? '#eff6ff' : '#f8fafc', 
                              color: isCommentsExpanded ? '#2563eb' : '#64748b', 
                              padding: '3px 8px', 
                              borderRadius: '14px', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '3px', 
                              fontSize: '12px', 
                              fontWeight: '600'
                            }}
                          >
                            <MessageCircle size={13} /> {commentCount}
                          </button>

                          <button 
                            type="button"
                            onClick={() => handleLikePost(post.id, post.likes)}
                            style={{ 
                              border: isLiked ? '1px solid #fecdd3' : '1px solid #e2e8f0', 
                              background: isLiked ? '#fff0f3' : '#f8fafc', 
                              color: isLiked ? '#e11d48' : '#64748b', 
                              padding: '3px 8px', 
                              borderRadius: '14px', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '3px', 
                              fontSize: '12px', 
                              fontWeight: '600'
                            }}
                          >
                            <Heart size={13} fill={isLiked ? '#e11d48' : 'none'} color={isLiked ? '#e11d48' : '#64748b'} /> 
                            {post.likes || 0}
                          </button>

                          {session && session.user.id === post.user_id && (
                            <button 
                              type="button"
                              onClick={() => handleDeletePost(post.id, post.user_id)}
                              style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '3px 6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '11px' }}
                            >
                              <Trash2 size={12} /> 삭제
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a', lineHeight: '1.4', wordBreak: 'break-word' }}>
                        {post.title}
                      </h3>
                    </div>

                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#334155', lineHeight: '1.6', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      {post.content}
                    </p>

                    {post.image_url && (
                      <div style={{ marginBottom: '10px' }}>
                        <a href={post.image_url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={post.image_url} 
                            alt="게시글 첨부 사진" 
                            style={{ maxWidth: '100%', maxHeight: '300px', height: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', objectFit: 'cover' }} 
                          />
                        </a>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <span 
                        onClick={() => handleOpenProfileModal(post.user_id, post.author_name)}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        <User size={12} /> {post.author_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={12} /> {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {isCommentsExpanded && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                        <form 
                          onSubmit={(e) => handleCreateComment(post.id, e)} 
                          style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}
                        >
                          <input 
                            type="text" 
                            placeholder={session ? "댓글 남기기..." : "로그인 필요"}
                            disabled={!session}
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                          />
                          <button 
                            type="submit" 
                            disabled={!session}
                            className="btn-primary" 
                            style={{ padding: '6px 10px', fontSize: '12px', opacity: session ? 1 : 0.6 }}
                          >
                            <Send size={12} /> 등록
                          </button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {postComments.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0' }}>첫 댓글을 남겨보세요!</p>
                          ) : (
                            postComments.map((comment) => (
                              <div 
                                key={comment.id} 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '8px 10px', borderRadius: '8px' }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div 
                                    onClick={() => handleOpenProfileModal(comment.user_id, comment.author_name, comment.avatar_url)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px', cursor: 'pointer' }}
                                  >
                                    {comment.avatar_url && (
                                      <img src={comment.avatar_url} alt="" style={{ width: '15px', height: '15px', borderRadius: '50%' }} />
                                    )}
                                    <span style={{ fontWeight: '700', fontSize: '12px', color: '#334155', textDecoration: 'underline' }}>{comment.author_name}</span>
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                      {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                                </div>

                                {session && session.user.id === comment.user_id && (
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id, post.id, comment.user_id)}
                                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 📅 [PAGE 4] 일정 달력 탭 */}
      {/* ========================================================= */}
      {activeTab === 'calendar' && (
        <section className="card" style={{ background: '#fff', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>
              {year}년 {month + 1}월 일정
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={prevMonth} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={nextMonth} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', fontWeight: '700', fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
            <div style={{ color: '#ef4444' }}>일</div>
            <div>월</div><div>화</div><div>수</div><div>목</div><div>금</div>
            <div style={{ color: '#3b82f6' }}>토</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} style={{ height: isMobile ? '48px' : '70px', background: '#f8fafc', borderRadius: '8px' }} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
              
              const daySchedules = schedules.filter((s) => isScheduleForDate(s, dateStr))
              const isSelected = selectedDateStr === dateStr

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  style={{
                    height: isMobile ? '48px' : '70px',
                    padding: '4px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #8b5cf6' : dateStr === kstTodayStr ? '1px solid #a78bfa' : '1px solid #f1f5f9',
                    background: isSelected ? '#f5f3ff' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  <span style={{ fontSize: '11px', fontWeight: '700', color: isSelected ? '#6d28d9' : '#334155' }}>
                    {dayNum}
                  </span>

                  {isMobile ? (
                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginTop: '4px', alignItems: 'center' }}>
                      {daySchedules.slice(0, 3).map((sch) => (
                        <span
                          key={sch.id}
                          style={{ width: '7px', height: '7px', borderRadius: '50%', background: sch.category === '생일' ? '#ec4899' : '#0ea5e9' }}
                        />
                      ))}
                      {daySchedules.length > 3 && (
                        <span style={{ fontSize: '9px', fontWeight: '800', color: '#64748b' }}>+{daySchedules.length - 3}</span>
                      )}
                    </div>
                  ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px', overflowY: 'auto' }}>
                    {daySchedules.map((sch) => {
                      const isBirthday = sch.category === '생일'
                      const timeStr = !isBirthday ? getTimeStr(sch.event_date) : ''
                      const displayTitle = timeStr ? `[${timeStr}] ${sch.title}` : sch.title

                      return (
                        <div
                          key={sch.id}
                          style={{
                            fontSize: '9px',
                            padding: '1px 3px',
                            borderRadius: '4px',
                            background: isBirthday ? '#fce7f3' : '#e0f2fe',
                            color: isBirthday ? '#be185d' : '#0369a1',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          {isBirthday && sch.created_by_avatar ? (
                            <img src={sch.created_by_avatar} alt="" style={{ width: '10px', height: '10px', borderRadius: '50%' }} />
                          ) : null}
                          {displayTitle}
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#334155' }}>
              📌 {selectedDateStr} 일정 상세 {selectedSchedules.length > 0 && <span style={{ color: '#8b5cf6' }}>({selectedSchedules.length})</span>}
            </h3>

            {selectedSchedules.length === 0 ? (
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>등록된 일정이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedSchedules.map((sch) => renderScheduleCard(sch))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 🛡️ [PAGE 5] 관리자 페이지 (관리자만 보임 / 권한은 DB 함수가 다시 검사) */}
      {/* ========================================================= */}
      {activeTab === 'admin' && isAdmin && (
        <AdminPanel
          supabase={supabase}
          teamConfig={TEAM_CONFIG}
          isMobile={isMobile}
          onDataChanged={() => {
            fetchSchedules()
            fetchTeamScores()
            fetchUserProfiles()
            fetchPosts()
          }}
        />
      )}

      {/* ========================================================= */}
      {/* 🎴 [MODAL 1] 제자 프로필 카카오톡 모달 */}
      {/* ========================================================= */}
      {selectedProfileModal.isOpen && (
        <div 
          onClick={handleCloseProfileModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px'
          }} 
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{
              width: '100%',
              maxWidth: '360px',
              backgroundColor: '#fff',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              position: 'relative'
            }}
          >
            <button 
              onClick={handleCloseProfileModal}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0,0,0,0.2)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={15} />
            </button>

            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
              padding: '24px 16px 16px 16px',
              textAlign: 'center'
            }}>
              <img 
                src={selectedProfileModal.profile?.avatar_url || RAKKO_MASTER_IMAGE} 
                alt="프로필" 
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  border: '3px solid #fff',
                  backgroundColor: '#fff',
                  objectFit: 'cover',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                  marginBottom: '6px'
                }}
              />
              
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                {selectedProfileModal.profile?.username || '익명 제자'}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap' }}>
                {selectedProfileModal.profile?.team_id && (
                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <img src={TEAM_CONFIG[selectedProfileModal.profile.team_id]?.image || RAKKO_MASTER_IMAGE} alt="" style={{ width: '12px', height: '12px', borderRadius: '50%', objectFit: 'cover' }} />
                    {TEAM_CONFIG[selectedProfileModal.profile.team_id]?.name || '랏코'}
                  </span>
                )}

                {(() => {
                  const title = getTitleByPoints(selectedProfileModal.profile?.points || 0)
                  return (
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.9)', color: title.color }}>
                      {title.name}
                    </span>
                  )
                })()}
              </div>
            </div>

            {selectedProfileModal.loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                프로필 조회 중...
              </div>
            ) : (
              <div style={{ padding: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '10px', border: '1px solid #f1f5f9', textAlign: 'center', marginBottom: '14px' }}>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>누적 제초/수련 포인트</span>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
                    {(selectedProfileModal.profile?.points || 0).toLocaleString()} <span style={{ fontSize: '11px', fontWeight: '500' }}>pt</span>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Gamepad2 size={13} color="#3b82f6" /> 게임 전적 / 티어
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
                    <div style={{ background: '#fafaf9', padding: '6px 4px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>오버워치</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7', marginTop: '2px' }}>
                        {getHighestOwMMR(selectedProfileModal.profile)}
                      </div>
                    </div>

                    <div style={{ background: '#fafaf9', padding: '6px 4px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>롤</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#059669', marginTop: '2px' }}>
                        {selectedProfileModal.profile?.lol_tier || '미등록'}
                      </div>
                    </div>

                    <div style={{ background: '#fafaf9', padding: '6px 4px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>발로란트</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#e11d48', marginTop: '2px' }}>
                        {selectedProfileModal.profile?.val_tier || '미등록'}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={13} color="#3b82f6" /> 최근 작성한 글 ({selectedProfileModal.userPosts.length})
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '110px', overflowY: 'auto' }}>
                    {selectedProfileModal.userPosts.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>
                        작성한 글이 없습니다.
                      </p>
                    ) : (
                      selectedProfileModal.userPosts.map((post) => (
                        <div 
                          key={post.id} 
                          style={{ padding: '5px 8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                            {post.title}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            {new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
