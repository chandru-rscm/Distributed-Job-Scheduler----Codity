"use client";

import { useState } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen p-8">
      <Head>
        <title>Peak Job Scheduler</title>
      </Head>

      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">
            Distributed <span style={{ color: 'var(--accent)' }}>Scheduler</span>
          </h1>
          <p className="text-muted text-sm">High-performance async job execution platform</p>
        </div>
        
        <div className="flex gap-4">
          <button className="btn">Deploy Worker</button>
          <div className="glass-panel" style={{ padding: '10px 20px', borderRadius: '8px' }}>
            <span className="text-sm font-semibold text-success">● System Online</span>
          </div>
        </div>
      </header>

      <div className="grid" style={{ gridTemplateColumns: '250px 1fr', gap: '32px' }}>
        <nav className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: 'fit-content' }}>
          {['overview', 'queues', 'jobs', 'workers'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '8px',
                background: activeTab === tab ? 'var(--border)' : 'transparent',
                border: 'none',
                color: activeTab === tab ? 'white' : 'var(--text-muted)',
                cursor: 'pointer',
                fontWeight: activeTab === tab ? '600' : '400',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </nav>

        <main>
          {activeTab === 'overview' && (
            <div className="fade-in">
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <div className="glass-panel">
                  <h3 className="text-muted text-sm mb-2">Total Jobs (24h)</h3>
                  <div className="text-3xl font-bold">14,293</div>
                  <div className="text-success text-xs mt-2">↑ 12% vs yesterday</div>
                </div>
                <div className="glass-panel">
                  <h3 className="text-muted text-sm mb-2">Active Workers</h3>
                  <div className="text-3xl font-bold text-accent">8</div>
                  <div className="text-muted text-xs mt-2">Polling across 3 regions</div>
                </div>
                <div className="glass-panel">
                  <h3 className="text-muted text-sm mb-2">Success Rate</h3>
                  <div className="text-3xl font-bold text-success">99.8%</div>
                  <div className="text-warning text-xs mt-2">42 jobs retried</div>
                </div>
                <div className="glass-panel">
                  <h3 className="text-muted text-sm mb-2">Dead Letter Queue</h3>
                  <div className="text-3xl font-bold text-danger">3</div>
                  <div className="text-muted text-xs mt-2">Requires manual intervention</div>
                </div>
              </div>

              <div className="glass-panel">
                <h2 className="text-xl font-semibold mb-6">Recent Executions</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Job ID</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Queue</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Worker</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: 'job_8f7a9', queue: 'email-sender', status: 'completed', worker: 'worker-us-east-1', time: '1.2s' },
                      { id: 'job_4b2c1', queue: 'data-processing', status: 'running', worker: 'worker-eu-west-1', time: '45s' },
                      { id: 'job_9x1d3', queue: 'image-resize', status: 'queued', worker: '-', time: '-' },
                      { id: 'job_0p8z2', queue: 'webhook-delivery', status: 'failed', worker: 'worker-us-east-2', time: '3.4s' },
                    ].map((job) => (
                      <tr key={job.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '16px 12px', fontFamily: 'monospace' }}>{job.id}</td>
                        <td style={{ padding: '16px 12px' }}>{job.queue}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span className={`status-badge status-${job.status}`}>{job.status}</span>
                        </td>
                        <td style={{ padding: '16px 12px', color: 'var(--text-muted)' }}>{job.worker}</td>
                        <td style={{ padding: '16px 12px', color: 'var(--text-muted)' }}>{job.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab !== 'overview' && (
            <div className="glass-panel fade-in" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="text-center">
                <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '16px' }}>🚧</div>
                <h3 className="text-xl font-medium mb-2">{activeTab} module</h3>
                <p className="text-muted">Will be connected to the FastAPI backend once migrations are complete.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
