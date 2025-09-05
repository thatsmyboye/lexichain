import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toZonedTime, format } from 'date-fns-tz';

interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  score: number;
  rank: number;
}

interface DailyChallengeLeaderboardProps {
  currentUser?: any;
}

export function DailyChallengeLeaderboard({ currentUser }: DailyChallengeLeaderboardProps) {
  const [dailyLeaderboard, setDailyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyLeaderboard, setMonthlyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("day");

  const easternTimeZone = 'America/New_York';
  const today = format(toZonedTime(new Date(), easternTimeZone), 'yyyy-MM-dd');

  const fetchLeaderboards = async () => {
    setLoading(true);
    try {
      // Get daily leaderboard
      const { data: dailyData, error: dailyError } = await supabase
        .rpc('get_daily_leaderboard', { challenge_date: today });

      if (dailyError) throw dailyError;
      setDailyLeaderboard(dailyData || []);

      // Get weekly leaderboard
      const { data: weekStartData, error: weekStartError } = await supabase
        .rpc('get_week_start', { input_date: today });

      if (weekStartError) throw weekStartError;

      const { data: weeklyData, error: weeklyError } = await supabase
        .rpc('get_weekly_leaderboard', { week_start: weekStartData });

      if (weeklyError) throw weeklyError;
      setWeeklyLeaderboard(weeklyData?.map(entry => ({ 
        ...entry, 
        score: entry.best_score 
      })) || []);

      // Get monthly leaderboard
      const currentDate = new Date();
      const { data: monthlyData, error: monthlyError } = await supabase
        .rpc('get_monthly_leaderboard', { 
          year: currentDate.getFullYear(), 
          month: currentDate.getMonth() + 1 
        });

      if (monthlyError) throw monthlyError;
      setMonthlyLeaderboard(monthlyData?.map(entry => ({ 
        ...entry, 
        score: entry.best_score 
      })) || []);

    } catch (error) {
      console.error('Error fetching leaderboards:', error);
      toast({
        title: "Error loading leaderboards",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboards();
  }, [today]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  const getRankBadgeVariant = (rank: number) => {
    if (rank <= 3) return "default";
    if (rank <= 10) return "secondary";
    return "outline";
  };

  const renderLeaderboard = (data: LeaderboardEntry[], title: string) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>No scores yet for this {title.toLowerCase()}.</p>
          <p className="text-sm mt-2">Play Daily Challenge to appear on the leaderboard!</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {data.map((entry) => {
          const isCurrentUser = currentUser && entry.user_id === currentUser.id;
          return (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                isCurrentUser 
                  ? "bg-primary/10 border-primary/20" 
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-[60px]">
                {getRankIcon(entry.rank)}
                <Badge variant={getRankBadgeVariant(entry.rank)}>
                  #{entry.rank}
                </Badge>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${
                  isCurrentUser ? "text-primary" : ""
                }`}>
                  {entry.display_name}
                  {isCurrentUser && <span className="text-xs ml-2">(You)</span>}
                </p>
              </div>
              
              <div className="text-right">
                <p className="font-bold text-lg">{entry.score.toLocaleString()}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Daily Challenge Leaderboard
        </CardTitle>
        <CardDescription>
          Compete with players worldwide in the Daily Challenge
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
          
          <TabsContent value="day" className="mt-4">
            {renderLeaderboard(dailyLeaderboard, "Day")}
          </TabsContent>
          
          <TabsContent value="week" className="mt-4">
            {renderLeaderboard(weeklyLeaderboard, "Week")}
          </TabsContent>
          
          <TabsContent value="month" className="mt-4">
            {renderLeaderboard(monthlyLeaderboard, "Month")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}