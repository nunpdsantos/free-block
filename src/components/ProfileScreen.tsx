import { useState } from 'react';
import type { User } from 'firebase/auth';
import type { PlayerStats, AchievementProgress, DailyStreak, LeaderboardEntry, GlobalLeaderboardEntry, PlayerRankInfo } from '../game/types';
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
  leaderboard: LeaderboardEntry[];
  globalLeaderboard: GlobalLeaderboardEntry[];
  playerRank: PlayerRankInfo | null;
  leaderboardLoading: boolean;
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
  leaderboard,
  globalLeaderboard,
  playerRank,
  leaderboardLoading,
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
          <StatsContent stats={stats} highScore={Math.max(leaderboard.length > 0 ? leaderboard[0].score : 0, playerRank?.score ?? 0)} />
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
            personalEntries={leaderboard}
            globalEntries={globalLeaderboard}
            playerRank={playerRank}
            globalLoading={leaderboardLoading}
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
