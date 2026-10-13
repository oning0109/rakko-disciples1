import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Trophy, LogIn, LogOut, Sparkles, MessageSquare, ShieldCheck, Flame, Send, Heart, User, Clock, Trash2, X, Users, Upload } from 'lucide-react'

// 상단 헤더 및 랏코 대표 이미지 URL
const RAKKO_MASTER_IMAGE = 'https://i.namu.wiki/i/hjmKzkBU2dSFzcMGW-2FGuhLw2KJsRh0QICaMPUWpUhDKfNNewH-PNO4_jdir725sYrgFJd4vykBGsk5FQ_UJA.webp'

// 종족(팀) ID별 대표 캐릭터 및 이름 매핑 (랏코 포함)
const TEAM_CONFIG = {
  rakko: { name: '랏코', image: RAKKO_MASTER_IMAGE },
  chiikawa: { name: '치이카와', image: 'https://i.namu.wiki/i/dB_CPoscQ6UKTy-0ogw-ntKAX78MU_gr5T3eSIbDEOF4ec0aTaJKbXkIzN-Cod1Sh1NIqIdOT1eXavMKvJ6tcQ.webp' },
  hachiware: { name: '하치와레', image: 'https://i.namu.wiki/i/mqiv0Rb5tbt2C3cCkJCMV_NCeX7YCFfXpYUIebD5_gyietmJewBWlY7uBnyWCHP92ZNY-uIJtNhpuKbyAP40HA.webp' },
  usagi: { name: '우사기', image: 'https://i.namu.wiki/i/PJL_NmmYcz0IvJbqzwprwPbDN_X-bdmBEMAvlc2XZrxUu0crrWUdNV6eZ4_6cUz4CjXrnl4_xtSLGHvRnAEBBA.webp' },
  momonga: { name: '모몽가', image: 'https://i.namu.wiki/i/m3vvkdjvU71l5ryX3GHeQz-t-39twY_SSmfUZGCnufTadOJBpMQhciMnQen0H8aufzkW8I13kRGBYJyI9UiYxw.webp' },
  kurimanju: { name: '크리만쥬', image: 'https://i.namu.wiki/i/A-umWeRuPvy8wgp0raNVjoDASW6dyP_MTF58AMWMJjUwm2mJQyUwi7NWbuRcWPwZu5PhUgVbJK-Bb0u2A47ccg.webp' },
  shisa: { name: '시사', image: 'https://i.namu.wiki/i/FJNlLvE3p0nZ9m3zif83srjt7y0dCpxPfYB-qENldPpZ7cw3yX4y07oVMT8mLoewnmsv0vQOAXP7W1PRJyc2ow.webp' },
}

export default function App() {
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [userPoints, setUserPoints] = useState(0)

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

  useEffect(() => {
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
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
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
    const { error } = await supabase
      .from('posts')
      .update({ likes: (currentLikes || 0) + 1 })
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
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
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

      {/* 2. 스승 랏코 배너 */}
      <div className="card" style={{ background: 'linear-gradient(135deg, #fffbe3 0%, #fef3c7 100%)', borderColor: '#fde68a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ShieldCheck size={40} color="#d97706" />
          <div>
            <h3 style={{ margin: '0 0 4px 0', color: '#92400e' }}>스승 랏코의 수련장에 오신 것을 환영합니다!</h3>
            <p style={{ margin: 0, color: '#b45309', fontSize: '14px' }}>
              디스코드 채널에서 활발히 소통하고 제초 수련을 통해 소속 팀의 순위를 올려보세요.
            </p>
          </div>
        </div>
      </div>

      {/* 3. 팀 순위 리더보드 */}
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

      {/* 4. 오늘의 제초 수련 미니게임 */}
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

      {/* 5. 팀 커뮤니티 & 수다 게시판 */}
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
                      <button 
                        type="button"
                        onClick={() => handleLikePost(post.id, post.likes)}
                        style={{ border: 'none', background: '#fff0f3', color: '#e11d48', padding: '4px 10px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                      >
                        <Heart size={14} fill="#e11d48" /> {post.likes || 0}
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
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}