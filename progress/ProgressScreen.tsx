'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { getMessages } from '@/i18n';
import type { AppMessages, Locale } from '@/i18n';
import {
  calculateProgressStreaks,
  calculateProgressMilestones,
  groupWorkoutHistory,
  progressBuckets,
  summarizeProgress,
} from './progress.ts';
import type { ProgressMilestone, ProgressPeriod, WorkoutSession } from './types.ts';

type ProgressScreenProps = {
  sessions: WorkoutSession[];
  onHome: () => void;
  onTimers: () => void;
  onSettings: () => void;
  onDeleteSession: (sessionId: string) => void;
  weeklyGoal: number;
  locale: Locale;
  sessionTimerName: (session: WorkoutSession) => string;
  announcement?: string;
};

function displayMinutes(seconds: number) {
  if (seconds <= 0) return '0';
  if (seconds < 60) return '<1';
  return String(Math.round(seconds / 60));
}

function formatDuration(seconds: number, copy: AppMessages) {
  if (seconds < 60) return copy.progress.durationSeconds(seconds);
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return copy.progress.durationMinutes(minutes);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return copy.progress.durationHours(hours, remainder);
}

function milestoneProgressLabel(
  milestone: ProgressMilestone,
  copy: AppMessages,
  locale: Locale,
) {
  if (milestone.id === 'first-workout' && milestone.unlocked) return copy.progress.complete;
  if (milestone.id === 'first-workout' || milestone.id === 'ten-workouts') {
    return copy.progress.workoutProgress(Math.round(milestone.progress), milestone.target);
  }
  if (milestone.id === 'two-goal-weeks') {
    return copy.progress.goalWeekProgress(Math.round(milestone.progress), milestone.target);
  }
  const current = milestone.progress === 0
    ? '0'
    : milestone.progress < 0.1
      ? `<${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(0.1)}`
      : new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(milestone.progress);
  return copy.progress.hourProgress(current, milestone.target);
}

