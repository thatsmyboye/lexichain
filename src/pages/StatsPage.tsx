import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import { ArrowLeft, Trophy, Target, Clock, Zap, Medal, Trash2 } from "lucide-react";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalSelector } from "@/components/goals/GoalSelector";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/hooks/use-toast";

const StatsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [achievementCounts, setAchievementCounts] = useState({
    Bronze: 0,
    Silver: 0,
    Gold: 0,
    Platinum: 0
  });
  
  const [dailyStats, setDailyStats] = useState({
    totalChallenges: 0,
    bestScore: 0,
    currentStreak: 0
  });
  
  const { 
    activeGoals, 
    completedGoals, 
    gameStats, 
    loading: goalsLoading, 
    addGoal, 
    dismissGoal 
  } = useGoals(user);

  const { toast } = useToast();

  const fetchAchievementCounts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_challenge_results')
        .select('achievement_level')
        .eq('user_id', userId)
        .neq('achievement_level', 'None');

      if (error) {
        console.error('Error fetching achievement counts:', error);
        return;
      }

      const counts = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 };
      data?.forEach((result) => {
        if (result.achievement_level in counts) {
          counts[result.achievement_level as keyof typeof counts]++;
        }
      });

      setAchievementCounts(counts);
    } catch (error) {
      console.error('Error fetching achievement counts:', error);
    }
  };

  const fetchDailyStats = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('daily_challenge_results')
        .select('score, achievement_level, challenge_date')
        .eq('user_id', userId)
        .order('challenge_date', { ascending: false });

      if (error) {
        console.error('Error fetching daily stats:', error);
        return;
      }

      const totalChallenges = data?.length || 0;
      const bestScore = Math.max(...(data?.map(d => d.score) || [0]), 0);
      
      // Calculate current streak (consecutive days with any achievement)
      let currentStreak = 0;
      if (data && data.length > 0) {
        for (const result of data) {
          if (result.achievement_level !== 'None') {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      setDailyStats({ totalChallenges, bestScore, currentStreak });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
    }
  };

  const handleResetStats = async () => {
    if (!user) return;

    try {
      // First get all goal IDs for this user to delete related progress
      const { data: userGoals } = await supabase
        .from('player_goals')
        .select('id')
        .eq('user_id', user.id);

      // Delete goal progress first if there are goals
      if (userGoals && userGoals.length > 0) {
        const goalIds = userGoals.map(goal => goal.id);
        await supabase
          .from('goal_progress')
          .delete()
          .in('goal_id', goalIds);
      }

      // Delete all user data from all tables
      const deletePromises = [
        supabase.from('standard_game_results').delete().eq('user_id', user.id),
        supabase.from('daily_challenge_results').delete().eq('user_id', user.id),
        supabase.from('player_goals').delete().eq('user_id', user.id)
      ];

      // Execute all delete operations
      await Promise.all(deletePromises);

      // Reset local state
      setAchievementCounts({ Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 });

      toast({
        title: "Stats Reset Complete",
        description: "All your stats have been successfully reset to 0.",
      });

      // Refresh the page to reload all data
      window.location.reload();
    } catch (error) {
      console.error('Error resetting stats:', error);
      toast({
        title: "Error",
        description: "Failed to reset stats. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    document.title = "Your Stats | Lexichain";
    
    // Check authentication and get user
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      
      // Fetch achievement counts and daily stats
      await Promise.all([
        fetchAchievementCounts(session.user.id),
        fetchDailyStats(session.user.id)
      ]);
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Game
          </Button>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Your Stats
          </h1>
        </div>

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">Standard Games</TabsTrigger>
            <TabsTrigger value="daily">Daily Challenges</TabsTrigger>
          </TabsList>
          
          <TabsContent value="standard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Games</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{gameStats.totalGames}</div>
                  <p className="text-xs text-muted-foreground">Games played</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{gameStats.highestScore}</div>
                  <p className="text-xs text-muted-foreground">Highest points</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Longest Word</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{gameStats.longestWord}</div>
                  <p className="text-xs text-muted-foreground">Letters</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Time</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{gameStats.totalScore.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Total score</p>
                </CardContent>
              </Card>
            </div>

            {/* Goals Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Your Goals</h3>
                <GoalSelector 
                  activeGoals={activeGoals}
                  completedGoals={completedGoals}
                  onAddGoal={addGoal}
                />
              </div>
              
              {activeGoals.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Active Goals</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        onDismiss={dismissGoal}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {completedGoals.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Completed Goals</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {completedGoals.slice(0, 6).map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        showDismiss={false}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {activeGoals.length === 0 && completedGoals.length === 0 && !goalsLoading && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No goals yet</p>
                      <p className="text-sm">Goals will be automatically set up when you start playing</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Game History</CardTitle>
                <CardDescription>
                  Your recent standard game sessions will appear here once you start playing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No standard games played yet</p>
                  <p className="text-sm">Start playing to see your stats!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="daily" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Challenges Played</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dailyStats.totalChallenges}</div>
                  <p className="text-xs text-muted-foreground">Daily challenges</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dailyStats.bestScore}</div>
                  <p className="text-xs text-muted-foreground">Highest points</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dailyStats.currentStreak}</div>
                  <p className="text-xs text-muted-foreground">Days in a row</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Achievements</CardTitle>
                  <Medal className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{achievementCounts.Bronze + achievementCounts.Silver + achievementCounts.Gold + achievementCounts.Platinum}</div>
                  <p className="text-xs text-muted-foreground">Achievements earned</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5" />
                  Achievement Breakdown
                </CardTitle>
                <CardDescription>
                  Your achievement counts in daily challenges
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20">
                    <div className="text-2xl font-bold text-orange-600">{achievementCounts.Bronze}</div>
                    <p className="text-sm text-muted-foreground">Bronze</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-gray-400/10 to-gray-500/10 border border-gray-400/20">
                    <div className="text-2xl font-bold text-gray-600">{achievementCounts.Silver}</div>
                    <p className="text-sm text-muted-foreground">Silver</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20">
                    <div className="text-2xl font-bold text-yellow-600">{achievementCounts.Gold}</div>
                    <p className="text-sm text-muted-foreground">Gold</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-600">{achievementCounts.Platinum}</div>
                    <p className="text-sm text-muted-foreground">Platinum</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Challenge History</CardTitle>
                <CardDescription>
                  Your recent daily challenge results will appear here once you start playing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <Medal className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No daily challenges played yet</p>
                  <p className="text-sm">Complete a daily challenge to see your results!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reset Stats Section */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="text-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="lg"
                  className="bg-destructive hover:bg-destructive-hover text-destructive-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Reset All Stats
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Stats</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure? This will erase ALL of your stats including game results, achievements, goals, and progress. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleResetStats}
                    className="bg-destructive hover:bg-destructive-hover text-destructive-foreground"
                  >
                    Confirm Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPage;