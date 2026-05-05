import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Users, Share2, Lightbulb, 
  BookOpen, MessageSquare, HardDrive, Cpu, Network
} from 'lucide-react'; // 移除 LayoutDashboard 與 Trophy
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
  const [message, setMessage] = useState(null);
  const [rawStats, setRawStats] = useState({ manager: [], peer: [] });

  const sessions = useMemo(() => [
    { id: 'session-0', title: 'Demo: 歷史報告範例' },
    { id: 'session-1', title: 'Steven (SW2C): Google OpenBMC structure and Project sharing' },
    { id: 'session-2', title: 'Rex (SW2A): BIOS Project Experience​' }
  ], []);

  const visibleSessions = useMemo(() => sessions.slice(-2), [sessions]);
  const [activeSession, setActiveSession] = useState(null);

  const managerCriteria = useMemo(() => [
    { id: 'tech_depth', label: '技術深度或Debug思維', icon: <Cpu size={18} /> },
    { id: 'cross_impact', label: '專案細節理解或技術應用', icon: <Network size={18} /> },
    { id: 'solution_value', label: '專案實務價值', icon: <HardDrive size={18} /> },
    { id: 'doc_quality', label: '知識文件完整度', icon: <BookOpen size={18} /> }
  ], []);

  const peerCriteria = useMemo(() => [
    { id: 'understanding', label: '跨部門運作了解度', icon: <Share2 size={18} /> },
    { id: 'takeaway', label: '知識獲取感', icon: <Lightbulb size={18} /> },
    { id: 'clarity', label: '表達清晰度', icon: <MessageSquare size={18} /> },
    { id: 'interactivity', label: '問答互動表現', icon: <Users size={18} /> }
  ], []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') setIsAdmin(true);
    signInAnonymously(auth);
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const managerCol = collection(db, 'artifacts', appId, 'public', 'data', 'manager_ratings');
    const peerCol = collection(db, 'artifacts', appId, 'public', 'data', 'peer_ratings');

    const unsubM = onSnapshot(managerCol, (snap) => {
      setRawStats(prev => ({ ...prev, manager: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    const unsubP = onSnapshot(peerCol, (snap) => {
      setRawStats(prev => ({ ...prev, peer: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
    return () => { unsubM(); unsubP(); };
  }, [user]);

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
      const payload = { ...data, timestamp: new Date().toISOString(), shareId: activeSession.id, userId: user.uid };
  
      if (type === 'manager' && existingDocId) {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', colName, existingDocId);
        await updateDoc(docRef, payload);
        setMessage({ type: 'success', text: '評分已更新！' });
      } else {
        const targetCol = collection(db, 'artifacts', appId, 'public', 'data', colName);
        const docRef = await addDoc(targetCol, payload);
        localStorage.setItem(storageKey, docRef.id);
        setMessage({ type: 'success', text: '評分送出成功！' });
      }
      setTimeout(() => { setView('home'); setActiveSession(null); setMessage(null); }, 2000);
    } catch (e) {
      setMessage({ type: 'error', text: '連線失敗。' });
    } finally { setLoading(false); }
  };

  const getSessionAvg = (sId, type) => {
    const data = rawStats[type].filter(d => d.shareId === sId);
    if (!data.length) return 0;
    const criteria = type === 'manager' ? managerCriteria : peerCriteria;
    let sum = 0;
    data.forEach(d => criteria.forEach(c => sum += (Number(d[c.id]) || 0)));
    return (sum / (data.length * criteria.length)).toFixed(1);
  };

  const leaderboardData = useMemo(() => {
    return sessions.map(s => {
      const mScore = Number(getSessionAvg(s.id, 'manager'));
      const pScore = Number(getSessionAvg(s.id, 'peer'));
      return {
        name: s.title.split(':')[0],
        fullName: s.title,
        '主管評分': mScore,
        '同儕評分': pScore,
        '綜合總分': ((mScore + pScore) / 2).toFixed(1)
      };
    }).sort((a, b) => b['綜合總分'] - a['綜合總分']);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawStats, sessions]);

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '900' }}>軟體部門 Tech-Share 評分系統</h1>
      </header>

      {message && <div style={{ padding: '15px', borderRadius: '10px', backgroundColor: '#dcfce7', textAlign: 'center', marginBottom: '20px' }}>{message.text}</div>}

      {view === 'home' && (
        <div style={{ display: 'grid', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: '800' }}>本週報告場次：</h3>
            {isAdmin && <button onClick={() => setView('dashboard')} style={{ padding: '8px 15px', borderRadius: '10px', background: '#0f172a', color: 'white', border: 'none', cursor: 'pointer' }}>總排行榜</button>}
          </div>
          {visibleSessions.map((s) => (
            <div key={s.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px' }}>
              <div style={{ fontWeight: '800', marginBottom: '20px' }}>{s.title}</div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => { setActiveSession(s); setView('peer'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '2px solid #4f46e5', color: '#4f46e5', background: 'white' }}>同儕評分</button>
                {isAdmin && <button onClick={() => { setActiveSession(s); setView('manager'); }} style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none' }}>主管評分</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {(view === 'manager' || view === 'peer') && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #f1f5f9' }}>
          <button onClick={() => setView('home')} style={{ marginBottom: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>← 返回</button>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px' }}>正在評分：</div>
            <div style={{ fontWeight: 'bold' }}>{activeSession?.title}</div>
          </div>
          {view === 'manager' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>主管姓名</label>
              <input type="text" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }} value={managerForm.managerName} onChange={(e) => setManagerForm({...managerForm, managerName: e.target.value})} />
            </div>
          )}
          {(view === 'manager' ? managerCriteria : peerCriteria).map(c => (
            <div key={c.id} style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{c.label}</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button key={n} onClick={() => view === 'manager' ? setManagerForm({...managerForm, [c.id]: n}) : setPeerForm({...peerForm, [c.id]: n})} 
                    style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: (view === 'manager' ? managerForm[c.id] : peerForm[c.id]) === n ? '#2563eb' : '#f1f5f9', color: (view === 'manager' ? managerForm[c.id] : peerForm[c.id]) === n ? 'white' : '#64748b', cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
          ))}
          <textarea style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', minHeight: '80px' }} placeholder="回饋建議..." value={view === 'manager' ? managerForm.comments : peerForm.comments} onChange={(e) => view === 'manager' ? setManagerForm({...managerForm, comments: e.target.value}) : setPeerForm({...peerForm, comments: e.target.value})} />
          <button onClick={() => handleRatingSubmit(view)} disabled={loading} style={{ width: '100%', marginTop: '15px', padding: '15px', borderRadius: '10px', background: '#2563eb', color: 'white', border: 'none', fontWeight: 'bold' }}>{loading ? '提交中...' : '提交評分'}</button>
        </div>
      )}

      {view === 'dashboard' && (
        <div style={{ background: 'white', padding: '20px', borderRadius: '20px' }}>
          <button onClick={() => setView('home')} style={{ marginBottom: '15px', background: 'none', border: 'none', cursor: 'pointer' }}>← 返回</button>
          <h2 style={{ marginBottom: '20px' }}>🏆 總排行榜</h2>
          <div style={{ height: '300px', marginBottom: '20px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leaderboardData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="主管評分" fill="#2563eb" />
                <Bar dataKey="同儕評分" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>排名</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>姓名</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>總分</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>{i + 1}</td>
                  <td style={{ padding: '10px' }}>{row.fullName}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{row.綜合總分}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default App;