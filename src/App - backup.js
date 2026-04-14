import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { 
  ShieldCheck, Users, Code2, Share2, Lightbulb, 
  BookOpen, MessageSquare, HardDrive, Cpu, Network, LayoutDashboard
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, query 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// --- Firebase Configuration ---
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
const appId = 'tech-share-v1'; // 隨便取一個您喜歡的 ID，這會成為資料庫的路徑名

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeShare, setActiveShare] = useState({ id: '2024-05', title: '目前分享：PCIe Switch 異常 Link Down 排除與 BMC 監控機制' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState({ manager: [], peer: [] });

  // 1. 初始化 Auth 與 權限偵測
  useEffect(() => {
    // 檢查 URL 參數是否包含 role=admin
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') {
      setIsAdmin(true);
    }

    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. 數據監聽 (僅 Admin 可見)
  useEffect(() => {
    if (!user || !isAdmin) return;

    const qManager = query(collection(db, 'artifacts', appId, 'public', 'data', 'manager_ratings'));
    const unsubManager = onSnapshot(qManager, (snapshot) => {
      setStats(prev => ({ ...prev, manager: snapshot.docs.map(doc => doc.data()) }));
    });

    const qPeer = query(collection(db, 'artifacts', appId, 'public', 'data', 'peer_ratings'));
    const unsubPeer = onSnapshot(qPeer, (snapshot) => {
      setStats(prev => ({ ...prev, peer: snapshot.docs.map(doc => doc.data()) }));
    });

    return () => { unsubManager(); unsubPeer(); };
  }, [user, isAdmin]);

  // --- 評分標準定義 ---
  const managerCriteria = [
    { id: 'tech_depth', label: '技術深度與除錯思維', icon: <Cpu className="w-5 h-5" />, desc: '是否深入 Spec 找出 Root Cause。' },
    { id: 'cross_impact', label: '跨部門介面協作', icon: <Network className="w-5 h-5" />, desc: '是否清楚定義與 BIOS/BMC/Switch 的影響與協作。' },
    { id: 'solution_value', label: '專案實務價值', icon: <HardDrive className="w-5 h-5" />, desc: '解決方法是否能防止未來專案發生同樣錯誤。' },
    { id: 'doc_quality', label: '知識文件完整度', icon: <BookOpen className="w-5 h-5" />, desc: '內容是否足以作為 Knowledge Base 存檔。' }
  ];

  const peerCriteria = [
    { id: 'understanding', label: '跨部門運作了解度', icon: <Share2 className="w-5 h-5" />, desc: '聽完後我是否更了解其他部門的工作內容。' },
    { id: 'takeaway', label: '知識獲取感', icon: <Lightbulb className="w-5 h-5" />, desc: '對我未來開發是否有實質啟發。' },
    { id: 'clarity', label: '表達清晰度', icon: <MessageSquare className="w-5 h-5" />, desc: '能否將複雜底層術語講得淺顯易懂。' },
    { id: 'interactivity', label: '問答互動表現', icon: <Users className="w-5 h-5" />, desc: '對現場提問的掌握度。' }
  ];

  const [managerForm, setManagerForm] = useState({ tech_depth: 5, cross_impact: 5, solution_value: 5, doc_quality: 5, comments: '' });
  const [peerForm, setPeerForm] = useState({ understanding: 5, takeaway: 5, clarity: 5, interactivity: 5, comments: '' });

  const handleRatingSubmit = async (type) => {
    // 防止重複提交
    const hasVoted = localStorage.getItem(`voted_${activeShare.id}`);
    if (hasVoted && type === 'peer') {
      alert("您已經參與過本次評分囉！");
      return;
    }
    if (!user) return;
    setLoading(true);
    try {
      const collectionName = type === 'manager' ? 'manager_ratings' : 'peer_ratings';
      const data = type === 'manager' ? managerForm : peerForm;
      const payload = {
        ...data,
        timestamp: new Date().toISOString(),
        shareId: activeShare.id,
        userId: type === 'manager' ? user.uid : 'anonymous'
      };
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', collectionName), payload);
      setMessage({ type: 'success', text: `感謝！評分已送出。` });
      setTimeout(() => { setView('home'); setMessage(null); }, 2000);
    } catch (error) {
      setMessage({ type: 'error', text: '傳送失敗。' });
    } finally {
      setLoading(false);
    }
    // 送出成功後紀錄
    if (type === 'peer') {
      localStorage.setItem(`voted_${activeShare.id}`, 'true');
    }
  };

  const RatingScale = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
            value === n ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );

  // 計算 Dashboard 平均分
  const getAverage = (data, field) => {
    if (!data.length) return 0;
    const sum = data.reduce((acc, curr) => acc + (curr[field] || 0), 0);
    return (sum / data.length).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl shadow-xl mb-4">
            <Code2 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800">軟體部門 Tech-Share 評分系統</h1>
          <div className="mt-4 px-4 py-2 bg-blue-50 border border-blue-100 rounded-full inline-block text-blue-700 font-medium text-sm">
             {activeShare.title}
          </div>
        </header>

        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 animate-pulse ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <ShieldCheck className="w-5 h-5" />
            {message.text}
          </div>
        )}

        {/* Home View */}
        {view === 'home' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 主管入口：僅 isAdmin 為真時顯示 */}
            {isAdmin && (
              <button onClick={() => setView('manager')} className="group p-8 bg-white rounded-3xl shadow-sm border-2 border-blue-100 hover:border-blue-500 transition-all text-left">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4"><ShieldCheck className="text-blue-600" /></div>
                <h2 className="text-xl font-bold">主管評分入口</h2>
                <p className="text-slate-500 text-sm mt-2">評估技術深度與專案協作價值。</p>
              </button>
            )}

            {/* 同儕入口：所有人可見 */}
            <button onClick={() => setView('peer')} className={`group p-8 bg-white rounded-3xl shadow-sm border-2 border-slate-100 hover:border-indigo-500 transition-all text-left ${!isAdmin ? 'md:col-span-2' : ''}`}>
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4"><Users className="text-indigo-600" /></div>
              <h2 className="text-xl font-bold">同儕匿名評分</h2>
              <p className="text-slate-500 text-sm mt-2">評估知識獲取感與跨部門理解。</p>
            </button>

            {/* Dashboard 入口：僅限 Admin */}
            {isAdmin && (
              <button onClick={() => setView('dashboard')} className="md:col-span-2 group p-6 bg-slate-800 rounded-3xl shadow-sm hover:bg-slate-900 transition-all text-left text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2"><LayoutDashboard className="w-5 h-5" /> 數據總覽 Dashboard</h2>
                    <p className="text-slate-400 text-sm mt-1">查看所有評分統計與留言回饋。</p>
                  </div>
                  <div className="text-xs bg-slate-700 px-3 py-1 rounded-full text-slate-300">
                    目前已收到 {stats.manager.length + stats.peer.length} 份回饋
                  </div>
                </div>
              </button>
            )}
          </div>
        )}

        {/* Manager/Peer Form Views (省略重複邏輯，同前一版本但加上返回按鈕) */}
        {(view === 'manager' || view === 'peer') && (
           <div className="bg-white rounded-3xl shadow-xl p-6 md:p-10 border border-slate-100">
             <div className="flex items-center gap-3 mb-8">
               <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-full">←</button>
               <h2 className="text-2xl font-bold">{view === 'manager' ? '主管評分表 (實名)' : '同儕評分表 (匿名)'}</h2>
             </div>
             
             <div className="space-y-8">
               {(view === 'manager' ? managerCriteria : peerCriteria).map((c) => (
                 <div key={c.id}>
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-blue-600">{c.icon}</span>
                     <label className="font-bold">{c.label}</label>
                   </div>
                   <p className="text-xs text-slate-400 mb-2 ml-7">{c.desc}</p>
                   <div className="ml-7">
                     <RatingScale 
                        value={view === 'manager' ? managerForm[c.id] : peerForm[c.id]} 
                        onChange={(v) => view === 'manager' ? setManagerForm({...managerForm, [c.id]: v}) : setPeerForm({...peerForm, [c.id]: v})} 
                     />
                   </div>
                 </div>
               ))}
               <textarea 
                 className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 min-h-[120px]"
                 placeholder="輸入具體點評..."
                 value={view === 'manager' ? managerForm.comments : peerForm.comments}
                 onChange={(e) => view === 'manager' ? setManagerForm({...managerForm, comments: e.target.value}) : setPeerForm({...peerForm, comments: e.target.value})}
               />
               <button 
                 onClick={() => handleRatingSubmit(view)}
                 disabled={loading}
                 className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${view === 'manager' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
               >
                 {loading ? '傳送中...' : '送出評分'}
               </button>
             </div>
           </div>
        )}

        {/* Dashboard View (僅主管可進入) */}
        {view === 'dashboard' && isAdmin && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-4">
               <button onClick={() => setView('home')} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">← 返回首頁</button>
               <h2 className="text-xl font-bold">數據即時統計</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 主管評分雷達圖 */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-700"><ShieldCheck className="w-4 h-4"/> 主管觀點平均</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={managerCriteria.map(c => ({
                      subject: c.label,
                      A: getAverage(stats.manager, c.id),
                      fullMark: 10,
                    }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" fontSize={10} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} />
                      <Radar name="主管" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.6} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 同儕評分長條圖 */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-700"><Users className="w-4 h-4"/> 同儕觀點平均</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peerCriteria.map(c => ({
                      name: c.label,
                      score: getAverage(stats.peer, c.id)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={10} />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 留言列表 */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="font-bold mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> 最新回饋留言</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {[...stats.manager, ...stats.peer].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((m, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl ${m.userId === 'anonymous' ? 'bg-indigo-50' : 'bg-blue-50 border-l-4 border-blue-500'}`}>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{m.userId === 'anonymous' ? '匿名同儕' : '主管點評'}</span>
                      <span>{new Date(m.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700">{m.comments || '(無留言)'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <footer className="mt-12 text-center text-slate-400 text-[10px]">
          <p>© 軟體部門 Tech-Share 系統 | 請使用專屬 QR 進入對應權限頁面</p>
        </footer>
      </div>
    </div>
  );
};

export default App;