export function ProgressScreen({
  sessions,
  onHome,
  onTimers,
  onSettings,
  onDeleteSession,
  weeklyGoal,
  locale,
  sessionTimerName,
  announcement = '',
}: ProgressScreenProps) {
  const copy = getMessages(locale);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const [period, setPeriod] = useState<ProgressPeriod>('week');
  const [now] = useState(() => new Date());
  const summary = useMemo(() => summarizeProgress(sessions, period, now), [now, period, sessions]);
  const buckets = useMemo(() => progressBuckets(sessions, period, now, locale), [locale, now, period, sessions]);
  const streaks = useMemo(() => calculateProgressStreaks(sessions, now, weeklyGoal), [now, sessions, weeklyGoal]);
  const milestones = useMemo(() => calculateProgressMilestones(sessions, now, weeklyGoal), [now, sessions, weeklyGoal]);
  const history = useMemo(() => groupWorkoutHistory(sessions, locale), [locale, sessions]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.totalSeconds));

  useEffect(() => {
    if (announcement) titleRef.current?.focus();
  }, [announcement]);

  return (
    <main className="app-shell progress-screen">
      <header className="screen-header progress-header">
        <button className="text-button muted" onClick={onHome}>{copy.common.home}</button>
        <div className="header-title"><span className="eyebrow">{copy.progress.eyebrow}</span><h1 ref={titleRef} tabIndex={announcement ? -1 : undefined}>{copy.common.progress}</h1></div>
        <button className="text-button accent" onClick={onSettings}>{copy.common.settings}</button>
      </header>
      {announcement && <p className="visually-hidden" role="status">{announcement}</p>}

      <section className="progress-content">
        <div className="progress-hero">
          <div className="progress-hero-copy">
            <p className="eyebrow dark">{copy.progress.period[period].toLocaleUpperCase(locale)}</p>
            <div className="progress-total"><strong>{displayMinutes(summary.totalSeconds)}</strong><span>{copy.progress.minutesUnit}</span></div>
            <p>{copy.progress.activeWorkAcross(formatDuration(summary.activeWorkSeconds, copy), summary.workouts)}</p>
          </div>
          <div className="progress-hero-mark"><AppIcon name="progress" size={52} strokeWidth={2.25} /></div>
        </div>

        <div className="period-tabs" role="tablist" aria-label={copy.progress.periodAria}>
          {(['day', 'week', 'month'] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={period === option}
              className={period === option ? 'selected' : ''}
              onClick={() => setPeriod(option)}
            >
              {copy.progress.period[option]}
            </button>
          ))}
        </div>

        <section className="activity-panel" aria-labelledby="activity-title">
          <div className="progress-section-heading">
            <div><p className="eyebrow">{copy.progress.activityKicker}</p><h2 id="activity-title">{copy.progress.trainingRhythm}</h2></div>
            <span>{copy.progress.activeDays(summary.activeDays)}</span>
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
                  aria-label={`${bucket.label}: ${formatDuration(bucket.totalSeconds, copy)}`}
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
            <div><p className="eyebrow">{copy.progress.consistencyKicker}</p><h2 id="consistency-title">{copy.progress.keepShowingUp}</h2></div>
          </div>
          <div className="consistency-grid">
            <article className="consistency-card flame-card">
              <AppIcon name="flame" size={27} strokeWidth={2} />
              <strong>{streaks.currentActiveDays}</strong>
              <p>{copy.progress.activeDayStreak}</p>
              <small>{copy.progress.bestDays(streaks.longestActiveDays)}</small>
            </article>
            <article className="consistency-card goal-card">
              <AppIcon name="target" size={27} strokeWidth={2} />
              <strong>{streaks.activeDaysThisWeek}/{streaks.weeklyGoal}</strong>
              <p>{copy.progress.activeDaysPerWeek}</p>
              <small>{copy.progress.goalWeeksInRow(streaks.weeklyGoalStreak)}</small>
            </article>
          </div>
        </section>

        <section className="milestones-panel" aria-labelledby="milestones-title">
          <div className="progress-section-heading">
            <div><p className="eyebrow">{copy.progress.milestonesKicker}</p><h2 id="milestones-title">{copy.progress.buildRecord}</h2></div>
            <span>{copy.progress.unlockedCount(milestones.filter(({ unlocked }) => unlocked).length, milestones.length)}</span>
          </div>
          <div className="milestone-grid">
            {milestones.map((milestone) => {
              const level = Math.round((milestone.progress / milestone.target) * 100);
              const style = { '--milestone-level': `${level}%` } as CSSProperties;
              const milestoneCopy = copy.progress.milestones[milestone.id];
              return (
                <article className={`milestone-card ${milestone.unlocked ? 'unlocked' : ''}`} key={milestone.id}>
                  <AppIcon name={milestone.unlocked ? 'check' : 'trophy'} size={23} strokeWidth={2} />
                  <div><strong>{milestoneCopy.title}</strong><p>{milestoneCopy.description}</p></div>
                  <span className="milestone-progress" aria-hidden="true"><i style={style} /></span>
                  <small>{milestoneProgressLabel(milestone, copy, locale)}</small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="history-panel" aria-labelledby="history-title">
          <div className="progress-section-heading history-title-row">
            <div><p className="eyebrow">{copy.progress.journalKicker}</p><h2 id="history-title">{copy.progress.workoutHistory}</h2></div>
            <span>{copy.progress.sessions(sessions.length)}</span>
          </div>

          {history.length === 0 ? (
            <div className="progress-empty-state">
              <AppIcon name="history" size={43} strokeWidth={1.6} />
              <strong>{copy.progress.emptyTitle}</strong>
              <p>{copy.progress.emptyBody}</p>
              <button onClick={onTimers}>{copy.progress.chooseTimer}</button>
            </div>
          ) : (
            <div className="history-months">
              {history.map((month) => (
                <section className="history-month" key={month.key}>
                  <header className="history-month-header">
                    <strong>{month.label}</strong>
                    <span>{formatDuration(month.totalSeconds, copy)}</span>
                  </header>
                  <div className="history-days">
                    {month.days.map((day) => (
                      <article className="history-day" key={day.key}>
                        <header><strong>{day.label}</strong><span>{formatDuration(day.totalSeconds, copy)}</span></header>
                        <div className="history-sessions">
                          {day.sessions.map((session) => {
                            const timerName = sessionTimerName(session);
                            const stopped = session.status === 'stopped';
                            return <div className={`history-session${stopped ? ' partial-session' : ''}`} key={session.id}>
                              <span className="history-session-mark" aria-hidden="true" />
                              <div>
                                <div className="history-session-title">
                                  <strong>{timerName}</strong>
                                  {stopped && <span>{copy.progress.partialSession}</span>}
                                </div>
                                <small>{copy.progress.trainingAndActive(formatDuration(session.totalSeconds, copy), formatDuration(session.activeWorkSeconds, copy))}</small>
                              </div>
                              <div className="history-session-meta">
                                <span>{stopped
                                  ? copy.progress.intervalProgress(session.completedWorkIntervals, session.plannedWorkIntervals)
                                  : copy.progress.roundsAndCycles(session.rounds, session.cycles)}</span>
                                <button onClick={() => onDeleteSession(session.id)} aria-label={copy.progress.deleteFromHistory(timerName)}>{copy.progress.delete}</button>
                              </div>
                            </div>;
                          })}
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

      <nav className="bottom-nav" aria-label={copy.common.primaryNavigation}>
        <button className="nav-item" onClick={onHome}><AppIcon name="home" />{copy.common.home}</button>
        <button className="nav-item" onClick={onTimers}><AppIcon name="timer" />{copy.common.timers}</button>
        <button className="nav-item active"><AppIcon name="progress" />{copy.common.progress}</button>
        <button className="nav-item" onClick={onSettings}><AppIcon name="settings" />{copy.common.settings}</button>
      </nav>
    </main>
  );
}
