import React, { useState, useEffect, useCallback } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  ShieldCheck, Users, Code2, Share2, Lightbulb, 
  BookOpen, MessageSquare, HardDrive, Cpu, Network, LayoutDashboard, RefreshCw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Config (請確保填入您的資訊) ---
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
const appId = 'tech-share-v1'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShare] = useState({ id: '2024-04-14', title: 'PCIe Switch 異常 Link Down 排除與 BMC 監控機制' });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState({ manager: [], peer: [] });

  // 主管評分標準
  const managerCriteria = [
    { id: 'tech_depth', label: '技術深度與除錯思維', icon: <Cpu size={18} />, desc: '是否深入 Spec 找出 Root Cause。' },
    { id: 'cross_impact', label: '跨部門介面協作', icon: <Network size={18} />, desc: '是否清楚定義與 BIOS/BMC/Switch 的影響與協作。' },
    { id: 'solution_value', label: '專案實務價值', icon: <HardDrive size={18} />, desc: '解決方法是否能防止未來專案發生同樣錯誤。' },
    { id: 'doc_quality', label: '知識文件完整度', icon: <BookOpen size={18} />, desc: '內容是否足以作為 Knowledge Base 存檔。' }
  ];

  // 同儕評分標準
  const peerCriteria = [
    { id: 'understanding', label: '跨部門運作了解度', icon: <Share2 size={18} />, desc: '聽完後我是否更了解其他部門的工作內容。' },
    { id: 'takeaway', label: '知識獲取感', icon: <Lightbulb size={18} />, desc: '對我未來開發是否有實質啟發。' },
    { id: 'clarity', label: '表達清晰度', icon: <MessageSquare size={18} />, desc: '能否將複雜底層術語講得淺顯易懂。' },
    { id: 'interactivity', label: '問答互動表現', icon: <Users size={18} />, desc: '對現場提問的掌握度。' }
  ];

  const initAuth = useCallback(async (retryCount = 0) => {
    try {
      setAuthError(null);
      await signInAnonymously(auth);
    } catch (error) {
      if (retryCount < 3) {
        setTimeout(() => initAuth(retryCount + 1), 2000);
      } else {
        setAuthError("網路連線失敗，請檢查網路或 Firebase 設定。");
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') setIsAdmin(true);
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, [initAuth]);

  useEffect(() => {
    if (!user) return;
    const managerCol = collection(db, 'artifacts', appId, 'public', 'data', 'manager_ratings');
    const peerCol = collection(db, 'artifacts', appId, 'public', 'data', 'peer_ratings');

    const unsubM = onSnapshot(query(managerCol), (snap) => {
      setStats(prev => ({ ...prev, manager: snap.docs.map(d => d.data()) }));
    });
    const unsubP = onSnapshot(query(peerCol), (snap) => {
      setStats(prev => ({ ...prev, peer: snap.docs.map(d => d.data()) }));
    });
    return () => { unsubM(); unsubP(); };
  }, [user]);

  const [managerForm, setManagerForm] = useState({ managerName: '', tech_depth: 5, cross_impact: 5, solution_value: 5, doc_quality: 5, comments: '' });
  const [peerForm, setPeerForm] = useState({ understanding: 5, takeaway: 5, clarity: 5, interactivity: 5, comments: '' });

  const handleRatingSubmit = async (type) => {
    if (!user) return;
    if (type === 'peer') {
      if (localStorage.getItem(`voted_${activeShare.id}`)) {
        alert("您已經參與過本次評分囉！");
        return;
      }
    }
    if (type === 'manager' && !managerForm.managerName.trim()) {
      alert("請輸入主管姓名");
      return;
    }

    setLoading(true);
    try {
      const colName = type === 'manager' ? 'manager_ratings' : 'peer_ratings';
      const data = type === 'manager' ? managerForm : peerForm;
      const targetCol = collection(db, 'artifacts', appId, 'public', 'data', colName);
      
      await addDoc(targetCol, { ...data, timestamp: new Date().toISOString(), shareId: activeShare.id });
      if (type === 'peer') localStorage.setItem(`voted_${activeShare.id}`, 'true');
      
      setMessage({ type: 'success', text: '評分送出成功！' });
      setTimeout(() => { setView('home'); setMessage(null); }, 2000);
    } catch (e) {
      setMessage({ type: 'error', text: '送出失敗，請檢查網路狀態。' });
    } finally {
      setLoading(false);
    }
  };

  const getAverage = (data, field) => {
    if (!data || !data.length) return 0;
    const valid = data.filter(d => d[field] !== undefined);
    if (!valid.length) return 0;
    return (valid.reduce((a, b) => a + (Number(b[field]) || 0), 0) / valid.length).toFixed(1);
  };

  const RatingRow = ({ label, icon, desc, value, onChange }) => (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', color: '#334155' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '12px', color: '#64748b', marginLeft: '26px', marginBottom: '8px' }}>{desc}</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: '26px' }}>
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: '32px', height: '32px', borderRadius: '50%', border: 'none',
            backgroundColor: value === n ? '#2563eb' : '#f1f5f9',
            color: value === n ? 'white' : '#64748b',
            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
          }}>{n}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', color: '#1e293b' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>軟體部門 Tech-Share 評分系統</h1>
        <div style={{ background: '#eff6ff', color: '#1d4ed8', padding: '10px 20px', borderRadius: '30px', display: 'inline-block', fontSize: '14px', fontWeight: '600', marginTop: '10px', border: '1px solid #dbeafe' }}>
          {activeShare.title}
        </div>
      </header>

      {authError && <div style={{ padding: '15px', borderRadius: '10px', marginBottom: '20px', backgroundColor: '#fff1f2', color: '#9f1239', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #fda4af' }}>{authError} <button onClick={() => initAuth()} style={{ background: '#be123c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer' }}>重試</button></div>}
      {message && <div style={{ padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center', backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', color: message.type === 'success' ? '#166534' : '#991b1b', border: '1px solid #86efac' }}>{message.text}</div>}

      {view === 'home' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          {isAdmin && (
            <button onClick={() => setView('manager')} style={{ padding: '30px', textAlign: 'left', borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', transition: 'all 0.2s' }}>
              <div style={{ background: '#dbeafe', padding: '15px', borderRadius: '15px' }}><ShieldCheck size={28} color="#2563eb" /></div>
              <div><div style={{ fontWeight: '800', fontSize: '18px' }}>主管評分入口</div><div style={{ color: '#64748b', fontSize: '13px' }}>實名制點評技術架構與實務價值</div></div>
            </button>
          )}
          <button onClick={() => setView('peer')} style={{ padding: '30px', textAlign: 'left', borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: '#e0e7ff', padding: '15px', borderRadius: '15px' }}><Users size={28} color="#4f46e5" /></div>
            <div><div style={{ fontWeight: '800', fontSize: '18px' }}>同儕匿名評分</div><div style={{ color: '#64748b', fontSize: '13px' }}>回饋知識獲取感與表達清晰度</div></div>
          </button>
          {isAdmin && (
            <button onClick={() => setView('dashboard')} style={{ padding: '20px', borderRadius: '15px', background: '#0f172a', color: 'white', cursor: 'pointer', border: 'none', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <LayoutDashboard size={18} /> 查看 Dashboard 數據統計 ({stats.manager.length + stats.peer.length})
            </button>
          )}
        </div>
      )}

      {(view === 'manager' || view === 'peer') && (
        <div style={{ background: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', border: '1px solid #f1f5f9' }}>
          <button onClick={() => setView('home')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>← 返回首頁</button>
          <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '25px' }}>{view === 'manager' ? '主管點評報告 (實名)' : '同儕匿名回饋'}</h2>
          
          {view === 'manager' && (
            <div style={{ marginBottom: '30px', background: '#f8fafc', padding: '20px', borderRadius: '15px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>主管姓名</label>
              <input 
                type="text"
                placeholder="請輸入您的姓名..."
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '16px', boxSizing: 'border-box' }}
                value={managerForm.managerName}
                onChange={(e) => setManagerForm({...managerForm, managerName: e.target.value})}
              />
            </div>
          )}

          {(view === 'manager' ? managerCriteria : peerCriteria).map(c => (
            <RatingRow key={c.id} label={c.label} icon={c.icon} desc={c.desc} 
              value={view === 'manager' ? managerForm[c.id] : peerForm[c.id]} 
              onChange={(v) => view === 'manager' ? setManagerForm({...managerForm, [c.id]: v}) : setPeerForm({...peerForm, [c.id]: v})} 
            />
          ))}

          <div style={{ marginTop: '10px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>詳細建議與評論</label>
            <textarea 
              style={{ width: '100%', padding: '15px', borderRadius: '12px', border: '2px solid #e2e8f0', minHeight: '120px', boxSizing: 'border-box', fontSize: '15px' }}
              placeholder="請留下具體的回饋..."
              value={view === 'manager' ? managerForm.comments : peerForm.comments}
              onChange={(e) => view === 'manager' ? setManagerForm({...managerForm, comments: e.target.value}) : setPeerForm({...peerForm, comments: e.target.value})}
            />
          </div>

          <button onClick={() => handleRatingSubmit(view)} disabled={loading} style={{ 
            width: '100%', marginTop: '30px', padding: '18px', borderRadius: '15px', 
            background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold', 
            cursor: loading ? 'not-allowed' : 'pointer', fontSize: '16px' 
          }}>
            {loading ? '送出中...' : '提交評分結果'}
          </button>
        </div>
      )}

      {view === 'dashboard' && (
        <div style={{ background: 'white', padding: '25px', borderRadius: '24px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <button onClick={() => setView('home')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>← 返回</button>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
            <div style={{ height: '380px', background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ textAlign: 'center', fontSize: '15px', fontWeight: '800' }}>主管平均視角 (雷達圖)</h4>
              <ResponsiveContainer width="100%" height="90%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={managerCriteria.map(c => ({
                  subject: c.label.substring(0,4),
                  A: getAverage(stats.manager, c.id)
                }))}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" fontSize={12} />
                  <Radar name="主管" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ height: '380px', background: '#f8fafc', padding: '15px', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ textAlign: 'center', fontSize: '15px', fontWeight: '800' }}>同儕回饋統計 (長條圖)</h4>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={peerCriteria.map(c => ({
                  name: c.label.substring(0,3),
                  score: getAverage(stats.peer, c.id)
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 10]} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#4f46e5" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ marginTop: '30px' }}>
            <h4 style={{ marginBottom: '15px', fontWeight: '800', borderLeft: '4px solid #2563eb', paddingLeft: '10px' }}>評論彙整</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[...stats.manager, ...stats.peer].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map((m, i) => (
                <div key={i} style={{ padding: '18px', background: m.managerName ? '#eff6ff' : '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
                    <strong style={{ color: m.managerName ? '#1d4ed8' : '#475569' }}>{m.managerName ? `⚖️ 主管：${m.managerName}` : '💬 匿名同儕'}</strong>
                    <span style={{ color: '#94a3b8' }}>{new Date(m.timestamp).toLocaleString()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6' }}>{m.comments || '(無留言)'}</p>
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