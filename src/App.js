import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  ShieldCheck, Users, Trophy, Star, MessageSquare, ChevronLeft, LayoutDashboard, Send, Share2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// Firebase 初始化與環境變數處理
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tech-share-v3';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  
  // 場次清單：後續只需在此新增物件即可
  const sessions = [
    { id: '20240421_A', title: '報告人 A: PCIe Switch 異常排除' },
    { id: '20240421_B', title: '報告人 B: BIOS Secure Boot 實作' },
    { id: '20240505_C', title: '報告人 C: NVMe SSD 效能調優' }
  ];
  
  const [activeSession, setActiveSession] = useState(null);
  const [allData, setAllData] = useState({ manager: [], peer: [] });

  // 評分標準
  const managerCriteria = [
    { id: 'tech_depth', label: '技術深度' },
    { id: 'cross_impact', label: '跨部門協作' },
    { id: 'solution_value', label: '實務價值' },
    { id: 'doc_quality', label: '文件完整度' }
  ];

  const peerCriteria = [
    { id: 'understanding', label: '理解度' },
    { id: 'takeaway', label: '啟發感' },
    { id: 'clarity', label: '清晰度' },
    { id: 'interactivity', label: '互動性' }
  ];

  // 表單狀態
  const [managerForm, setManagerForm] = useState({ managerName: '', tech_depth: 5, cross_impact: 5, solution_value: 5, doc_quality: 5, comments: '' });
  const [peerForm, setPeerForm] = useState({ understanding: 5, takeaway: 5, clarity: 5, interactivity: 5, comments: '' });

  useEffect(() => {
    // 身份檢查
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') setIsAdmin(true);

    // Firebase 認證流程 (Rule 3)
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    // 監聽數據 (Rule 1 & 2)
    const qM = collection(db, 'artifacts', appId, 'public', 'data', 'manager_ratings');
    const qP = collection(db, 'artifacts', appId, 'public', 'data', 'peer_ratings');

    const unsubM = onSnapshot(qM, (snap) => {
      setAllData(prev => ({ ...prev, manager: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    }, (err) => console.error("Firestore Manager Query Error:", err));

    const unsubP = onSnapshot(qP, (snap) => {
      setAllData(prev => ({ ...prev, peer: snap.docs.map(d => ({id: d.id, ...d.data()})) }));
    }, (err) => console.error("Firestore Peer Query Error:", err));

    return () => { unsubM(); unsubP(); };
  }, [user]);

  // 提交邏輯
  const handleRatingSubmit = async (type) => {
    if (!user || !activeSession) return;
    setLoading(true);
    
    try {
      const colName = type === 'manager' ? 'manager_ratings' : 'peer_ratings';
      const storageKey = `voted_${type}_${activeSession.id}`;
      const existingDocId = localStorage.getItem(storageKey);
      
      const payload = {
        ...(type === 'manager' ? managerForm : peerForm),
        shareId: activeSession.id,
        userId: user.uid,
        timestamp: new Date().toISOString()
      };

      if (type === 'manager' && existingDocId) {
        // 更新制 (主管修改評語)
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', colName, existingDocId);
        await updateDoc(docRef, payload);
      } else {
        // 新增制
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
        const docRef = await addDoc(colRef, payload);
        localStorage.setItem(storageKey, docRef.id);
      }
      
      setMessage({ type: 'success', text: '提交成功！' });
      setTimeout(() => { setView('home'); setMessage(null); setActiveSession(null); }, 1500);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: '提交失敗，請檢查網路。' });
    } finally { 
      setLoading(false); 
    }
  };

  const getAvgScore = (sId, type) => {
    const data = allData[type].filter(d => d.shareId === sId);
    if (!data.length) return 0;
    const criteria = type === 'manager' ? managerCriteria : peerCriteria;
    let total = 0;
    data.forEach(d => criteria.forEach(c => total += (Number(d[c.id]) || 0)));
    return (total / (data.length * criteria.length)).toFixed(1);
  };

  const RatingField = ({ label, value, onChange }) => (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        <span className="text-sm font-bold text-blue-600">{value} 分</span>
      </div>
      <input 
        type="range" min="1" max="10" value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-2xl mx-auto">
        
        {message && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg text-white font-bold ${message.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
            {message.text}
          </div>
        )}

        {view === 'home' && (
          <div className="space-y-6">
            <header className="text-center py-8">
              <div className="inline-block p-3 bg-blue-100 rounded-2xl mb-4 text-blue-600">
                <Share2 size={32} />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">軟體部 Tech-Share 評分系統</h1>
              <p className="text-slate-500">技術交流，共同進步</p>
            </header>

            {isAdmin && (
              <button 
                onClick={() => setView('dashboard')}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-md"
              >
                <LayoutDashboard size={20} /> 查看場次對比看板
              </button>
            )}

            <div className="grid gap-4">
              {sessions.map(s => (
                <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800">{s.title}</h3>
                    <div className="flex gap-3 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Users size={12}/> {allData.peer.filter(d => d.shareId === s.id).length} 份回饋</span>
                      {isAdmin && <span className="flex items-center gap-1 text-blue-500"><ShieldCheck size={12}/> 管理員模式</span>}
                    </div>
                  </div>
                  <button 
                    onClick={() => { setActiveSession(s); setView(isAdmin ? 'manager' : 'peer'); }}
                    className="ml-4 px-5 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
                  >
                    進入評分
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(view === 'manager' || view === 'peer') && activeSession && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
            <button onClick={() => setView('home')} className="flex items-center text-slate-400 mb-6 hover:text-slate-600">
              <ChevronLeft size={20} /> 返回首頁
            </button>
            
            <div className="mb-8">
              <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full">
                {view === 'manager' ? '主管評分模式' : '同儕評分模式'}
              </span>
              <h2 className="text-xl font-bold mt-2">{activeSession.title}</h2>
            </div>

            <div className="space-y-6">
              {view === 'manager' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-700 mb-2">主管姓名</label>
                  <input 
                    type="text" 
                    value={managerForm.managerName}
                    onChange={(e) => setManagerForm({...managerForm, managerName: e.target.value})}
                    placeholder="請輸入您的姓名"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              )}

              {(view === 'manager' ? managerCriteria : peerCriteria).map(c => (
                <RatingField 
                  key={c.id} 
                  label={c.label} 
                  value={view === 'manager' ? managerForm[c.id] : peerForm[c.id]} 
                  onChange={(val) => {
                    if (view === 'manager') setManagerForm({...managerForm, [c.id]: val});
                    else setPeerForm({...peerForm, [c.id]: val});
                  }}
                />
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">具體評語 / 建議</label>
                <textarea 
                  rows="4"
                  value={view === 'manager' ? managerForm.comments : peerForm.comments}
                  onChange={(e) => {
                    if (view === 'manager') setManagerForm({...managerForm, comments: e.target.value});
                    else setPeerForm({...peerForm, comments: e.target.value});
                  }}
                  placeholder="寫下您的看法..."
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <button 
                onClick={() => handleRatingSubmit(view)}
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200"
              >
                {loading ? '送出中...' : <><Send size={18} /> 提交評分</>}
              </button>
            </div>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <button onClick={() => setView('home')} className="flex items-center text-slate-400 mb-6">
              <ChevronLeft size={20} /> 返回
            </button>
            
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Trophy size={24}/></div>
              <h2 className="text-xl font-bold">報告人綜合表現對比</h2>
            </div>

            <div className="h-80 w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessions.map(s => ({
                  name: s.title.split(':')[0].replace('報告人 ', ''),
                  '主管': Number(getAvgScore(s.id, 'manager')),
                  '同儕': Number(getAvgScore(s.id, 'peer'))
                }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                  <Legend iconType="circle" />
                  <Bar dataKey="主管" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={30} />
                  <Bar dataKey="同儕" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 flex items-center gap-2"><MessageSquare size={18}/> 各場次詳細評語</h4>
              {sessions.map(s => (
                <div key={s.id} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 p-4 font-bold text-sm text-slate-700 border-bottom border-slate-100">
                    {s.title}
                  </div>
                  <div className="p-4 space-y-3 max-h-40 overflow-y-auto">
                    {allData.manager.filter(d => d.shareId === s.id).map((m, i) => (
                      <div key={i} className="text-sm bg-blue-50 p-3 rounded-xl text-blue-800">
                        <span className="font-bold">主管 ({m.managerName || '未知'}):</span> {m.comments || '(無評語)'}
                      </div>
                    ))}
                    {allData.peer.filter(d => d.shareId === s.id).map((p, i) => (
                      <div key={i} className="text-sm text-slate-600 border-l-4 border-emerald-200 pl-3 py-1">
                        {p.comments || '(無評語)'}
                      </div>
                    ))}
                    {allData.peer.filter(d => d.shareId === s.id).length === 0 && allData.manager.filter(d => d.shareId === s.id).length === 0 && (
                      <div className="text-sm text-slate-400 italic">目前尚無評語</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;