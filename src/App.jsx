import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { Trophy, LogIn, LogOut, Sparkles, MessageSquare, ShieldCheck, Flame, Send, Heart, User, Clock } from 'lucide-react'

export default function App() {
  const [session, setSession] = useState(null)
  const [teams, setTeams] = useState([])
  const [userPoints, setUserPoints] = useState(0)

  // 수다 게시판 상태
  const [posts, setPosts] = useState([])
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState('자유')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    fetchTeamScores()
    fetchPosts()
    return () => subscription.unsubscribe()
  }, [])

  // 1. 팀 순위 불러오기
  const fetchTeamScores = async () => {
    const { data, error } = await supabase
      .from('team_scores')
      .select('*')
      .order('total_points', { ascending: false })
    if (!error && data) setTeams(data)
  }

  // 2. 게시글 목록 불러오기
  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error && data) setPosts(data)
  }

  // 3. 게시글 작성하기
 // src/App.jsx 내 handleCreatePost 함수 수정
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
  const authorName = session.user.user_metadata.full_name || session.user.user_metadata.name || '무명 제자'
  const userId = session.user.id
  const avatarUrl = session.user.user_metadata.avatar_url || ''

  // 1. 유저 프로필 데이터 먼저 생성/갱신 (외래키 오류 방지)
  await supabase.from('user_profiles').upsert({
    user_id: userId,
    username: authorName,
    avatar_url: avatarUrl,
  })

  // 2. 게시글 작성 진행
  const { error } = await supabase.from('posts').insert([
    {
      user_id: userId,
      author_name: authorName,
      team_id: 'chiikawa',
      category: newCategory,
      title: newTitle.trim(),
      content: newContent.trim(),
    }
  ])

  setIsSubmitting(false)

  if (error) {
    alert('글 작성 중 오류가 발생했습니다: ' + error.message)
  } else {
    setNewTitle('')
    setNewContent('')
    fetchPosts()
  }
}

    setIsSubmitting(true)
    const authorName = session.user.user_metadata.full_name || session.user.user_metadata.name || '무명 제자'
    const userId = session.user.id

    const { error } = await supabase.from('posts').insert([
      {
        user_id: userId,
        author_name: authorName,
        team_id: 'chiikawa',
        category: newCategory,
        title: newTitle.trim(),
        content: newContent.trim(),
      }
    ])

    setIsSubmitting(false)

    if (error) {
      alert('글 작성 중 오류가 발생했습니다: ' + error.message)
    } else {
      setNewTitle('')
      setNewContent('')
      fetchPosts()
    }
  }

  // 4. 게시글 좋아요
  const handleLikePost = async (postId, currentLikes) => {
    const { error } = await supabase
      .from('posts')
      .update({ likes: (currentLikes || 0) + 1 })
      .eq('id', postId)

    if (!error) {
      fetchPosts()
    }
  }

  const handleDiscordLogin = async () => {
  await supabase.auth.signInWithOAuth({
    provider: 'discord',
    options: {
      redirectTo: window.location.origin, // 접속 중인 주소(Vercel 또는 localhost)로 자동 지정
    },
  })
}

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleWeeding = async () => {
    if (!session) {
      alert('로그인이 필요한 수련입니다!')
      return
    }
    setUserPoints((prev) => prev + 10)
  }

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', padding: '32px 20px' }}>
      {/* 1. 상단 프로필 & 헤더 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '36px', background: '#fef3c7', padding: '8px 12px', borderRadius: '16px' }}>🦦</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>랏코와 제자들</h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>디스코드 커뮤니티 대시보드</p>
          </div>
        </div>

        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', padding: '8px 16px', borderRadius: '30px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <img 
              src={session.user.user_metadata.avatar_url} 
              alt="avatar" 
              style={{ width: '32px', height: '32px', borderRadius: '50%' }}
            />
            <span style={{ fontWeight: '600', fontSize: '14px' }}>{session.user.user_metadata.full_name}</span>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div className={`rank-badge ${index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other'}`}>
                  {index + 1}
                </div>
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
            <Flame size={18} /> 잡초 뽑기 (+10 pt)
          </button>
        </div>

        {session && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #a7f3d0', color: '#166534', fontSize: '14px' }}>
            현재 세션 누적 포인트: <b>{userPoints}</b> pt
          </div>
        )}
      </section>

      {/* 5. 제자 마을 수다 게시판 */}
      <section className="card">
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare color="#3b82f6" size={22} /> 💬 제자 마을 수다 게시판
        </h2>

        {/* 글 작성 폼 */}
        <form onSubmit={handleCreatePost} style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
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
              style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            />
          </div>
          <textarea 
            placeholder={session ? "제자들과 나누고 싶은 이야기를 적어보세요..." : "로그인 후 이야기를 나누어 보세요!"}
            value={newContent}
            disabled={!session || isSubmitting}
            onChange={(e) => setNewContent(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              disabled={!session || isSubmitting} 
              className="btn-primary" 
              style={{ padding: '8px 16px', opacity: session ? 1 : 0.6 }}
            >
              <Send size={16} /> 글 작성하기
            </button>
          </div>
        </form>

        {/* 게시글 목록 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
              아직 남겨진 이야기가 없습니다. 첫 번째 글을 작성해 보세요!
            </p>
          ) : (
            posts.map((post) => (
              <div 
                key={post.id} 
                style={{ padding: '16px', borderRadius: '12px', border: '1px solid #edf2f7', background: '#fff' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: '#e0f2fe', color: '#0369a1' }}>
                      {post.category || '자유'}
                    </span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{post.title}</h3>
                  </div>
                  <button 
                    onClick={() => handleLikePost(post.id, post.likes)}
                    style={{ border: 'none', background: '#fff0f3', color: '#e11d48', padding: '4px 10px', borderRadius: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                  >
                    <Heart size={14} fill="#e11d48" /> {post.likes || 0}
                  </button>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#334155', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                  {post.content}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <User size={13} /> {post.author_name}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {new Date(post.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}