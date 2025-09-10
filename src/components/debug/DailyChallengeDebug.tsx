import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getDailyChallengeDate, formatDateForChallenge, validateChallengeDate } from '@/utils/dateUtils';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { useOfflineSync } from '@/hooks/useOfflineSync';

interface DebugInfo {
  localTime: string;
  easternTime: string;
  challengeDate: string;
  userTimezone: string;
  backupResults: any[];
  networkStatus: boolean;
}

export function DailyChallengeDebug() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [userResults, setUserResults] = useState<any[]>([]);
  const { syncBackupResults } = useOfflineSync();
  const [user, setUser] = useState<any>(null);

  const refreshDebugInfo = () => {
    const now = new Date();
    const easternTime = toZonedTime(now, 'America/New_York');
    const challengeDate = getDailyChallengeDate();
    
    // Get backup results from localStorage
    const backupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('daily-challenge-result-backup-'));
    const backupResults = backupKeys.map(key => {
      try {
        return { key, data: JSON.parse(localStorage.getItem(key) || '{}') };
      } catch {
        return { key, data: null };
      }
    });

    setDebugInfo({
      localTime: now.toISOString(),
      easternTime: format(easternTime, 'yyyy-MM-dd HH:mm:ss zzz'),
      challengeDate,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      backupResults,
      networkStatus: navigator.onLine
    });
  };

  const fetchLeaderboardData = async () => {
    if (!user) return;
    
    try {
      const challengeDate = getDailyChallengeDate();
      const { data, error } = await supabase
        .rpc('get_daily_leaderboard', { challenge_date: challengeDate });
      
      if (error) throw error;
      setLeaderboardData(data || []);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    }
  };

  const fetchUserResults = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('daily_challenge_results')
        .select('*')
        .eq('user_id', user.id)
        .order('challenge_date', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setUserResults(data || []);
    } catch (error) {
      console.error('Failed to fetch user results:', error);
    }
  };

  useEffect(() => {
    refreshDebugInfo();
    
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const interval = setInterval(refreshDebugInfo, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user) {
      fetchLeaderboardData();
      fetchUserResults();
    }
  }, [user]);

  const clearBackupResults = () => {
    const backupKeys = Object.keys(localStorage)
      .filter(key => key.startsWith('daily-challenge-result-backup-'));
    
    backupKeys.forEach(key => localStorage.removeItem(key));
    refreshDebugInfo();
  };

  const testTimezoneConsistency = () => {
    const dates = [
      new Date(), 
      new Date('2025-01-01T00:00:00Z'),
      new Date('2025-06-01T00:00:00Z'),
      new Date('2025-12-31T23:59:59Z')
    ];

    console.group('🕐 Timezone Consistency Test');
    dates.forEach(date => {
      const challengeDate = formatDateForChallenge(date);
      const isValid = validateChallengeDate(challengeDate);
      console.log(`Date: ${date.toISOString()} -> Challenge: ${challengeDate}, Valid: ${isValid}`);
    });
    console.groupEnd();
  };

  if (!debugInfo) return <div>Loading debug info...</div>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🐛 Daily Challenge Debug Panel
            <div className="flex gap-2">
              <Button size="sm" onClick={refreshDebugInfo}>
                Refresh
              </Button>
              <Button size="sm" onClick={testTimezoneConsistency}>
                Test Timezones
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timezone Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">⏰ Time & Timezone Info</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div><strong>Local Time:</strong> {debugInfo.localTime}</div>
                <div><strong>Eastern Time:</strong> {debugInfo.easternTime}</div>
                <div><strong>Challenge Date:</strong> 
                  <Badge className="ml-2">{debugInfo.challengeDate}</Badge>
                </div>
                <div><strong>User Timezone:</strong> {debugInfo.userTimezone}</div>
                <div><strong>Network:</strong> 
                  <Badge variant={debugInfo.networkStatus ? "default" : "destructive"} className="ml-2">
                    {debugInfo.networkStatus ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Backup Results */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  💾 Backup Results ({debugInfo.backupResults.length})
                  {debugInfo.backupResults.length > 0 && (
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => syncBackupResults()}>
                        Sync Now
                      </Button>
                      <Button size="sm" variant="destructive" onClick={clearBackupResults}>
                        Clear
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                {debugInfo.backupResults.length === 0 ? (
                  <p className="text-muted-foreground">No backup results found</p>
                ) : (
                  <div className="space-y-2">
                    {debugInfo.backupResults.map((backup, i) => (
                      <div key={i} className="p-2 border rounded">
                        <div><strong>Date:</strong> {backup.data?.challenge_date}</div>
                        <div><strong>Score:</strong> {backup.data?.score}</div>
                        <div><strong>Synced:</strong> {backup.data?.synced ? 'Yes' : 'No'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* User Results */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  📊 Recent User Results
                  <Button size="sm" onClick={fetchUserResults}>Refresh</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {userResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No results found</p>
                ) : (
                  <div className="space-y-2">
                    {userResults.map((result) => (
                      <div key={result.id} className="flex justify-between items-center p-2 border rounded text-sm">
                        <span>{result.challenge_date}</span>
                        <span className="font-medium">{result.score} pts</span>
                        <Badge variant="outline">{result.achievement_level}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Current Leaderboard */}
          {user && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  🏆 Today's Leaderboard (Top 5)
                  <Button size="sm" onClick={fetchLeaderboardData}>Refresh</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {leaderboardData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No leaderboard data</p>
                ) : (
                  <div className="space-y-2">
                    {leaderboardData.slice(0, 5).map((entry) => (
                      <div 
                        key={entry.user_id} 
                        className={`flex justify-between items-center p-2 border rounded text-sm ${
                          entry.user_id === user?.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Badge variant="outline">#{entry.rank}</Badge>
                          {entry.display_name}
                          {entry.user_id === user?.id && <span className="text-xs">(You)</span>}
                        </span>
                        <span className="font-medium">{entry.score} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}