"use client";

import { useState } from 'react';
import Head from 'next/head';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

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
          <button className="btn">Deploy Worker</button>
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
                  <div className="stat-value">14,293</div>
                  <div className="stat-change text-success">↑ 12% vs yesterday</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Active Workers</h3>
                  <div className="stat-value text-accent">8</div>
                  <div className="stat-change text-muted">Polling across 3 regions</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Success Rate</h3>
                  <div className="stat-value text-success">99.8%</div>
                  <div className="stat-change text-warning">42 jobs retried</div>
                </div>
                <div className="glass-panel stat-card">
                  <h3>Dead Letter Queue</h3>
                  <div className="stat-value text-danger">3</div>
                  <div className="stat-change text-muted">Requires manual intervention</div>
                </div>
              </div>

              <div className="glass-panel">
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>Recent Executions</h2>
                <div className="table-container">
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Queue</th>
                        <th>Status</th>
                        <th>Worker</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'job_8f7a9', queue: 'email-sender', status: 'completed', worker: 'worker-us-east-1', time: '1.2s' },
                        { id: 'job_4b2c1', queue: 'data-processing', status: 'running', worker: 'worker-eu-west-1', time: '45s' },
                        { id: 'job_9x1d3', queue: 'image-resize', status: 'queued', worker: '-', time: '-' },
                        { id: 'job_0p8z2', queue: 'webhook-delivery', status: 'failed', worker: 'worker-us-east-2', time: '3.4s' },
                      ].map((job) => (
                        <tr key={job.id}>
                          <td className="font-mono">{job.id}</td>
                          <td>{job.queue}</td>
                          <td>
                            <span className={`status-badge status-${job.status}`}>{job.status}</span>
                          </td>
                          <td className="text-muted">{job.worker}</td>
                          <td className="text-muted">{job.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'overview' && (
            <div className="glass-panel fade-in" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '1rem' }}>🚧</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 500, marginBottom: '0.5rem' }}>{activeTab} module</h3>
                <p className="text-muted">Will be connected to the FastAPI backend once migrations are complete.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
