import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Infinity, Sparkles, Trophy, Award, ArrowLeft, Zap } from 'lucide-react';

interface PrestigeEndlessProps {
  onBack: () => void;
}

export function PrestigeEndless({ onBack }: PrestigeEndlessProps) {
  const buffExamples = [
    { name: 'Score Surge', effect: '+10% base score', rarity: 'common', color: 'bg-gray-500' },
    { name: 'Wild Spawn', effect: '+3% wild tile spawn', rarity: 'epic', color: 'bg-purple-500' },
    { name: 'Stone Breaker', effect: '-5% stone tile spawn', rarity: 'common', color: 'bg-gray-500' },
    { name: 'Multiplier Master', effect: '+15% special tile multipliers', rarity: 'rare', color: 'bg-blue-500' },
    { name: 'Extra Life', effect: '+1 life per 20 waves', rarity: 'epic', color: 'bg-purple-500' },
    { name: 'Stone Shield', effect: 'Free hammer each wave', rarity: 'legendary', color: 'bg-orange-500' },
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
              <TrendingUp className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))]">
                  Prestige Endless
                </h1>
                <p className="text-muted-foreground">Long-term meta-progression</p>
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
                  <Infinity className="h-6 w-6 text-blue-500" />
                  Enhanced Endless Mode
                </CardTitle>
                <CardDescription className="text-lg mt-2">
                  Persistent buffs, prestige system, and long-term progression
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
                <TrendingUp className="h-5 w-5 text-primary" />
                How It Works
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Endless Waves:</strong> Progress through increasingly difficult waves</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Buff System:</strong> Every 10 waves, choose 1 permanent buff from 3 options</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Prestige Mechanic:</strong> Reset after wave 50 for Prestige Points</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Prestige Shop:</strong> Unlock exclusive cosmetics and abilities</span>
                </li>
              </ul>
            </div>

            {/* Buff System */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Buff System (20+ Unique Buffs)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {buffExamples.map((buff, index) => (
                  <Card key={index} className="border-muted">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${buff.color}`} />
                        <CardTitle className="text-sm">{buff.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className="text-xs w-fit">
                        {buff.rarity}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">{buff.effect}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                ...and 14+ more buffs to discover!
              </p>
            </div>

            {/* Prestige System */}
            <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-pink-500/10 border border-orange-500/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <Award className="h-5 w-5" />
                Prestige System
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-primary mb-2">Prestige Rewards</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>Wave 50: <strong>100 PP</strong></li>
                    <li>Wave 75: <strong>150 PP</strong></li>
                    <li>Wave 100: <strong>250 PP</strong></li>
                    <li>Wave 150: <strong>400 PP</strong></li>
                    <li>Wave 200+: <strong>500+ PP</strong></li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-primary mb-2">Prestige Shop</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>🎨 Golden Tile Theme</li>
                    <li>✨ Prismatic Effects</li>
                    <li>🏆 Prestige Badges (P1-P10)</li>
                    <li>⚡ Prestige Aura (+5% XP)</li>
                    <li>💫 Second Chance (revive)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Leaderboards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Trophy className="h-8 w-8 text-yellow-500 mb-2" />
                <h4 className="font-semibold text-sm">Highest Wave</h4>
                <p className="text-xs text-muted-foreground mt-1">All-time leaderboard</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Zap className="h-8 w-8 text-blue-500 mb-2" />
                <h4 className="font-semibold text-sm">Speed Runs</h4>
                <p className="text-xs text-muted-foreground mt-1">Fastest to wave 50</p>
              </div>
              <div className="flex flex-col items-center text-center p-4 bg-muted/30 rounded-lg">
                <Award className="h-8 w-8 text-purple-500 mb-2" />
                <h4 className="font-semibold text-sm">Prestige Points</h4>
                <p className="text-xs text-muted-foreground mt-1">Total PP earned</p>
              </div>
            </div>

            {/* Multipliers */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
                Rewards & Multipliers
              </h3>
              <div className="flex items-center justify-around text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">3.5x</p>
                  <p className="text-xs text-muted-foreground">XP Multiplier</p>
                  <p className="text-xs text-green-600 dark:text-green-400">(Highest!)</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">2.5x</p>
                  <p className="text-xs text-muted-foreground">Score Multiplier</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">Expert</p>
                  <p className="text-xs text-muted-foreground">Difficulty</p>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg text-center">
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                🚧 This mode is currently in development. The full prestige system will launch soon!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PrestigeEndless;
