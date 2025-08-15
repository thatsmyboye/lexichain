import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { User } from '@supabase/supabase-js';
import { ArrowLeft, Trophy, Target, Clock, Zap, Medal } from "lucide-react";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalSelector } from "@/components/goals/GoalSelector";
import { useGoals } from "@/hooks/useGoals";

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
  
  const { 
    activeGoals, 
    completedGoals, 
    gameStats, 
    loading: goalsLoading, 
    addGoal, 
    dismissGoal 
  } = useGoals(user);

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
      
      // Fetch achievement counts
      await fetchAchievementCounts(session.user.id);
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
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Daily challenges</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Highest points</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">0</div>
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
      </div>
    </div>
  );
};

export default StatsPage;