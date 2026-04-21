import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  ShieldCheck, Users, Share2, Lightbulb, 
  BookOpen, MessageSquare, HardDrive, Cpu, Network, LayoutDashboard, RefreshCw, ChevronRight
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query, where 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- 請務必在此處填上您的 Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyBy3mpEPQDVe48GNgOCLnlXSFD2eT1jyWs",
  authDomain: "tech-share-system.firebaseapp.com",
  projectId: "tech-share-system",
  storageBucket: "tech-share-system.firebasestorage.app",
  messagingSenderId: "136150031374",
  appId: "1:136150031374:web:8c6131ee29dfa64e2cf05f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'tech-share-multi-session'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState({ manager: [], peer: [] });

  // 1. 在此定義兩位同仁的報告主題
  const sessions = [
    { id: 'session-1', title: 'Steven (SW2C): Google OpenBMC structure and Project sharing' },
    { id: 'session-2', title: 'Rex (SW2A): BIOS Project Experience​' }
  ];
  const [activeSession, setActiveSession] = useState(null);

  // 主管評分標準 (4項)
  const managerCriteria = [
    { id: 'tech_depth', label: '技術深度或Debug思維', icon: <Cpu size={18} />, desc: 'Function介紹是否清楚並深入/Debug過程是否有效率並找出Root Cause。' },
    { id: 'cross_impact', label: '專案細節理解或技術應用', icon: <Network size={18} />, desc: '是否清楚整體專案需求或技術應用面。' },
    { id: 'solution_value', label: '專案實務價值', icon: <HardDrive size={18} />, desc: '解決方法是否能防止未來專案發生同樣錯誤。' },
    { id: 'doc_quality', label: '知識文件完整度', icon: <BookOpen size={18} />, desc: '內容是否足以作為 Knowledge Base 存檔。' }
  ];

  // 同儕評分標準 (4項)
  const peerCriteria = [
    { id: 'understanding', label: '跨部門運作了解度', icon: <Share2 size={18} />, desc: '聽完後我是否更了解其他部門的工作內容。' },
    { id: 'takeaway', label: '知識獲取感', icon: <Lightbulb size={18} />, desc: '對我未來開發是否有實質啟發。' },
    { id: 'clarity', label: '表達清晰度', icon: <MessageSquare size={18} />, desc: '能否將複雜底層術語講得淺顯易懂。' },
    { id: 'interactivity', label: '問答互動表現', icon: <Users size={18} />, desc: '對現場提問的掌握度。' }
  ];

  // Firebase 認證與重試
  const initAuth = useCallback(async (retryCount = 0) => {
    try {
      setAuthError(null);
      await signInAnonymously(auth);
    } catch (error) {
      if (retryCount < 3) setTimeout(() => initAuth(retryCount + 1), 2000);
      else setAuthError("網路連線失敗，請檢查網路狀態。");
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') setIsAdmin(true);
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, [initAuth]);

  // 根據選擇的主題載入對應數據
  useEffect(() => {
    if (!user || !activeSession) return;
    const managerCol = collection(db, 'artifacts', appId, 'public', 'data', 'manager_ratings');
    const peerCol = collection(db, 'artifacts', appId, 'public', 'data', 'peer_ratings');

    const unsubM = onSnapshot(query(managerCol, where("shareId", "==", activeSession.id)), (snap) => {
      setStats(prev => ({ ...prev, manager: snap.docs.map(d => d.data()) }));
    });
    const unsubP = onSnapshot(query(peerCol, where("shareId", "==", activeSession.id)), (snap) => {
      setStats(prev => ({ ...prev, peer: snap.docs.map(d => d.data()) }));
    });
    return () => { unsubM(); unsubP(); };
  }, [user, activeSession]);

  const [managerForm, setManagerForm] = useState({ managerName: '', tech_depth: 5, cross_impact: 5, solution_value: 5, doc_quality: 5, comments: '' });
  const [peerForm, setPeerForm] = useState({ understanding: 5, takeaway: 5, clarity: 5, interactivity: 5, comments: '' });

  const handleRatingSubmit = async (type) => {
    if (!user || !activeSession) return;
    
    setLoading(true);
    try {
      const colName = type === 'manager' ? 'manager_ratings' : 'peer_ratings';
      const storageKey = `voted_${type}_${activeSession.id}`;
      const existingDocId = localStorage.getItem(storageKey);
  
      const data = type === 'manager' ? managerForm : peerForm;
      const payload = { 
        ...data, 
        timestamp: new Date().toISOString(), 
        shareId: activeSession.id 
      };
  
      if (type === 'manager' && existingDocId) {
        // 如果是主管且已經投過，則更新該筆資料 (Update)
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', colName, existingDocId);
        await updateDoc(docRef, payload);
        setMessage({ type: 'success', text: '評分已更新！' });
      } else {
        // 第一次投球或同儕投球 (Add)
        if (type === 'peer' && existingDocId) {
          alert("同儕評分每場限投一次喔！");
          setLoading(false);
          return;
        }
        const targetCol = collection(db, 'artifacts', appId, 'public', 'data', colName);
        const docRef = await addDoc(targetCol, payload);
        localStorage.setItem(storageKey, docRef.id); // 記住這筆 ID
        setMessage({ type: 'success', text: '評分送出成功！' });
      }
  
      setTimeout(() => { setView('home'); setActiveSession(null); setMessage(null); }, 2000);
    } catch (e) {
      setMessage({ type: 'error', text: '連線失敗，請重試。' });
    } finally {
      setLoading(false);
    }
  };

  const getAverage = (data, field) => {
    if (!data.length) return 0;
    const valid = data.filter(d => d[field] !== undefined);
    return valid.length ? (valid.reduce((a, b) => a + (Number(b[field]) || 0), 0) / valid.length).toFixed(1) : 0;
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>軟體部門 Tech-Share 評分系統</h1>
      </header>

      {authError && <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: '#fff1f2', color: '#9f1239', marginBottom: '20px' }}>{authError}</div>}
      {message && <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#166534', textAlign: 'center', marginBottom: '20px' }}>{message.text}</div>}

      {/* 首頁：場次選擇 */}
      {view === 'home' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <h3 style={{ fontWeight: '800', borderLeft: '5px solid #2563eb', paddingLeft: '15px', margin: '10px 0' }}>請選擇今日報告場次進行評分：</h3>
          {sessions.map((s) => (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ fontWeight: '800', marginBottom: '20px', fontSize: '18px', color: '#1e293b' }}>{s.title}</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setActiveSession(s); setView('peer'); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '2px solid #4f46e5', color: '#4f46e5', background: 'white', cursor: 'pointer', fontWeight: 'bold' }}>同儕評分</button>
                {isAdmin && <button onClick={() => { setActiveSession(s); setView('manager'); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>主管評分</button>}
                {isAdmin && <button onClick={() => { setActiveSession(s); setView('dashboard'); }} style={{ padding: '14px', borderRadius: '12px', background: '#0f172a', color: 'white', border: 'none', cursor: 'pointer' }}><LayoutDashboard size={20}/></button>}
              </div>
            </div>
          ))}
          <footer style={{ textAlign: 'center', marginTop: '40px', color: '#94a3b8', fontSize: '13px' }}>
            © 軟體部門 Tech-Share 系統 | 請根據當下報告內容進入對應場次
          </footer>
        </div>
      )}

      {/* 評分表介面 */}
      {(view === 'manager' || view === 'peer') && (
        <div style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
          <button onClick={() => { setView('home'); setActiveSession(null); }} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>← 返回場次列表</button>
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', marginBottom: '25px', borderLeft: '4px solid #2563eb' }}>
            <div style={{ fontSize: '13px', color: '#64748b' }}>正在為以下項目評分：</div>
            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{activeSession?.title}</div>
          </div>
          
          {view === 'manager' && (
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>主管姓名 (實名)</label>
              <input type="text" placeholder="請輸入姓名..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', boxSizing: 'border-box' }} value={managerForm.managerName} onChange={(e) => setManagerForm({...managerForm, managerName: e.target.value})} />
            </div>
          )}

          {(view === 'manager' ? managerCriteria : peerCriteria).map(c => (
            <div key={c.id} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>{c.icon} {c.label}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '26px', marginBottom: '8px' }}>{c.desc}</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: '26px' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => view === 'manager' ? setManagerForm({...managerForm, [c.id]: n}) : setPeerForm({...peerForm, [c.id]: n})} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: (view === 'manager' ? managerForm[c.id] : peerForm[c.id]) === n ? '#2563eb' : '#f1f5f9', color: (view === 'manager' ? managerForm[c.id] : peerForm[c.id]) === n ? 'white' : '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>{n}</button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>具體評論與建議</label>
            <textarea style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', minHeight: '100px', boxSizing: 'border-box' }} placeholder="請留下具體的回饋..." value={view === 'manager' ? managerForm.comments : peerForm.comments} onChange={(e) => view === 'manager' ? setManagerForm({...managerForm, comments: e.target.value}) : setPeerForm({...peerForm, comments: e.target.value})} />
          </div>

          <button onClick={() => handleRatingSubmit(view)} disabled={loading} style={{ width: '100%', marginTop: '30px', padding: '18px', borderRadius: '15px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' }}>{loading ? '送出中...' : '提交評分結果'}</button>
        </div>
      )}

      {/* 數據看板 */}
      {view === 'dashboard' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
          <button onClick={() => { setView('home'); setActiveSession(null); }} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>← 返回列表</button>
          <h3 style={{ marginBottom: '20px' }}>{activeSession?.title} 數據統計</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            <div style={{ height: '380px', background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ textAlign: 'center', fontSize: '14px' }}>主管平均視角</h4>
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={managerCriteria.map(c => ({ subject: c.label.substring(0,4), A: getAverage(stats.manager, c.id) }))}>
                  <PolarGrid /><PolarAngleAxis dataKey="subject" fontSize={11}/><Radar dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ height: '380px', background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ textAlign: 'center', fontSize: '14px' }}>同儕回饋統計</h4>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={peerCriteria.map(c => ({ name: c.label.substring(0,3), score: getAverage(stats.peer, c.id) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" fontSize={11}/><YAxis domain={[0, 10]} /><Tooltip /><Bar dataKey="score" fill="#4f46e5" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ marginTop: '30px' }}>
            <h4 style={{ marginBottom: '15px' }}>評論彙整 ({stats.manager.length + stats.peer.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[...stats.manager, ...stats.peer].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map((m, i) => (
                <div key={i} style={{ padding: '15px', background: m.managerName ? '#eff6ff' : '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px' }}>
                    <strong>{m.managerName ? `⚖️ 主管: ${m.managerName}` : '💬 匿名同儕'}</strong>
                    <span style={{ color: '#94a3b8' }}>{new Date(m.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: '14px' }}>{m.comments || '(無留言)'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;