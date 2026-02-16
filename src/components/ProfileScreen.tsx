import { useState } from 'react';
import type { PlayerStats, AchievementProgress, DailyStreak, LeaderboardEntry } from '../game/types';
import { StatsContent } from './StatsScreen';
import { AchievementsContent } from './AchievementsScreen';
import { LeaderboardContent } from './Leaderboard';
import './ProfileScreen.css';

type Tab = 'stats' | 'achievements' | 'leaderboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'stats', label: 'Stats' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'leaderboard', label: 'Leaderboard' },
];

type ProfileScreenProps = {
  stats: PlayerStats;
  achievementProgress: AchievementProgress;
  dailyStreak: DailyStreak;
  dailyCount: number;
  leaderboard: LeaderboardEntry[];
  onBack: () => void;
};

export function ProfileScreen({ stats, achievementProgress, dailyStreak, dailyCount, leaderboard, onBack }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  return (
    <div className="profile-screen">
      <h2 className="profile-title">Profile</h2>

      <div className="profile-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`profile-tab ${activeTab === tab.id ? 'profile-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="profile-content">
        {activeTab === 'stats' && (
          <StatsContent stats={stats} />
        )}
        {activeTab === 'achievements' && (
          <AchievementsContent
            progress={achievementProgress}
            stats={stats}
            dailyStreak={dailyStreak}
            dailyCount={dailyCount}
          />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardContent entries={leaderboard} />
        )}
      </div>

      <button className="menu-btn menu-btn--secondary profile-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
