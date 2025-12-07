import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sword, Calendar, Trophy, Star, ArrowLeft, CheckCircle } from 'lucide-react';
import { getWeekIdentifier } from '@/hooks/useWeeklyGauntletState';

interface WeeklyGauntletProps {
  onBack: () => void;
}

export function WeeklyGauntlet({ onBack }: WeeklyGauntletProps) {
  const weekId = getWeekIdentifier();

  const dailyThemes = [
    { day: 'Monday', theme: 'Fresh Start', constraint: 'Standard rules', color: 'bg-blue-500' },
    { day: 'Tuesday', theme: 'Vowel Valley', constraint: '50%+ vowels required', color: 'bg-green-500' },
    { day: 'Wednesday', theme: 'Consonant Crush', constraint: '50%+ consonants required', color: 'bg-purple-500' },
    { day: 'Thursday', theme: 'Rarity Raid', constraint: 'Rare letters (J,Q,X,Z,K,V,W,Y)', color: 'bg-yellow-500' },
    { day: 'Friday', theme: 'Length Challenge', constraint: '5+ letter words only', color: 'bg-orange-500' },
    { day: 'Saturday', theme: 'Speed Run', constraint: '60s timer', color: 'bg-red-500' },
    { day: 'Sunday', theme: 'Boss Battle', constraint: 'Expert board, 5000+ pts required', color: 'bg-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <Sword className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
                  Weekly Gauntlet
                </h1>
                <p className="text-muted-foreground">{weekId}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-brand-500/20 bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm shadow-lg mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Calendar className="h-6 w-6 text-purple-500" />
                  7-Day Challenge Series
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  Complete all 7 daily puzzles for maximum rewards
                </CardDescription>
              </div>
              <Badge className="bg-brand-500/10 text-brand-600 border-brand-500/20">
                Coming Soon
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode Overview */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Sword className="h-5 w-5 text-primary" />
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>7 Unique Puzzles:</strong> One unlocks each day (Monday-Sunday)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Daily Themes:</strong> Each day has its own constraint and challenge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Play in Any Order:</strong> Complete puzzles at your own pace</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Completion Bonus:</strong> Finish all 7 for 1.5x multiplier + 1000 bonus points!</span>
                </li>
              </ul>
            </div>

            {/* Daily Themes Grid */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Daily Themes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyThemes.map((theme, index) => (
                  <Card key={theme.day} className="border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${theme.color}`} />
                        <CardTitle className="text-sm">{theme.day}</CardTitle>
                      </div>
                      <CardDescription className="text-xs font-semibold text-primary">
                        {theme.theme}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{theme.constraint}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Rewards */}
            <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Trophy className="h-5 w-5" />
                Rewards & Grading
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-primary mb-2">Weekly Tiers</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>🥉 Bronze: 15,000 pts</li>
                    <li>🥈 Silver: 25,000 pts</li>
                    <li>🥇 Gold: 40,000 pts</li>
                    <li>💎 Platinum: 65,000 pts</li>
                    <li>💠 Diamond: 100,000 pts (NEW!)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-primary mb-2">Multipliers & XP</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>XP: <strong>2.5x</strong> (highest!)</li>
                    <li>Score: <strong>1.8x</strong></li>
                    <li>Completion: <strong>1.5x</strong> (all 7)</li>
                    <li>Bonus: <strong>+1000 pts</strong> (all 7)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg text-center">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                🚧 This mode is currently in development. The full weekly challenge system will launch soon!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WeeklyGauntlet;
