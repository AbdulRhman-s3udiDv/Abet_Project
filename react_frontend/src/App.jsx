import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, FileSpreadsheet, Activity, UploadCloud, FileText, Bot, Send, User, Loader2, Sparkles, CheckCircle2, AlertCircle, Database, Table2 } from 'lucide-react';
import './index.css';

// ── Chatbot component ──────────────────────────────────────────────────────────
const N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/f5b8d3b0-cd79-47fe-8e0b-3fdde1928eeb';

const SUGGESTIONS = [
  'Which courses are at risk next term?',
  'Explain Student Outcome SO3',
  'What is the pass rate trend for CSE251?',
  'How does the ML model predict risk?',
  'Which program has the most at-risk courses?',
  'Suggest improvements for low-SO courses',
];

function ChatBot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hello! I'm your ABET AI Assistant. Ask me anything about course risk, student outcomes, program health, or ABET compliance.",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg = {
      role: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: messages.map(m => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      // n8n can return { reply: "..." } or { output: "..." } or plain text
      const reply = data.reply || data.output || data.text || data.message || (typeof data === 'string' ? data : 'I received your message but got an unexpected response format.');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Could not reach the n8n agent. Make sure your webhook URL is set and n8n is running.\n\n_Error: ${err.message}_`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        },
      ]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-wrapper">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-avatar">
          <Bot size={22} color="white" />
        </div>
        <div>
          <div className="chat-header-name">ABET AI Assistant</div>
          <div className="chat-header-status">
            <span className="chat-status-dot" />
            Powered by n8n + AI
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-bubble-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}>
            {msg.role === 'assistant' && (
              <div className="bubble-avatar assistant-avatar"><Bot size={16} /></div>
            )}
            <div className={`chat-bubble ${msg.role === 'user' ? 'user-bubble' : msg.isError ? 'error-bubble' : 'assistant-bubble'}`}>
              <div className="bubble-text">{msg.text}</div>
              <div className="bubble-time">{msg.time}</div>
            </div>
            {msg.role === 'user' && (
              <div className="bubble-avatar user-avatar"><User size={16} /></div>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-bubble-row assistant-row">
            <div className="bubble-avatar assistant-avatar"><Bot size={16} /></div>
            <div className="chat-bubble assistant-bubble typing-bubble">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="chat-suggestions">
          <div className="suggestions-label"><Sparkles size={13} /> Try asking:</div>
          <div className="suggestions-grid">
            {SUGGESTIONS.map((s, i) => (
              <button key={i} className="suggestion-chip" onClick={() => sendMessage(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Ask about ABET risk, student outcomes, course trends…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          title="Send (Enter)"
        >
          {loading ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
        </button>
      </div>
    </div>
  );
}

// ── Batch Upload component ──────────────────────────────────────────────────
const API_BASE = 'http://127.0.0.1:8000';

function BatchUpload() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch available tables on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/upload/tables`)
      .then(res => res.json())
      .then(data => {
        if (data.tables) setTables(data.tables);
      })
      .catch(err => console.error('Failed to load tables:', err));
  }, []);

  // Fetch columns when a table is selected
  useEffect(() => {
    if (!selectedTable) {
      setColumns([]);
      return;
    }
    setLoadingColumns(true);
    setResult(null);
    fetch(`${API_BASE}/api/upload/tables/${selectedTable}/columns`)
      .then(res => res.json())
      .then(data => {
        setColumns(data.columns || []);
      })
      .catch(err => {
        console.error(err);
        setColumns([]);
      })
      .finally(() => setLoadingColumns(false));
  }, [selectedTable]);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f || null);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file || !selectedTable) return;
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('table_name', selectedTable);

    try {
      const res = await fetch(`${API_BASE}/api/upload/insert`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: 'success', message: data.message, count: data.inserted_count });
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        setResult({ type: 'error', message: data.detail || 'Upload failed.' });
      }
    } catch (err) {
      setResult({ type: 'error', message: 'Could not connect to the server. Is the backend running?' });
    }
    setUploading(false);
  };

  return (
    <div className="glass-panel" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <Database size={48} color="var(--aiu-navy)" style={{ marginBottom: '12px' }} />
        <h2 style={{ marginBottom: '6px' }}>Batch Data Upload</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Select a database table, review its expected columns, then upload an Excel or CSV file to insert data.
        </p>
      </div>

      {/* Step 1: Table Selection */}
      <div style={{ marginBottom: '20px' }}>
        <span className="label-text">
          <Table2 size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
          1. Select Target Table
        </span>
        <select
          className="input-field"
          value={selectedTable}
          onChange={(e) => { setSelectedTable(e.target.value); setFile(null); setResult(null); }}
        >
          <option value="">-- Choose a table --</option>
          {tables.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Step 2: Column Headings */}
      {selectedTable && (
        <div className="upload-columns-section" style={{ marginBottom: '24px' }}>
          <span className="label-text" style={{ marginBottom: '12px' }}>
            <FileText size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
            2. Expected Columns for <strong style={{ color: 'var(--aiu-navy)' }}>{selectedTable}</strong>
          </span>

          {loadingColumns ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Loader2 size={24} className="spin" color="var(--text-secondary)" />
            </div>
          ) : columns.length > 0 ? (
            <div className="column-chips-container">
              {columns.map((col, i) => (
                <span key={i} className="column-chip">
                  {col}
                </span>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              No columns found. The table may be empty and have no discoverable schema.
            </p>
          )}

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '10px' }}>
            <strong>Note:</strong> Your Excel headers must match these column names. The <code>id</code> and <code>created_at</code> columns are auto-generated and will be ignored if present.
          </p>
        </div>
      )}

      {/* Step 3: File Upload */}
      {selectedTable && columns.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <span className="label-text">
            <UploadCloud size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
            3. Upload Excel File
          </span>
          <div className="upload-drop-area" onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {file ? (
              <div>
                <FileSpreadsheet size={32} color="var(--aiu-navy)" />
                <p style={{ margin: '8px 0 0', fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</p>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </div>
            ) : (
              <div>
                <UploadCloud size={36} color="var(--text-secondary)" />
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
                  Click to browse for an Excel or CSV file
                </p>
              </div>
            )}
          </div>

          <button
            className="btn-primary"
            style={{ width: '100%', marginTop: '14px' }}
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <><Loader2 size={18} className="spin" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '6px' }} /> Uploading...</>
            ) : (
              <>Upload & Insert into {selectedTable}</>
            )}
          </button>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div className={`upload-result ${result.type === 'success' ? 'upload-success' : 'upload-error'}`}>
          {result.type === 'success' ? (
            <CheckCircle2 size={22} style={{ flexShrink: 0 }} />
          ) : (
            <AlertCircle size={22} style={{ flexShrink: 0 }} />
          )}
          <div>
            <strong>{result.type === 'success' ? 'Success!' : 'Error'}</strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{result.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Real DB States
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [trendData, setTrendData] = useState([]);
  
  // Manual Prediction Form Database States
  const [programs, setPrograms] = useState([]);
  const [selectedProgId, setSelectedProgId] = useState('');
  const [progCourses, setProgCourses] = useState([]);
  const [selectedPredictCourseId, setSelectedPredictCourseId] = useState('');
  const [courseTerms, setCourseTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');

  // Values
  const [avgScore, setAvgScore] = useState('');
  const [passRate, setPassRate] = useState('');
  const [sos, setSos] = useState({1:'', 2:'', 3:'', 4:'', 5:'', 6:'', 7:''});
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePredict = async (e) => {
    e.preventDefault();
    setIsPredicting(true);
    setPredictionResult(null);

    // Calculate dynamic Composite SO
    let activeVals = [];
    let payloadSos = {};
    for (let i=1; i<=7; i++) {
        let val = sos[i];
        if (val !== '' && val !== null) {
            let num = parseFloat(val);
            activeVals.push(num);
            payloadSos[`so${i}_attainment`] = num;
        } else {
            payloadSos[`so${i}_attainment`] = null;
        }
    }
    
    let composite = activeVals.length > 0 ? (activeVals.reduce((a,b)=>a+b, 0) / activeVals.length) : 0;

    const currentProg = programs.find(p => p.id == selectedProgId);
    const currentCourse = progCourses.find(c => c.id == selectedPredictCourseId);

    const payload = {
        course_code: currentCourse ? currentCourse.course_code : "TEST100",
        program_code: currentProg ? currentProg.code : "AIE",
        academic_term: selectedTerm || "Manual",
        avg_score: parseFloat(avgScore || 0),
        pass_rate: parseFloat(passRate || 0),
        ...payloadSos,
        composite_so_index: composite,
        trend_value: 0.0 // Defaulting trend to 0 for raw manual mode
    };

    try {
        const res = await fetch('http://127.0.0.1:8000/predict/manual', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        let displayTerm = "the next term";
        if (selectedTerm && selectedTerm.length >= 5) {
            try {
                let y = parseInt(selectedTerm.substring(0, 4));
                let s = selectedTerm.charAt(4).toUpperCase();
                if (s === 'F') displayTerm = `${y + 1}S`;
                else if (s === 'S') displayTerm = `${y}F`;
            } catch (e) {}
        }

        if (res.ok) {
            setPredictionResult({
                risk: data.risk_probability,
                status: data.is_at_risk ? 'At Risk' : 'Safe',
                msg: data.is_at_risk 
                     ? `High probability of failing ABET thresholds in ${displayTerm}. The ML Model evaluated the structural weights for ${currentProg?.code || 'the chosen program'}.`
                     : `Course appears mathematically safe for ${displayTerm} according to the Historical Model.`
            });
        } else {
            setPredictionResult({ risk: 'Error', msg: JSON.stringify(data) });
        }
    } catch (err) {
        setPredictionResult({ risk: 'Network Error', msg: 'Could not connect to FastAPI server. Is it running?' });
    }
    setIsPredicting(false);
  };

  // Fetch true courses from API on load
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/courses')
      .then(res => res.json())
      .then(data => {
        if (data.courses && data.courses.length > 0) {
          setCourses(data.courses);
          setSelectedCourseId(data.courses[0].id);
        }
      })
      .catch(err => console.error("API DB connection error:", err));
  }, []);

  // Fetch real trend data whenever dashboard course changes
  useEffect(() => {
    if (selectedCourseId) {
      fetch(`http://127.0.0.1:8000/api/courses/${selectedCourseId}/trend`)
        .then(res => res.json())
        .then(data => setTrendData(data))
        .catch(err => console.error(err));
    }
  }, [selectedCourseId]);

  // DB-Driven Cascade fetching for Autocomplete Prediction Form
  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/programs')
      .then(res => res.json())
      .then(data => {
        setPrograms(data);
        if(data.length > 0) setSelectedProgId(data[0].id);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedProgId) {
       fetch(`http://127.0.0.1:8000/api/programs/${selectedProgId}/courses`)
         .then(res=>res.json())
         .then(data => {
            setProgCourses(data);
            if(data.length > 0) setSelectedPredictCourseId(data[0].id);
            else { setSelectedPredictCourseId(''); setCourseTerms([]); }
         });
    }
  }, [selectedProgId]);

  useEffect(() => {
     if (selectedPredictCourseId) {
        fetch(`http://127.0.0.1:8000/api/courses/${selectedPredictCourseId}/terms`)
          .then(res => res.json())
          .then(data => {
              setCourseTerms(data);
              if(data.length > 0) setSelectedTerm(data[data.length-1].academic_term);
              else setSelectedTerm('');
          });
     }
  }, [selectedPredictCourseId]);

  useEffect(() => {
     if (selectedTerm && courseTerms.length > 0) {
         const found = courseTerms.find(t => t.academic_term === selectedTerm);
         if (found) {
             setAvgScore(found.avg_score || '');
             setPassRate(found.pass_rate || '');
             setSos({
                 1: found.so1_attainment || '',
                 2: found.so2_attainment || '',
                 3: found.so3_attainment || '',
                 4: found.so4_attainment || '',
                 5: found.so5_attainment || '',
                 6: found.so6_attainment || '',
                 7: found.so7_attainment || ''
             });
         }
     } else {
         setAvgScore(''); setPassRate('');
         setSos({1:'', 2:'', 3:'', 4:'', 5:'', 6:'', 7:''});
     }
  }, [selectedTerm, courseTerms]);

  return (
    <>
      <div className="aiu-header">
        <img src="/AIU_New_Logo.png" alt="AIU Logo" />
        <h1>Faculty of Computer Science & Engineering</h1>
      </div>

      <div className="page-container">
        <div className="header-title-main">
          Smart ABET Platform
        </div>
        <p className="header-subtitle-main">Intelligent Course Risk Prediction & Analysis</p>

      {/* Navigation */}
      <div className="nav-bar">
        <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
          <LayoutDashboard size={18} style={{display:'inline', verticalAlign:'text-bottom', marginRight:'6px'}}/> 
          Dashboard
        </button>
        <button className={`nav-tab ${activeTab === 'predict' ? 'active' : ''}`} onClick={() => setActiveTab('predict')}>
          <FileText size={18} style={{display:'inline', verticalAlign:'text-bottom', marginRight:'6px'}}/> 
          Manual Predictor
        </button>
        <button className={`nav-tab ${activeTab === 'upload' ? 'active' : ''}`} onClick={() => setActiveTab('upload')}>
          <UploadCloud size={18} style={{display:'inline', verticalAlign:'text-bottom', marginRight:'6px'}}/>
          Batch Upload
        </button>
        <button className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
          <Bot size={18} style={{display:'inline', verticalAlign:'text-bottom', marginRight:'6px'}}/>
          AI Assistant
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'dashboard' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div className="dashboard-grid">
            <div className="glass-panel metric-card">
              <span className="metric-label">Monitored Courses</span>
              <span className="metric-value">150</span>
            </div>
            <div className="glass-panel metric-card">
              <span className="metric-label">Courses at Risk (Next Term)</span>
              <span className="metric-value" style={{color: 'var(--danger)'}}>12</span>
            </div>
            <div className="glass-panel metric-card">
              <span className="metric-label">Database Origin</span>
              <span className="metric-value">Fall 2020</span>
            </div>
          </div>

          <div className="glass-panel" style={{marginTop: '30px'}}>
            <h3 style={{marginBottom: '20px', fontSize: '1.2rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between'}}>
              <span>Real Database degradation Trend</span>
              <select className="input-field" style={{width: 'auto', padding: '6px', margin: 0}}
                  value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.course_code}</option>
                ))}
              </select>
            </h3>
            
            {trendData.length > 0 ? (
              <div style={{ height: '350px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d333b" />
                    <XAxis dataKey="term" stroke="#7d8590" />
                    <YAxis domain={[50, 100]} stroke="#7d8590" />
                    <Tooltip contentStyle={{backgroundColor: '#161b22', borderColor: '#30363d'}} />
                    <Line type="monotone" dataKey="index" name="Composite SO" stroke="#2f81f7" strokeWidth={3} dot={{r: 4}} />
                    <Line type="monotone" dataKey="pass_rate" name="Pass Rate %" stroke="#f85149" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
               <div style={{color: 'var(--text-secondary)', padding: '50px', textAlign: 'center'}}>
                 Please setup your SUPABASE_URL in .env and run seed_supabase.py to view live database metrics.
               </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'predict' && (
        <div className="glass-panel" style={{ animation: 'fadeIn 0.3s', maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{marginBottom: '20px'}}>Predict Next-Term Risk</h2>
          <form onSubmit={handlePredict}>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
              <div>
                <span className="label-text">Select Program Context</span>
                <select className="input-field" value={selectedProgId} onChange={(e) => setSelectedProgId(e.target.value)}>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.code} ({p.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label-text">Select Enrolled Course</span>
                <select className="input-field" value={selectedPredictCourseId} onChange={(e) => setSelectedPredictCourseId(e.target.value)}>
                  {progCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.course_code}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'15px', marginTop:'15px'}}>
              <div>
                <span className="label-text">Auto-Fill from Historical Term (Optional tweak)</span>
                <select className="input-field" value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)}>
                  <option value="">-- Clean Input --</option>
                  {courseTerms.map(t => (
                    <option key={t.id} value={t.academic_term}>{t.academic_term}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
              <div>
                <span className="label-text">Avg Score</span>
                <input className="input-field" type="number" step="0.1" placeholder="0-100" required 
                       value={avgScore} onChange={e => setAvgScore(e.target.value)} />
              </div>
              <div>
                <span className="label-text">Pass Rate %</span>
                <input className="input-field" type="number" step="0.1" placeholder="0-100" required 
                       value={passRate} onChange={e => setPassRate(e.target.value)} />
              </div>
            </div>

            <div style={{marginTop: '10px'}}>
              <span className="label-text" style={{marginBottom: '8px'}}>Student Outcomes (Leave blank if inactive)</span>
              <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                {[1,2,3,4,5,6,7].map(num => (
                  <input key={num} className="input-field" type="number" step="0.1" placeholder={`SO${num}`} style={{width: '70px'}} 
                         value={sos[num]} onChange={e => setSos({...sos, [num]: e.target.value})} />
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{width: '100%', marginTop: '10px'}} disabled={isPredicting}>
              {isPredicting ? 'Evaluating...' : 'Calculate Risk via Real ML Engine'}
            </button>
          </form>

          {predictionResult && (
            <div style={{marginTop: '30px', padding: '20px', borderRadius: '8px', border: predictionResult.risk > 50 ? '1px solid rgba(248, 81, 73, 0.3)' : '1px solid rgba(35, 134, 54, 0.3)', background: predictionResult.risk > 50 ? 'rgba(248, 81, 73, 0.1)' : 'rgba(35, 134, 54, 0.1)'}}>
              <h3 style={{color: predictionResult.risk > 50 ? '#ff7b72' : '#3fb950', marginBottom: '8px'}}>
                Risk Probability: {typeof predictionResult.risk === 'number' ? predictionResult.risk + '%' : predictionResult.risk}
              </h3>
              <p style={{color: 'var(--text-secondary)'}}>{predictionResult.msg}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'upload' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <BatchUpload />
        </div>
      )}

      {activeTab === 'chat' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <ChatBot />
        </div>
      )}
      </div>
    </>
  );
}
