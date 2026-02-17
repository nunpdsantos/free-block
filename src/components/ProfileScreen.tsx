import { useState } from 'react';
import type { User } from 'firebase/auth';
import type { PlayerStats, AchievementProgress, DailyStreak, GlobalLeaderboardEntry, PlayerRankInfo } from '../game/types';
import { StatsContent } from './StatsScreen';
import { AchievementsContent } from './AchievementsScreen';
import { LeaderboardContent } from './Leaderboard';
import { AuthStrip } from './AuthStrip';
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
  globalLeaderboard: GlobalLeaderboardEntry[];
  playerRank: PlayerRankInfo | null;
  leaderboardMode: 'classic' | 'daily';
  leaderboardLoading: boolean;
  onLeaderboardModeChange: (mode: 'classic' | 'daily') => void;
  currentUid: string | null;
  authUser: User | null;
  authDisplayName: string | null;
  authLoading: boolean;
  onSignIn: () => void;
  onUpdateDisplayName: (name: string) => Promise<void>;
  onLeaderboardRefresh: () => void;
  onBack: () => void;
};

export function ProfileScreen({
  stats,
  achievementProgress,
  dailyStreak,
  dailyCount,
  globalLeaderboard,
  playerRank,
  leaderboardMode,
  leaderboardLoading,
  onLeaderboardModeChange,
  currentUid,
  authUser,
  authDisplayName,
  authLoading,
  onSignIn,
  onUpdateDisplayName,
  onLeaderboardRefresh,
  onBack,
}: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  return (
    <div className="profile-screen">
      <h2 className="profile-title">Profile</h2>

      <AuthStrip
        user={authUser}
        displayName={authDisplayName}
        loading={authLoading}
        onSignIn={onSignIn}
        onUpdateDisplayName={onUpdateDisplayName}
      />

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
          <LeaderboardContent
            globalEntries={globalLeaderboard}
            playerRank={playerRank}
            globalMode={leaderboardMode}
            globalLoading={leaderboardLoading}
            onGlobalModeChange={onLeaderboardModeChange}
            currentUid={currentUid}
            onRefresh={onLeaderboardRefresh}
          />
        )}
      </div>

      <button className="menu-btn menu-btn--secondary profile-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  );
}
