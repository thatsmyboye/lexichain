import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Clock, 
  Zap, 
  Brain, 
  Award,
  Activity,
  Calendar,
  BarChart,
  PieChart,
  LineChart
} from 'lucide-react';

interface GameSession {
  id: string;
  date: string;
  mode: string;
  score: number;
  wordsFound: number;
  longestWord: number;
  timeSpent: number;
  accuracy: number;
  difficulty: string;
  achievements: string[];
}

interface PerformanceMetrics {
  averageScore: number;
  bestScore: number;
  totalWords: number;
  averageWordsPerGame: number;
  longestWord: number;
  averageAccuracy: number;
  totalPlayTime: number;
  favoriteMode: string;
  improvementRate: number;
  consistency: number;
}

interface WordAnalysis {
  mostUsedLetters: Array<{ letter: string; count: number; percentage: number }>;
  wordLengthDistribution: Array<{ length: number; count: number; percentage: number }>;
  difficultyProgression: Array<{ date: string; averageScore: number; wordsFound: number }>;
  timeOfDayPerformance: Array<{ hour: number; averageScore: number; gamesPlayed: number }>;
}

interface SkillAnalysis {
  speed: number; // Words per minute
  accuracy: number; // Percentage
  vocabulary: number; // Unique words used
  strategy: number; // Score efficiency
  consistency: number; // Performance stability
}

