import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Trophy, LogIn, LogOut, Sparkles, MessageSquare, Flame, Send, Heart, User, Clock, Trash2, X, Users, Upload, MessageCircle, Gift, LayoutDashboard, Target, Zap } from 'lucide-react'

// 상단 헤더 및 랏코 대표 이미지 URL
const RAKKO_MASTER_IMAGE = 'https://i.namu.wiki/i/hjmKzkBU2dSFzcMGW-2FGuhLw2KJsRh0QICaMPUWpUhDKfNNewH-PNO4_jdir725sYrgFJd4vykBGsk5FQ_UJA.webp'

// 종족(팀) ID별 대표 캐릭터 및 이름 매핑
const TEAM_CONFIG = {
  rakko: { name: '랏코', image: RAKKO_MASTER_IMAGE },
  chiikawa: { name: '치이카와', image: 'https://i.namu.wiki/i/dB_CPoscQ6UKTy-0ogw-ntKAX78MU_gr5T3eSIbDEOF4ec0aTaJKbXkIzN-Cod1Sh1NIqIdOT1eXavMKvJ6tcQ.webp' },
  hachiware: { name: '하치와레', image: 'https://i.namu.wiki/i/mqiv0Rb5tbt2C3cCkJCMV_NCeX7YCFfXpYUIebD5_gyietmJewBWlY7uBnyWCHP92ZNY-uIJtNhpuKbyAP40HA.webp' },
  usagi: { name: '우사기', image: 'https://i.namu.wiki/i/PJL_NmmYcz0IvJbqzwprwPbDN_X-bdmBEMAvlc2XZrxUu0crrWUdNV6eZ4_6cUz4CjXrnl4_xtSLGHvRnAEBBA.webp' },
  momonga: { name: '모몽가', image: 'https://i.namu.wiki/i/m3vvkdjvU71l5ryX3GHeQz-t-39twY_SSmfUZGCnufTadOJBpMQhciMnQen0H8aufzkW8I13kRGBYJyI9UiYxw.webp' },
  kurimanju: { name: '크리만쥬', image: 'https://i.namu.wiki/i/A-umWeRuPvy8wgp0raNVjoDASW6dyP_MTF58AMWMJjUwm2mJQyUwi7NWbuRcWPwZu5PhUgVbJK-Bb0u2A47ccg.webp' },
  shisa: { name: '시사', image: 'https://i.namu.wiki/i/FJNlLvE3p0nZ9m3zif83srjt7y0dCpxPfYB-qENldPpZ7cw3yX4y07oVMT8mLoewnmsv0vQOAXP7W1PRJyc2ow.webp' },
}

// 🔮 랏코 스승의 운세 목록 데이터
const FORTUNES = [
  { grade: '대길 🌟', quote: '오늘 너의 검 끝은 매섭군! 무슨 일이든 당당하게 임하라.', points: 5 },
  { grade: '중길 ⚔️', quote: '기본 자세가 제일 중요하다. 방심하지 마라!', points: 3 },
  { grade: '소길 🍨', quote: '달콤한 파르페를 먹으면 오늘은 기분 좋은 일이 생길 것이다.', points: 2 },
  { grade: '평길 🍵', quote: '쉬는 것도 수련의 일부다. 따뜻한 차 한 잔의 여유를 가져라.', points: 1 },
  { grade: '말길 🍃', quote: '과자는 적당히 먹고, 제초 수련부터 차근차근 시작해라.', points: 1 },
]

