import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flag, Clock, Zap, Trophy, ArrowLeft } from 'lucide-react';

interface MiniMarathonProps {
  onBack: () => void;
}

export function MiniMarathon({ onBack }: MiniMarathonProps) {
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <div className="container mx-auto max-w-4xl">
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
              <Flag className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
                  Daily Mini-Marathon
                </h1>
                <p className="text-muted-foreground">{today}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon Card */}
        <Card className="border-brand-500/20 bg-gradient-to-br from-card/80 to-muted/30 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Zap className="h-6 w-6 text-yellow-500" />
                  Quick Daily Challenge
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  Three fast-paced boards with connected scoring
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
                <Flag className="h-5 w-5 text-primary" />
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>3 Sequential Boards:</strong> Each board is a fresh challenge</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>5 Moves Each:</strong> Quick decision-making required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>60-Second Timer:</strong> Beat the clock on each board</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Combo Carry-Over:</strong> Your board 1 performance boosts board 2 multiplier!</span>
                </li>
              </ul>
            </div>

            {/* Scoring System */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Trophy className="h-5 w-5" />
                Scoring & Rewards
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="font-medium text-primary mb-1">Grading Tiers</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>🥉 Bronze: 2,500 pts</li>
                    <li>🥈 Silver: 4,000 pts</li>
                    <li>🥇 Gold: 6,500 pts</li>
                    <li>💎 Platinum: 10,000 pts</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-primary mb-1">Multipliers</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>XP: <strong>1.5x</strong></li>
                    <li>Score: <strong>1.2x</strong></li>
                    <li>Time: <strong>5-7 minutes</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Key Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Clock className="h-8 w-8 text-orange-500 mb-2" />
                <h4 className="font-semibold text-sm">Quick Play</h4>
                <p className="text-xs text-muted-foreground mt-1">Perfect for lunch breaks</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Zap className="h-8 w-8 text-yellow-500 mb-2" />
                <h4 className="font-semibold text-sm">Combo System</h4>
                <p className="text-xs text-muted-foreground mt-1">Multipliers carry between boards</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Trophy className="h-8 w-8 text-purple-500 mb-2" />
                <h4 className="font-semibold text-sm">Daily Leaderboard</h4>
                <p className="text-xs text-muted-foreground mt-1">Compete with other players</p>
              </div>
            </div>

            {/* Status Message */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg text-center">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                🚧 This mode is currently in development. Check back soon for the full experience!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MiniMarathon;