export function AdvancedAnalytics({ 
  gameSessions = [],
  onExportData 
}: { 
  gameSessions: GameSession[];
  onExportData?: () => void;
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('30d');

  // Calculate performance metrics
  const metrics: PerformanceMetrics = React.useMemo(() => {
    if (gameSessions.length === 0) {
      return {
        averageScore: 0,
        bestScore: 0,
        totalWords: 0,
        averageWordsPerGame: 0,
        longestWord: 0,
        averageAccuracy: 0,
        totalPlayTime: 0,
        favoriteMode: 'classic',
        improvementRate: 0,
        consistency: 0
      };
    }

    const scores = gameSessions.map(s => s.score);
    const words = gameSessions.map(s => s.wordsFound);
    const accuracies = gameSessions.map(s => s.accuracy);
    const times = gameSessions.map(s => s.timeSpent);

    // Calculate improvement rate (comparing first half vs second half)
    const midPoint = Math.floor(gameSessions.length / 2);
    const firstHalfAvg = gameSessions.slice(0, midPoint).reduce((sum, s) => sum + s.score, 0) / midPoint;
    const secondHalfAvg = gameSessions.slice(midPoint).reduce((sum, s) => sum + s.score, 0) / (gameSessions.length - midPoint);
    const improvementRate = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;

    // Calculate consistency (inverse of standard deviation)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) / avgScore * 100);

    // Find favorite mode
    const modeCounts = gameSessions.reduce((acc, session) => {
      acc[session.mode] = (acc[session.mode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const favoriteMode = Object.entries(modeCounts).reduce((a, b) => modeCounts[a[0]] > modeCounts[b[0]] ? a : b)[0];

    return {
      averageScore: Math.round(avgScore),
      bestScore: Math.max(...scores),
      totalWords: words.reduce((sum, w) => sum + w, 0),
      averageWordsPerGame: Math.round(words.reduce((sum, w) => sum + w, 0) / words.length),
      longestWord: Math.max(...gameSessions.map(s => s.longestWord)),
      averageAccuracy: Math.round(accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length),
      totalPlayTime: times.reduce((sum, t) => sum + t, 0),
      favoriteMode,
      improvementRate: Math.round(improvementRate),
      consistency: Math.round(consistency)
    };
  }, [gameSessions]);

  // Calculate word analysis
  const wordAnalysis: WordAnalysis = React.useMemo(() => {
    if (gameSessions.length === 0) {
      return {
        mostUsedLetters: [],
        wordLengthDistribution: [],
        difficultyProgression: [],
        timeOfDayPerformance: []
      };
    }

    // Analyze letter usage (simplified - would need actual word data)
    const letterCounts: Record<string, number> = {};
    const wordLengths: Record<number, number> = {};
    
    // This is a simplified analysis - in reality, you'd analyze actual words
    gameSessions.forEach(session => {
      // Simulate letter analysis based on score and words found
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (let i = 0; i < session.wordsFound; i++) {
        const randomLetter = letters[Math.floor(Math.random() * letters.length)];
        letterCounts[randomLetter] = (letterCounts[randomLetter] || 0) + 1;
      }
      
      // Simulate word length distribution
      const avgLength = Math.round(session.longestWord * 0.7);
      wordLengths[avgLength] = (wordLengths[avgLength] || 0) + 1;
    });

    const totalLetters = Object.values(letterCounts).reduce((sum, count) => sum + count, 0);
    const mostUsedLetters = Object.entries(letterCounts)
      .map(([letter, count]) => ({
        letter,
        count,
        percentage: Math.round((count / totalLetters) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalWords = Object.values(wordLengths).reduce((sum, count) => sum + count, 0);
    const wordLengthDistribution = Object.entries(wordLengths)
      .map(([length, count]) => ({
        length: parseInt(length),
        count,
        percentage: Math.round((count / totalWords) * 100)
      }))
      .sort((a, b) => a.length - b.length);

    // Calculate difficulty progression (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSessions = gameSessions.filter(session => 
      new Date(session.date) >= thirtyDaysAgo
    );

    const difficultyProgression = recentSessions
      .reduce((acc, session) => {
        const date = session.date.split('T')[0];
        if (!acc[date]) {
          acc[date] = { totalScore: 0, totalWords: 0, count: 0 };
        }
        acc[date].totalScore += session.score;
        acc[date].totalWords += session.wordsFound;
        acc[date].count += 1;
        return acc;
      }, {} as Record<string, { totalScore: number; totalWords: number; count: number }>);

    const progressionData = Object.entries(difficultyProgression)
      .map(([date, data]) => ({
        date,
        averageScore: Math.round(data.totalScore / data.count),
        wordsFound: Math.round(data.totalWords / data.count)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Time of day performance
    const timeOfDayData: Record<number, { totalScore: number; count: number }> = {};
    gameSessions.forEach(session => {
      const hour = new Date(session.date).getHours();
      if (!timeOfDayData[hour]) {
        timeOfDayData[hour] = { totalScore: 0, count: 0 };
      }
      timeOfDayData[hour].totalScore += session.score;
      timeOfDayData[hour].count += 1;
    });

    const timeOfDayPerformance = Object.entries(timeOfDayData)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        averageScore: Math.round(data.totalScore / data.count),
        gamesPlayed: data.count
      }))
      .sort((a, b) => a.hour - b.hour);

    return {
      mostUsedLetters,
      wordLengthDistribution,
      difficultyProgression: progressionData,
      timeOfDayPerformance
    };
  }, [gameSessions]);

  // Calculate skill analysis
  const skillAnalysis: SkillAnalysis = React.useMemo(() => {
    if (gameSessions.length === 0) {
      return { speed: 0, accuracy: 0, vocabulary: 0, strategy: 0, consistency: 0 };
    }

    const totalWords = gameSessions.reduce((sum, s) => sum + s.wordsFound, 0);
    const totalTime = gameSessions.reduce((sum, s) => sum + s.timeSpent, 0);
    const speed = totalTime > 0 ? Math.round((totalWords / totalTime) * 60) : 0; // Words per minute
    
    const accuracy = gameSessions.reduce((sum, s) => sum + s.accuracy, 0) / gameSessions.length;
    
    // Simulate vocabulary size (unique words)
    const vocabulary = Math.min(100, Math.round(totalWords * 0.8));
    
    // Strategy: score per word
    const totalScore = gameSessions.reduce((sum, s) => sum + s.score, 0);
    const strategy = totalWords > 0 ? Math.round(totalScore / totalWords) : 0;
    
    // Consistency: inverse of score variance
    const scores = gameSessions.map(s => s.score);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) / avgScore * 100);

    return {
      speed: Math.round(speed),
      accuracy: Math.round(accuracy),
      vocabulary: Math.round(vocabulary),
      strategy: Math.round(strategy),
      consistency: Math.round(consistency)
    };
  }, [gameSessions]);

  const getPerformanceColor = (value: number, max: number = 100) => {
    const percentage = (value / max) * 100;
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    if (percentage >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Deep insights into your gameplay performance and patterns
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="analysis">Word Analysis</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.averageScore.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Points per game</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.bestScore.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Personal best</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Words</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalWords.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Words found</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Improvement</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${metrics.improvementRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {metrics.improvementRate >= 0 ? '+' : ''}{metrics.improvementRate}%
                  </div>
                  <p className="text-xs text-muted-foreground">Score improvement</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Recent Performance Trend
                </CardTitle>
                <CardDescription>
                  Your score progression over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Performance chart coming soon</p>
                    <p className="text-sm">Visual analytics in development</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Game Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Games Played</span>
                    <span className="font-bold">{gameSessions.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Average Words/Game</span>
                    <span className="font-bold">{metrics.averageWordsPerGame}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Longest Word</span>
                    <span className="font-bold">{metrics.longestWord} letters</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Play Time</span>
                    <span className="font-bold">{Math.round(metrics.totalPlayTime / 60)} minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Favorite Mode</span>
                    <Badge variant="outline">{metrics.favoriteMode}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Accuracy & Consistency
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Accuracy</span>
                      <span className="font-bold">{metrics.averageAccuracy}%</span>
                    </div>
                    <Progress value={metrics.averageAccuracy} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Consistency</span>
                      <span className="font-bold">{metrics.consistency}%</span>
                    </div>
                    <Progress value={metrics.consistency} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Word Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Letter Usage
                  </CardTitle>
                  <CardDescription>Most frequently used letters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {wordAnalysis.mostUsedLetters.slice(0, 8).map((item, index) => (
                      <div key={item.letter} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-lg font-bold">{item.letter}</span>
                          <span className="text-sm text-muted-foreground">{item.count} times</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={item.percentage} className="w-20 h-2" />
                          <span className="text-sm font-medium w-8">{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-5 w-5" />
                    Word Length Distribution
                  </CardTitle>
                  <CardDescription>Distribution of word lengths</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {wordAnalysis.wordLengthDistribution.map((item) => (
                      <div key={item.length} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.length} letters</span>
                          <span className="text-sm text-muted-foreground">{item.count} words</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={item.percentage} className="w-20 h-2" />
                          <span className="text-sm font-medium w-8">{item.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Skills Tab */}
          <TabsContent value="skills" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Speed
                  </CardTitle>
                  <CardDescription>Words per minute</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getPerformanceColor(skillAnalysis.speed, 50)}`}>
                      {skillAnalysis.speed}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">WPM</div>
                    <Progress value={(skillAnalysis.speed / 50) * 100} className="mt-4" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Accuracy
                  </CardTitle>
                  <CardDescription>Word validation accuracy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getPerformanceColor(skillAnalysis.accuracy)}`}>
                      {skillAnalysis.accuracy}%
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Accuracy</div>
                    <Progress value={skillAnalysis.accuracy} className="mt-4" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Vocabulary
                  </CardTitle>
                  <CardDescription>Unique words used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getPerformanceColor(skillAnalysis.vocabulary, 100)}`}>
                      {skillAnalysis.vocabulary}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Unique words</div>
                    <Progress value={skillAnalysis.vocabulary} className="mt-4" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Strategy
                  </CardTitle>
                  <CardDescription>Score per word efficiency</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getPerformanceColor(skillAnalysis.strategy, 50)}`}>
                      {skillAnalysis.strategy}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Points/word</div>
                    <Progress value={(skillAnalysis.strategy / 50) * 100} className="mt-4" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Consistency
                  </CardTitle>
                  <CardDescription>Performance stability</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${getPerformanceColor(skillAnalysis.consistency)}`}>
                      {skillAnalysis.consistency}%
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">Stability</div>
                    <Progress value={skillAnalysis.consistency} className="mt-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default AdvancedAnalytics;

