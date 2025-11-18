import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Gamepad2, Search, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

interface GameResult {
  id: string;
  user_id: string;
  score: number;
  words_found: number;
  longest_word: string | null;
  achievement_grade: string;
  created_at: string;
  display_name?: string;
}

export function GameDataManagement() {
  const [games, setGames] = useState<GameResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteGameId, setDeleteGameId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setIsLoading(true);
      
      // Fetch games
      const { data: gamesData, error: gamesError } = await supabase
        .from('standard_game_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (gamesError) throw gamesError;

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set((gamesData || []).map(g => g.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      // Create a map of user_id to display_name
      const profileMap = new Map(
        (profilesData || []).map(p => [p.user_id, p.display_name])
      );

      // Merge games with profile names
      const gamesWithNames = (gamesData || []).map(game => ({
        ...game,
        display_name: profileMap.get(game.user_id) || 'Anonymous'
      }));

      setGames(gamesWithNames);
    } catch (error) {
      console.error('Error fetching games:', error);
      toast.error('Failed to load game data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!deleteGameId) return;

    try {
      const { error } = await supabase
        .from('standard_game_results')
        .delete()
        .eq('id', deleteGameId);

      if (error) throw error;

      toast.success('Game result deleted successfully');
      await fetchGames();
    } catch (error) {
      console.error('Error deleting game:', error);
      toast.error('Failed to delete game result');
    } finally {
      setShowDeleteDialog(false);
      setDeleteGameId(null);
    }
  };

  const filteredGames = games.filter(game =>
    game.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    game.score.toString().includes(searchTerm)
  );

  const stats = {
    totalGames: games.length,
    totalScore: games.reduce((sum, g) => sum + g.score, 0),
    averageScore: games.length > 0 ? Math.round(games.reduce((sum, g) => sum + g.score, 0) / games.length) : 0,
    topScore: games.length > 0 ? Math.max(...games.map(g => g.score)) : 0
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            Game Data Management
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
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5" />
                Game Data Management
              </CardTitle>
              <CardDescription>
                View and manage game results and statistics
              </CardDescription>
            </div>
            <Button onClick={fetchGames} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Statistics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Games</div>
                <div className="text-2xl font-bold">{stats.totalGames}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Score</div>
                <div className="text-2xl font-bold">{stats.totalScore.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Average Score</div>
                <div className="text-2xl font-bold">{stats.averageScore}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Top Score</div>
                <div className="text-2xl font-bold flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  {stats.topScore}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by player name, user ID, or score..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Games Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Words</TableHead>
                  <TableHead>Longest Word</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGames.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No games found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGames.map((game) => (
                    <TableRow key={game.id}>
                      <TableCell className="font-medium">
                        {game.display_name || 'Anonymous'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{game.score}</Badge>
                      </TableCell>
                      <TableCell>{game.words_found}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {game.longest_word || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          game.achievement_grade === 'Platinum' ? 'default' :
                          game.achievement_grade === 'Gold' ? 'default' :
                          game.achievement_grade === 'Silver' ? 'secondary' :
                          'outline'
                        }>
                          {game.achievement_grade}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(game.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleteGameId(game.id);
                            setShowDeleteDialog(true);
                          }}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredGames.length} of {games.length} games (last 100)
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Game Result</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this game result? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGame} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

