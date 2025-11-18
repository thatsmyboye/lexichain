import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Gamepad2, Trophy, TrendingUp, Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface SystemStats {
  totalUsers: number;
  totalGames: number;
  totalDailyChallenges: number;
  totalPuzzles: number;
  totalConsumables: number;
  recentUsers: number; // Last 7 days
  recentGames: number; // Last 7 days
  topScore: number;
  averageScore: number;
}

export function SystemOverview() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all stats in parallel
      const [
        profilesResult,
        gamesResult,
        dailyChallengesResult,
        puzzlesResult,
        consumablesResult,
        recentUsersResult,
        recentGamesResult,
        topScoreResult,
        avgScoreResult
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('standard_game_results').select('id', { count: 'exact', head: true }),
        supabase.from('daily_challenge_results').select('id', { count: 'exact', head: true }),
        supabase.from('puzzle_completions').select('id', { count: 'exact', head: true }),
        supabase.from('user_consumables').select('id', { count: 'exact', head: true }),
        supabase.from('profiles')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('standard_game_results')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('standard_game_results').select('score').order('score', { ascending: false }).limit(1).single(),
        supabase.from('standard_game_results').select('score')
      ]);

      const topScore = topScoreResult.data?.score || 0;
      const allScores = avgScoreResult.data || [];
      const averageScore = allScores.length > 0
        ? Math.round(allScores.reduce((sum, r) => sum + (r.score || 0), 0) / allScores.length)
        : 0;

      setStats({
        totalUsers: profilesResult.count || 0,
        totalGames: gamesResult.count || 0,
        totalDailyChallenges: dailyChallengesResult.count || 0,
        totalPuzzles: puzzlesResult.count || 0,
        totalConsumables: consumablesResult.count || 0,
        recentUsers: recentUsersResult.count || 0,
        recentGames: recentGamesResult.count || 0,
        topScore,
        averageScore
      });
    } catch (error) {
      console.error('Error fetching system stats:', error);
      toast.error('Failed to load system statistics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                System Overview
              </CardTitle>
              <CardDescription>
                Real-time statistics and metrics for the Lexichain platform
              </CardDescription>
            </div>
            <Button onClick={fetchStats} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.recentUsers || 0} new (7d)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Games
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.totalGames || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.recentGames || 0} recent (7d)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Daily Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Trophy className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.totalDailyChallenges || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Completed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Puzzles Solved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Database className="h-8 w-8 text-primary" />
                  <div>
                    <div className="text-2xl font-bold">{stats?.totalPuzzles || 0}</div>
                    <p className="text-xs text-muted-foreground">
                      Completions
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Top Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">{stats?.topScore || 0}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Average Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">{stats?.averageScore || 0}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Consumables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Database className="h-6 w-6 text-primary" />
                  <div className="text-2xl font-bold">{stats?.totalConsumables || 0}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

