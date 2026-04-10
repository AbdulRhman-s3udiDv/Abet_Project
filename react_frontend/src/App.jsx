import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LayoutDashboard, FileSpreadsheet, Activity, UploadCloud, FileText } from 'lucide-react';
import './index.css';

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
        const res = await fetch('http://127.0.0.1:8001/predict/manual', {
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
    fetch('http://127.0.0.1:8001/api/courses')
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
      fetch(`http://127.0.0.1:8001/api/courses/${selectedCourseId}/trend`)
        .then(res => res.json())
        .then(data => setTrendData(data))
        .catch(err => console.error(err));
    }
  }, [selectedCourseId]);

  // DB-Driven Cascade fetching for Autocomplete Prediction Form
  useEffect(() => {
    fetch('http://127.0.0.1:8001/api/programs')
      .then(res => res.json())
      .then(data => {
        setPrograms(data);
        if(data.length > 0) setSelectedProgId(data[0].id);
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (selectedProgId) {
       fetch(`http://127.0.0.1:8001/api/programs/${selectedProgId}/courses`)
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
        fetch(`http://127.0.0.1:8001/api/courses/${selectedPredictCourseId}/terms`)
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
        <div className="glass-panel" style={{ animation: 'fadeIn 0.3s', textAlign: 'center', padding: '60px 20px' }}>
          <FileSpreadsheet size={64} color="#64748b" style={{marginBottom: '20px'}} />
          <h2 style={{marginBottom: '10px'}}>Batch Evaluation via Excel</h2>
          <p style={{color: 'var(--text-secondary)', marginBottom: '30px'}}>
            Upload the official End-of-Term Excel sheet. The ML Engine will map the structure, parse all courses, and return a robust PDF report of predicted risks.
          </p>
          <button className="btn-primary" style={{backgroundColor: 'var(--aiu-navy)'}}>Browse Excel File (*.xlsx)</button>
        </div>
      )}
      </div>
    </>
  );
}
