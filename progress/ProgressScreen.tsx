'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  calculateProgressStreaks,
  calculateProgressMilestones,
  groupWorkoutHistory,
  progressBuckets,
  summarizeProgress,
} from './progress.ts';
import type { ProgressPeriod, WorkoutSession } from './types.ts';

type ProgressScreenProps = {
  sessions: WorkoutSession[];
  onHome: () => void;
  onTimers: () => void;
  onSettings: () => void;
  onDeleteSession: (sessionId: string) => void;
  weeklyGoal: number;
};

const PERIOD_LABELS: Record<ProgressPeriod, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
};

function displayMinutes(seconds: number) {
  if (seconds <= 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

export function ProgressScreen({
  sessions,
  onHome,
  onTimers,
  onSettings,
  onDeleteSession,
  weeklyGoal,
}: ProgressScreenProps) {
  const [period, setPeriod] = useState<ProgressPeriod>('week');
  const [now] = useState(() => new Date());
  const summary = useMemo(() => summarizeProgress(sessions, period, now), [now, period, sessions]);
  const buckets = useMemo(() => progressBuckets(sessions, period, now), [now, period, sessions]);
  const streaks = useMemo(() => calculateProgressStreaks(sessions, now, weeklyGoal), [now, sessions, weeklyGoal]);
  const milestones = useMemo(() => calculateProgressMilestones(sessions, now, weeklyGoal), [now, sessions, weeklyGoal]);
  const history = useMemo(() => groupWorkoutHistory(sessions), [sessions]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.totalSeconds));

  return (
    <main className="app-shell progress-screen">
      <header className="screen-header progress-header">
        <button className="text-button muted" onClick={onHome}>Home</button>
        <div className="header-title"><span className="eyebrow">YOUR TRAINING</span><strong>Progress</strong></div>
        <button className="text-button accent" onClick={onSettings}>Settings</button>
      </header>

      <section className="progress-content">
        <div className="progress-hero">
          <div className="progress-hero-copy">
            <p className="eyebrow dark">{PERIOD_LABELS[period].toUpperCase()}</p>
            <div className="progress-total"><strong>{displayMinutes(summary.totalSeconds)}</strong><span>MIN</span></div>
            <p>{formatDuration(summary.activeWorkSeconds)} active work across {plural(summary.workouts, 'workout')}.</p>
          </div>
          <div className="progress-hero-mark"><AppIcon name="progress" size={52} strokeWidth={2.25} /></div>
        </div>

        <div className="period-tabs" role="tablist" aria-label="Progress period">
          {(['day', 'week', 'month'] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={period === option}
              className={period === option ? 'selected' : ''}
              onClick={() => setPeriod(option)}
            >
              {option}
            </button>
          ))}
        </div>

        <section className="activity-panel" aria-labelledby="activity-title">
          <div className="progress-section-heading">
            <div><p className="eyebrow">ACTIVITY</p><h2 id="activity-title">Training rhythm</h2></div>
            <span>{plural(summary.activeDays, 'active day')}</span>
          </div>
          <div className="activity-chart">
            {buckets.map((bucket) => {
              const level = bucket.totalSeconds > 0
                ? Math.max(8, Math.round((bucket.totalSeconds / maxBucket) * 100))
                : 4;
              const style = { '--activity-level': `${level}%` } as CSSProperties;
              return (
                <div
                  className={`activity-column ${bucket.isCurrent ? 'current' : ''}`}
                  key={bucket.key}
                  aria-label={`${bucket.label}: ${formatDuration(bucket.totalSeconds)}`}
                >
                  <span className="activity-track"><i style={style} /></span>
                  <small>{bucket.label}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="consistency-panel" aria-labelledby="consistency-title">
          <div className="progress-section-heading">
            <div><p className="eyebrow">CONSISTENCY</p><h2 id="consistency-title">Keep showing up</h2></div>
          </div>
          <div className="consistency-grid">
            <article className="consistency-card flame-card">
              <AppIcon name="flame" size={27} strokeWidth={2} />
              <strong>{streaks.currentActiveDays}</strong>
              <p>active-day streak</p>
              <small>Best: {plural(streaks.longestActiveDays, 'day')}</small>
            </article>
            <article className="consistency-card goal-card">
              <AppIcon name="target" size={27} strokeWidth={2} />
              <strong>{streaks.workoutsThisWeek}/{streaks.weeklyGoal}</strong>
              <p>weekly workouts</p>
              <small>{plural(streaks.weeklyGoalStreak, 'goal week')} in a row</small>
            </article>
          </div>
        </section>

        <section className="milestones-panel" aria-labelledby="milestones-title">
          <div className="progress-section-heading">
            <div><p className="eyebrow">MILESTONES</p><h2 id="milestones-title">Build your record</h2></div>
            <span>{milestones.filter(({ unlocked }) => unlocked).length}/{milestones.length} unlocked</span>
          </div>
          <div className="milestone-grid">
            {milestones.map((milestone) => {
              const level = Math.round((milestone.progress / milestone.target) * 100);
              const style = { '--milestone-level': `${level}%` } as CSSProperties;
              return (
                <article className={`milestone-card ${milestone.unlocked ? 'unlocked' : ''}`} key={milestone.id}>
                  <AppIcon name={milestone.unlocked ? 'check' : 'trophy'} size={23} strokeWidth={2} />
                  <div><strong>{milestone.title}</strong><p>{milestone.description}</p></div>
                  <span className="milestone-progress" aria-hidden="true"><i style={style} /></span>
                  <small>{milestone.progressLabel}</small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="history-panel" aria-labelledby="history-title">
          <div className="progress-section-heading history-title-row">
            <div><p className="eyebrow">JOURNAL</p><h2 id="history-title">Workout history</h2></div>
            <span>{plural(sessions.length, 'session')}</span>
          </div>

          {history.length === 0 ? (
            <div className="progress-empty-state">
              <AppIcon name="history" size={43} strokeWidth={1.6} />
              <strong>Your first workout starts the story.</strong>
              <p>Complete a timer and Pulse will add it here automatically.</p>
              <button onClick={onTimers}>Choose a timer</button>
            </div>
          ) : (
            <div className="history-months">
              {history.map((month) => (
                <section className="history-month" key={month.key}>
                  <header className="history-month-header">
                    <strong>{month.label}</strong>
                    <span>{formatDuration(month.totalSeconds)}</span>
                  </header>
                  <div className="history-days">
                    {month.days.map((day) => (
                      <article className="history-day" key={day.key}>
                        <header><strong>{day.label}</strong><span>{formatDuration(day.totalSeconds)}</span></header>
                        <div className="history-sessions">
                          {day.sessions.map((session) => (
                            <div className="history-session" key={session.id}>
                              <span className="history-session-mark" aria-hidden="true" />
                              <div>
                                <strong>{session.timerName}</strong>
                                <small>{formatDuration(session.totalSeconds)} training · {formatDuration(session.activeWorkSeconds)} active</small>
                              </div>
                              <div className="history-session-meta">
                                <span>{session.rounds}R · {session.cycles}C</span>
                                <button onClick={() => onDeleteSession(session.id)} aria-label={`Delete ${session.timerName} from history`}>Delete</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        <button className="nav-item" onClick={onHome}><AppIcon name="home" />Home</button>
        <button className="nav-item" onClick={onTimers}><AppIcon name="timer" />Timers</button>
        <button className="nav-item active"><AppIcon name="progress" />Progress</button>
        <button className="nav-item" onClick={onSettings}><AppIcon name="settings" />Settings</button>
      </nav>
    </main>
  );
}
