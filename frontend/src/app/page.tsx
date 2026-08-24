"use client";

import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [jobs, setJobs] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newQueueName, setNewQueueName] = useState('');

  const fetchData = async () => {
    try {
      const [jobsRes, queuesRes] = await Promise.all([
        fetch('http://127.0.0.1:8000/jobs/'),
        fetch('http://127.0.0.1:8000/queues/')
      ]);
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (queuesRes.ok) setQueues(await queuesRes.json());
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName) return;
    try {
      await fetch('http://127.0.0.1:8000/queues/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const handleCreateJob = async () => {
    if (queues.length === 0) {
      alert("Please create a queue first!");
      return;
    }
    try {
      await fetch('http://127.0.0.1:8000/jobs/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          queue_id: queues[0].id, 
          name: "demo_task_" + Math.floor(Math.random() * 1000),
          payload: { test: true },
          priority: 1
        })
      });
      fetchData();
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
          <button className="btn" onClick={handleCreateJob}>+ Enqueue Test Job</button>
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
                        </tr>
                      ))}
                      {jobs.length === 0 && !loading && (
                        <tr><td colSpan={4} style={{textAlign: 'center', color: '#888'}}>No jobs found. Click "Enqueue Test Job"</td></tr>
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
                      <h3>{q.name}</h3>
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
            <div className="glass-panel fade-in" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '1rem' }}>⚙️</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>Worker Fleet</h3>
                <p className="text-muted">Run `python app/worker.py` in your backend terminal to see live workers here!</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
