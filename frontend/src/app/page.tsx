"use client";

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [jobs, setJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQueueName, setNewQueueName] = useState('');
  const [selectedJobLogs, setSelectedJobLogs] = useState<any[] | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://127.0.0.1:8000/ws';

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'dev-secret-key': 'dev-secret-key'
  });

  const fetchData = async () => {
    try {
      const [jobsRes, queuesRes, workersRes] = await Promise.all([
        fetch(`${API_URL}/jobs/`, { headers: getHeaders() }),
        fetch(`${API_URL}/queues/`, { headers: getHeaders() }),
        fetch(`${API_URL}/workers/`, { headers: getHeaders() })
      ]);
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (queuesRes.ok) setQueues(await queuesRes.json());
      if (workersRes.ok) setWorkers(await workersRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetch(`${API_URL}/workers/`, { headers: getHeaders() })
        .then(res => res.json())
        .then(data => setWorkers(data))
        .catch(() => {});
    }, 5000);

    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => {
      // Real-time updates trigger a fresh data fetch
      fetchData();
    };

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, []);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    try {
      await fetch(`${API_URL}/queues/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          project_id: "default", 
          name: newQueueName,
          concurrency_limit: 10
        })
      });
      setNewQueueName('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnqueue = async () => {
    if (queues.length === 0) return alert("Create a queue first!");
    try {
      await fetch(`${API_URL}/jobs/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ 
          queue_id: queues[0].id, 
          name: "demo_task_" + Math.floor(Math.random() * 1000),
          payload: { fail_me: Math.random() > 0.7 },
          priority: 1
        })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await fetch(`${API_URL}/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: getHeaders()
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const togglePause = async (queueId: string, currentlyPaused: boolean) => {
    try {
      const action = currentlyPaused ? 'resume' : 'pause';
      await fetch(`${API_URL}/queues/${queueId}/${action}`, {
        method: 'POST',
        headers: getHeaders()
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchJobLogs = async (jobId: string) => {
    try {
      const res = await fetch(`${API_URL}/jobs/${jobId}/executions`, { headers: getHeaders() });
      if (res.ok) setSelectedJobLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container">
      <Head>
        <title>Peak Job Scheduler</title>
      </Head>

      <header className="dashboard-header">
        <div>
          <h1 className="header-title">
            Distributed <span className="text-accent">Scheduler</span>
          </h1>
          <p className="header-subtitle">High-performance async job execution platform</p>
        </div>
        
        <div className="header-actions">
          <button className="btn" onClick={handleEnqueue}>+ Enqueue Test Job</button>
          <div className="glass-panel" style={{ padding: '0.5rem 1rem' }}>
            <span className="status-online">● System Online</span>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <nav className="glass-panel nav-panel">
          {['overview', 'queues', 'jobs', 'workers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nav-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <main>
          {activeTab === 'overview' && (
            <div className="fade-in">
              <div className="stats-grid">
                <div className="glass-panel stat-card">
                  <h3>Total Jobs (24h)</h3>
                  <div className="stat-value">{jobs.length}</div>
                  <div className="stat-change text-success">Live from database</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Active Queues</h3>
                  <div className="stat-value text-accent">{queues.length}</div>
                  <div className="stat-change text-muted">Ready to process</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Success Rate</h3>
                  <div className="stat-value text-success">100%</div>
                  <div className="stat-change text-warning">0 jobs retried</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Dead Letter Queue</h3>
                  <div className="stat-value text-danger">0</div>
                  <div className="stat-change text-muted">All clear</div>
                </div>
              </div>

              <div className="glass-panel">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Recent Executions</h2>
                <div className="table-container">
                  <table className="jobs-table">
                    <thead>
                        <tr>
                        <th>Job ID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 10).map((job) => (
                        <tr key={job.id}>
                          <td className="font-mono">{job.id.slice(0, 8)}...</td>
                          <td>{job.name}</td>
                          <td>
                            <span className={`status-badge status-${job.status.toLowerCase()}`}>{job.status}</span>
                          </td>
                          <td className="text-muted">{new Date(job.created_at).toLocaleTimeString()}</td>
                          <td style={{display: 'flex', gap: '0.5rem'}}>
                            <button onClick={() => fetchJobLogs(job.id)} className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem'}}>Logs</button>
                            {(job.status === 'FAILED' || job.status === 'DLQ') && (
                              <button onClick={() => handleRetry(job.id)} className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem'}}>Retry</button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {jobs.length === 0 && !loading && (
                        <tr><td colSpan={5} style={{textAlign: 'center', color: '#888'}}>No jobs found. Click "Enqueue Test Job"</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queues' && (
            <div className="fade-in">
              <div className="glass-panel" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Create New Queue</h2>
                <form onSubmit={handleCreateQueue} style={{ display: 'flex', gap: '1rem' }}>
                  <input 
                    type="text" 
                    value={newQueueName}
                    onChange={(e) => setNewQueueName(e.target.value)}
                    placeholder="Queue Name (e.g. image-processing)" 
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', color: 'white' }}
                  />
                  <button type="submit" className="btn">Create Queue</button>
                </form>
              </div>

              <div className="glass-panel">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Active Queues</h2>
                <div className="stats-grid">
                  {queues.map(q => (
                    <div key={q.id} className="glass-panel stat-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <h3>{q.name} {q.is_paused && <span className="text-danger">(Paused)</span>}</h3>
                        <button onClick={() => togglePause(q.id, q.is_paused)} className="btn" style={{padding: '0.25rem 0.5rem', fontSize: '0.75rem'}}>
                          {q.is_paused ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                      <div className="stat-value text-accent">{q.concurrency_limit}</div>
                      <div className="stat-change text-muted">Max Concurrency</div>
                    </div>
                  ))}
                  {queues.length === 0 && <p className="text-muted">No queues exist yet.</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'jobs' && (
             <div className="glass-panel fade-in">
               <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>All Jobs</h2>
               <div className="table-container">
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Queue ID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <td className="font-mono">{job.id}</td>
                          <td className="font-mono text-muted">{job.queue_id.slice(0, 8)}...</td>
                          <td>{job.name}</td>
                          <td>
                            <span className={`status-badge status-${job.status.toLowerCase()}`}>{job.status}</span>
                          </td>
                          <td className="text-muted">{job.priority}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          )}

          {activeTab === 'workers' && (
            <div className="glass-panel fade-in">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Worker Fleet</h2>
              <div className="stats-grid">
                {workers.map(w => (
                  <div key={w.id} className="glass-panel stat-card" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <h3>{w.hostname}</h3>
                    <div className="stat-value text-success">{w.status}</div>
                    <div className="stat-change text-muted">Last seen: {new Date(w.last_heartbeat).toLocaleTimeString()}</div>
                  </div>
                ))}
                {workers.length === 0 && (
                  <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: '2rem' }}>
                    <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '1rem' }}>⚙️</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>No active workers</h3>
                    <p className="text-muted">Run `python -m app.worker` in your backend terminal to see live workers here!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedJobLogs && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
            }}>
              <div className="glass-panel" style={{ width: '800px', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '1rem'}}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Execution Logs</h2>
                  <button onClick={() => setSelectedJobLogs(null)} className="btn" style={{padding: '0.25rem 0.5rem'}}>Close</button>
                </div>
                {selectedJobLogs.length === 0 ? <p className="text-muted">No execution logs found.</p> : null}
                {selectedJobLogs.map((log, i) => (
                  <div key={i} style={{marginBottom: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem'}}>
                      <span className={`status-badge status-${log.status.toLowerCase()}`}>{log.status}</span>
                      <span className="text-muted">{new Date(log.started_at).toLocaleString()}</span>
                    </div>
                    {log.logs && <pre style={{background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.875rem', marginTop: '0.5rem'}}>{log.logs}</pre>}
                    {log.error_message && <pre style={{color: '#ff4d4f', background: 'rgba(255,77,79,0.1)', padding: '0.5rem', borderRadius: '4px', fontSize: '0.875rem', marginTop: '0.5rem'}}>{log.error_message}</pre>}
                    {log.ai_summary && (
                      <div style={{marginTop: '0.75rem', padding: '0.75rem', background: 'linear-gradient(90deg, rgba(138,43,226,0.1) 0%, rgba(0,212,255,0.1) 100%)', borderLeft: '4px solid #8a2be2', borderRadius: '4px'}}>
                        <strong>🤖 AI Summary:</strong>
                        <p style={{marginTop: '0.25rem', fontSize: '0.875rem'}}>{log.ai_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