export default function App() {
  const [session, setSession] = useState(null)
  const [activeTab, setActiveTab] = useState('home') // 'home' | 'community'

  const [teams, setTeams] = useState([])
  const [userPoints, setUserPoints] = useState(0)

  // 🔮 오늘의 운세 관련 상태
  const [todayFortune, setTodayFortune] = useState(null)
  const [hasDrawnFortune, setHasDrawnFortune] = useState(false)

  // 🗡️ 오늘의 토벌 수련 관련 상태
  const [subjugationStatus, setSubjugationStatus] = useState('idle') // 'idle' | 'waiting' | 'ready' | 'finished'
  const [hasDoneSubjugation, setHasDoneSubjugation] = useState(false)
  const [subjugationResult, setSubjugationResult] = useState(null)
  const [monsterStartTime, setMonsterStartTime] = useState(null)
  const [subjugationTimer, setSubjugationTimer] = useState(null)

  // 게시판 관련 상태
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

  // 💬 댓글 관련 상태
  const [expandedPostIds, setExpandedPostIds] = useState([])
  const [commentsMap, setCommentsMap] = useState({})
  const [commentInputs, setCommentInputs] = useState({})

  // 💖 좋아요 누른 게시글 ID 목록 (localStorage 연동)
  const [likedPostIds, setLikedPostIds] = useState(() => {
    try {
      const saved = localStorage.getItem('rakko_liked_posts')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)

    // 운세 로드
    const savedFortuneDate = localStorage.getItem('rakko_fortune_date')
    const savedFortuneData = localStorage.getItem('rakko_fortune_data')
    if (savedFortuneDate === todayStr && savedFortuneData) {
      setHasDrawnFortune(true)
      try { setTodayFortune(JSON.parse(savedFortuneData)) } catch {}
    }

    // 토벌 데이터 로드
    const savedSubDate = localStorage.getItem('rakko_sub_date')
    const savedSubData = localStorage.getItem('rakko_sub_data')
    if (savedSubDate === todayStr && savedSubData) {
      setHasDoneSubjugation(true)
      setSubjugationStatus('finished')
      try { setSubjugationResult(JSON.parse(savedSubData)) } catch {}
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
          .eq('discord_id', discordId)

        if (error) {
          console.error('프로필 조회 실패:', error.message)
          return
        }

        const existingProfile = profiles && profiles.length > 0 ? profiles[0] : null

        if (existingProfile) {
          await supabase.from('user_profiles').update({
            username: username,
            avatar_url: avatarUrl
          }).eq('discord_id', discordId)

          if (existingProfile.team_id) {
            setPostTeam(existingProfile.team_id)
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
    fetchPosts()

    return () => subscription.unsubscribe()
  }, [])

  const fetchTeamScores = async () => {
    const { data, error } = await supabase
      .from('team_scores')
      .select('*')
      .order('total_points', { ascending: false })
    if (!error && data) setTeams(data)
  }

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*, comments(count)')
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
  }

  // 🔮 랏코 스승의 오늘의 운세 뽑기
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

    try {
      const discordId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub || ''
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('team_id')
        .or(`user_id.eq.${session.user.id},discord_id.eq.${discordId}`)
        .maybeSingle()

      if (profile && profile.team_id) {
        const targetTeam = profile.team_id
        const { data: teamData } = await supabase
          .from('team_scores')
          .select('total_points')
          .eq('team_id', targetTeam)
          .maybeSingle()

        if (teamData) {
          const newPoints = (teamData.total_points || 0) + randomFortune.points
          await supabase.from('team_scores').update({ total_points: newPoints }).eq('team_id', targetTeam)
          setUserPoints((prev) => prev + randomFortune.points)
          fetchTeamScores()
        }
      }
    } catch (err) {
      console.error('운세 포인트 반영 중 오류 발생:', err)
    }
  }

  // 🗡️ 토벌 수련 시작 (준비 단계)
  const handleStartSubjugation = () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }
    if (hasDoneSubjugation) {
      alert('오늘의 토벌 수련은 이미 완료하셨습니다! 내일 다시 도전해 주세요.')
      return
    }

    setSubjugationStatus('waiting')
    const randomDelay = Math.floor(Math.random() * 2000) + 1500 // 1.5초~3.5초 지연

    const timer = setTimeout(() => {
      setSubjugationStatus('ready')
      setMonsterStartTime(Date.now())
    }, randomDelay)

    setSubjugationTimer(timer)
  }

  // 🗡️ 몬스터 클릭 (순발력 측정)
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
      setHasDoneSubjugation(true)

      const todayStr = new Date().toISOString().slice(0, 10)
      localStorage.setItem('rakko_sub_date', todayStr)
      localStorage.setItem('rakko_sub_data', JSON.stringify(result))

      // 팀 점수 반영
      try {
        const discordId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub || ''
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('team_id')
          .or(`user_id.eq.${session.user.id},discord_id.eq.${discordId}`)
          .maybeSingle()

        if (profile && profile.team_id) {
          const targetTeam = profile.team_id
          const { data: teamData } = await supabase
            .from('team_scores')
            .select('total_points')
            .eq('team_id', targetTeam)
            .maybeSingle()

          if (teamData) {
            const newPoints = (teamData.total_points || 0) + result.points
            await supabase.from('team_scores').update({ total_points: newPoints }).eq('team_id', targetTeam)
            setUserPoints((prev) => prev + result.points)
            fetchTeamScores()
          }
        }
      } catch (err) {
        console.error('토벌 점수 반영 중 오류 발생:', err)
      }
    }
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

  const handleWeeding = async () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }

    try {
      const discordId = session.user.user_metadata?.provider_id || session.user.user_metadata?.sub || ''

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('team_id')
        .or(`user_id.eq.${session.user.id},discord_id.eq.${discordId}`)
        .maybeSingle()

      if (!profile || !profile.team_id) {
        alert('소속된 종족(팀)이 없어 제초 수련을 진행할 수 없습니다.\n디스코드 서버에서 먼저 종족 역할을 부여받고 채팅을 남겨주세요!')
        return
      }

      const targetTeam = profile.team_id

      const { data: teamData } = await supabase
        .from('team_scores')
        .select('total_points')
        .eq('team_id', targetTeam)
        .maybeSingle()

      if (!teamData) {
        alert('해당 팀의 점수 데이터를 찾을 수 없습니다.')
        return
      }

      const currentPoints = teamData.total_points || 0
      const newPoints = currentPoints + 2

      const { error: updateError } = await supabase
        .from('team_scores')
        .update({ total_points: newPoints })
        .eq('team_id', targetTeam)

      if (!updateError) {
        setUserPoints((prev) => prev + 2)
        fetchTeamScores()
      }
    } catch (err) {
      console.error('제초 처리 중 오류 발생:', err)
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

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 20px' }}>
      {/* 1. 상단 프로필 & 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img 
            src={RAKKO_MASTER_IMAGE} 
            alt="스승 랏코" 
            style={{ 
              width: '52px', 
              height: '52px', 
              borderRadius: '16px', 
              backgroundColor: '#fef3c7', 
              padding: '4px',
              objectFit: 'cover' 
            }} 
          />
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>랏코와 제자들</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>디스코드 커뮤니티 대시보드</p>
          </div>
        </div>

        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '8px 16px', borderRadius: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <img 
              src={session.user.user_metadata?.avatar_url} 
              alt="avatar" 
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            />
            <span style={{ fontWeight: '600', fontSize: '14px' }}>{session.user.user_metadata?.full_name}</span>
            <button onClick={handleLogout} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <LogOut size={16}/>
            </button>
          </div>
        ) : (
          <button onClick={handleDiscordLogin} className="btn-primary">
            <LogIn size={18}/> 디스코드 로그인
          </button>
        )}
      </header>

      {/* 2. 메인 네비게이션 탭 */}
      <nav style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: activeTab === 'home' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            background: activeTab === 'home' ? '#eff6ff' : '#fff',
            color: activeTab === 'home' ? '#1d4ed8' : '#64748b',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <LayoutDashboard size={18} /> 메인 대시보드
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('community')}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '12px',
            border: activeTab === 'community' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
            background: activeTab === 'community' ? '#eff6ff' : '#fff',
            color: activeTab === 'community' ? '#1d4ed8' : '#64748b',
            fontWeight: '700',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease'
          }}
        >
          <MessageSquare size={18} /> 팀 커뮤니티
        </button>
      </nav>

      {/* ========================================================= */}
      {/* 📄 [PAGE 1] 메인 대시보드 */}
      {/* ========================================================= */}
      {activeTab === 'home' && (
        <>
          {/* 🔮 랏코 스승의 오늘의 운세 위젯 */}
          <section className="card" style={{ background: 'linear-gradient(135deg, #fffbe3 0%, #fef3c7 100%)', borderColor: '#fde68a', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Gift color="#d97706" size={20} /> 🔮 랏코 스승의 오늘의 한마디 & 운세
                </h2>
                <p style={{ margin: 0, color: '#b45309', fontSize: '14px' }}>
                  하루에 한 번 스승 랏코의 수련 지침과 함께 보너스 점수를 획득하세요!
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
                  padding: '10px 16px',
                  borderRadius: '10px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: hasDrawnFortune ? 'default' : 'pointer'
                }}
              >
                {hasDrawnFortune ? '오늘 뽑기 완료' : '운세 뽑기 🥠'}
              </button>
            </div>

            {todayFortune && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #fcd34d', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                  {todayFortune.grade}
                </span>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#78350f', flex: 1 }}>
                  "{todayFortune.quote}"
                </p>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#d97706' }}>
                  +{todayFortune.points} pt 획득
                </span>
              </div>
            )}
          </section>

          {/* 🗡️ 오늘의 토벌 수련 (3초 순발력 미니게임) */}
          <section className="card" style={{ background: '#fef2f2', borderColor: '#fecdd3', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target color="#dc2626" size={20} /> 🗡️ 오늘의 토벌 수련 (1일 1회)
                </h2>
                <p style={{ margin: 0, color: '#b91c1c', fontSize: '14px' }}>
                  몬스터가 나타나면 가장 빠르게 클릭하세요! 순발력에 따라 포인트가 지급됩니다.
                </p>
              </div>

              {subjugationStatus === 'idle' && (
                <button
                  type="button"
                  onClick={handleStartSubjugation}
                  disabled={hasDoneSubjugation}
                  style={{
                    background: hasDoneSubjugation ? '#cbd5e1' : '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: hasDoneSubjugation ? 'default' : 'pointer'
                  }}
                >
                  {hasDoneSubjugation ? '토벌 완료' : '토벌 시작 🗡️'}
                </button>
              )}
            </div>

            {/* 미니게임 진행 대화상자/클릭 영역 */}
            {subjugationStatus === 'waiting' && (
              <div 
                onClick={handleMonsterClick}
                style={{
                  background: '#fee2e2',
                  border: '2px dashed #f87171',
                  padding: '24px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
              >
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#991b1b' }}>
                  👀 기회를 노리는 중... 몬스터가 나타날 때까지 기다리세요! (너무 일찍 누르면 실패)
                </p>
              </div>
            )}

            {subjugationStatus === 'ready' && (
              <div 
                onClick={handleMonsterClick}
                style={{
                  background: '#ef4444',
                  padding: '28px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: '#fff',
                  boxShadow: '0 0 16px rgba(239,68,68,0.5)',
                  animation: 'pulse 0.5s infinite'
                }}
              >
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  👾 몬스터 출현! 지금 바로 클릭하세요!!!
                </p>
              </div>
            )}

            {subjugationStatus === 'finished' && subjugationResult && (
              <div style={{ background: '#fff', padding: '14px 18px', borderRadius: '12px', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '14px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px', background: '#fee2e2', color: '#991b1b' }}>
                    {subjugationResult.grade}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    반응 속도: <b>{subjugationResult.reactionTime} ms</b>
                  </span>
                </div>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#dc2626' }}>
                  +{subjugationResult.points} pt 획득
                </span>
              </div>
            )}
          </section>

          {/* 팀 순위 리더보드 */}
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy color="#f59e0b" size={22} /> 종족별 팀 순위
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: '#f3f4f6', padding: '4px 8px', borderRadius: '6px' }}>
                실시간 자동 집계
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {teams.map((team, index) => (
                <div 
                  key={team.team_id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '14px 18px', 
                    backgroundColor: index === 0 ? '#fafaf9' : '#f8fafc', 
                    borderRadius: '12px',
                    border: '1px solid #f1f5f9'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                      {index + 1}
                    </div>

                    <img 
                      src={TEAM_CONFIG[team.team_id]?.image || RAKKO_MASTER_IMAGE} 
                      alt={team.team_name} 
                      style={{ 
                        width: '36px', 
                        height: '36px', 
                        borderRadius: '50%', 
                        border: '2px solid #e2e8f0',
                        objectFit: 'cover',
                        backgroundColor: '#fff'
                      }} 
                    />

                    <span style={{ fontWeight: '700', fontSize: '15px' }}>{team.team_name}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={14}/> {team.weekly_chats || 0}회
                    </span>
                    <span style={{ fontWeight: '800', color: '#d97706', fontSize: '16px' }}>
                      {(team.total_points || 0).toLocaleString()} <span style={{ fontSize: '12px', fontWeight: '500' }}>pt</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 오늘의 제초 수련 미니게임 */}
          <section className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles color="#16a34a" size={20} /> 🌱 오늘의 제초 수련
                </h2>
                <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>
                  잡초를 뽑아 획득한 포인트는 소속 팀의 총점에 누적됩니다.
                </p>
              </div>
              <button onClick={handleWeeding} className="btn-weed">
                <Flame size={18} /> 잡초 뽑기 (+2 pt)
              </button>
            </div>

            {session && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #a7f3d0', color: '#166534', fontSize: '14px' }}>
                현재 세션 누적 포인트: <b>{userPoints}</b> pt
              </div>
            )}
          </section>
        </>
      )}

      {/* ========================================================= */}
      {/* 📄 [PAGE 2] 팀 커뮤니티 */}
      {/* ========================================================= */}
      {activeTab === 'community' && (
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare color="#3b82f6" size={22} /> 💬 제자 마을 팀 커뮤니티
            </h2>
          </div>

          {/* 팀별 필터 탭 */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '16px' }}>
            <button
              type="button"
              onClick={() => setSelectedTeamFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: 'none',
                background: selectedTeamFilter === 'all' ? '#3b82f6' : '#f1f5f9',
                color: selectedTeamFilter === 'all' ? '#fff' : '#475569',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Users size={14} /> 전체보기
            </button>
            {Object.entries(TEAM_CONFIG).map(([id, info]) => (
              <button
                type="button"
                key={id}
                onClick={() => setSelectedTeamFilter(id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: selectedTeamFilter === id ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                  background: selectedTeamFilter === id ? '#eff6ff' : '#fff',
                  color: selectedTeamFilter === id ? '#1d4ed8' : '#334155',
                  fontWeight: selectedTeamFilter === id ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <img src={info.image} alt={info.name} style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }} />
                {info.name}
              </button>
            ))}
          </div>

          {/* 글 작성 폼 */}
          <form onSubmit={handleCreatePost} style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <select 
                value={postTeam} 
                onChange={(e) => setPostTeam(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff', fontWeight: '600' }}
              >
                {Object.entries(TEAM_CONFIG).map(([id, info]) => (
                  <option key={id} value={id}>[{info.name}] 게시판</option>
                ))}
              </select>

              <select 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}
              >
                <option value="자유">자유</option>
                <option value="수련인증">수련인증</option>
                <option value="질문">질문</option>
              </select>

              <input 
                type="text" 
                placeholder={session ? "제목을 입력하세요" : "로그인 후 글을 쓸 수 있습니다"}
                value={newTitle}
                disabled={!session || isSubmitting}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{ flex: 1, minWidth: '200px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              />
            </div>

            <textarea 
              placeholder={session ? "팀원들과 나누고 싶은 이야기나 인증할 사진을 올려보세요..." : "로그인 후 이야기를 나누어 보세요!"}
              value={newContent}
              disabled={!session || isSubmitting}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
            />

            {imagePreview && (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '12px' }}>
                <img 
                  src={imagePreview} 
                  alt="업로드 미리보기" 
                  style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
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
                    width: '22px',
                    height: '22px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: session ? 'pointer' : 'not-allowed', color: '#475569', fontSize: '14px', background: '#fff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <Upload size={16} color="#3b82f6" />
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
                style={{ padding: '8px 16px', opacity: session && !isSubmitting ? 1 : 0.6 }}
              >
                <Send size={16} /> {isSubmitting ? '업로드 중...' : '글 작성하기'}
              </button>
            </div>
          </form>

          {/* 게시글 목록 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPosts.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>
                해당 커뮤니티에 남겨진 이야기가 없습니다. 첫 번째 글과 사진을 남겨보세요!
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
                    style={{ padding: '16px', borderRadius: '12px', border: '1px solid #edf2f7', background: '#fff' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <img src={teamInfo.image} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%', objectFit: 'cover' }} />
                          {teamInfo.name}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569' }}>
                          {post.category || '자유'}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{post.title}</h3>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* 💬 댓글 버튼 */}
                        <button 
                          type="button"
                          onClick={() => toggleComments(post.id)}
                          style={{ 
                            border: '1px solid #e2e8f0', 
                            background: isCommentsExpanded ? '#eff6ff' : '#f8fafc', 
                            color: isCommentsExpanded ? '#2563eb' : '#64748b', 
                            padding: '4px 10px', 
                            borderRadius: '16px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '13px', 
                            fontWeight: '600'
                          }}
                        >
                          <MessageCircle size={14} /> 
                          {commentCount}
                        </button>

                        {/* 💖 좋아요 버튼 */}
                        <button 
                          type="button"
                          onClick={() => handleLikePost(post.id, post.likes)}
                          style={{ 
                            border: isLiked ? '1px solid #fecdd3' : '1px solid #e2e8f0', 
                            background: isLiked ? '#fff0f3' : '#f8fafc', 
                            color: isLiked ? '#e11d48' : '#64748b', 
                            padding: '4px 10px', 
                            borderRadius: '16px', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            fontSize: '13px', 
                            fontWeight: '600'
                          }}
                        >
                          <Heart size={14} fill={isLiked ? '#e11d48' : 'none'} color={isLiked ? '#e11d48' : '#64748b'} /> 
                          {post.likes || 0}
                        </button>

                        {session && session.user.id === post.user_id && (
                          <button 
                            type="button"
                            onClick={() => handleDeletePost(post.id, post.user_id)}
                            style={{ border: 'none', background: '#fef2f2', color: '#ef4444', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                            title="게시글 삭제"
                          >
                            <Trash2 size={14} /> 삭제
                          </button>
                        )}
                      </div>
                    </div>

                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                      {post.content}
                    </p>

                    {post.image_url && (
                      <div style={{ marginBottom: '12px' }}>
                        <a href={post.image_url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={post.image_url} 
                            alt="게시글 첨부 사진" 
                            style={{ maxWidth: '100%', maxHeight: '360px', borderRadius: '8px', border: '1px solid #e2e8f0', objectFit: 'cover' }} 
                          />
                        </a>
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} /> {post.author_name}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} /> {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>

                    {/* 💬 댓글 영역 */}
                    {isCommentsExpanded && (
                      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #e2e8f0' }}>
                        <form 
                          onSubmit={(e) => handleCreateComment(post.id, e)} 
                          style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}
                        >
                          <input 
                            type="text" 
                            placeholder={session ? "댓글을 남겨보세요..." : "로그인 후 댓글을 입력할 수 있습니다"}
                            disabled={!session}
                            value={commentInputs[post.id] || ''}
                            onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                            style={{ flex: 1, padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                          />
                          <button 
                            type="submit" 
                            disabled={!session}
                            className="btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '13px', opacity: session ? 1 : 0.6 }}
                          >
                            <Send size={13} /> 등록
                          </button>
                        </form>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {postComments.length === 0 ? (
                            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0' }}>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                          ) : (
                            postComments.map((comment) => (
                              <div 
                                key={comment.id} 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px' }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    {comment.avatar_url && (
                                      <img src={comment.avatar_url} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                                    )}
                                    <span style={{ fontWeight: '700', fontSize: '13px', color: '#334155' }}>{comment.author_name}</span>
                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                      {new Date(comment.created_at).toLocaleDateString('ko-KR')}
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                                </div>

                                {session && session.user.id === comment.user_id && (
                                  <button 
                                    type="button"
                                    onClick={() => handleDeleteComment(comment.id, post.id, comment.user_id)}
                                    style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '2px' }}
                                    title="댓글 삭제"
                                  >
                                    <Trash2 size={13} />
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
    </div>
  )
}