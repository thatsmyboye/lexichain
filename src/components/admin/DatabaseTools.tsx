import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Database, Play, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function DatabaseTools() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingQuery, setPendingQuery] = useState('');

  const isDangerousQuery = (q: string): boolean => {
    const lowerQuery = q.toLowerCase().trim();
    const dangerousKeywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'grant', 'revoke'];
    return dangerousKeywords.some(keyword => lowerQuery.includes(keyword));
  };

  const handleExecuteQuery = () => {
    if (!query.trim()) {
      toast.error('Please enter a query');
      return;
    }

    if (isDangerousQuery(query)) {
      setPendingQuery(query);
      setShowConfirmDialog(true);
      return;
    }

    executeQuery(query);
  };

  const executeQuery = async (sqlQuery: string) => {
    try {
      setIsExecuting(true);
      setResults(null);

      // For SELECT queries, use the appropriate Supabase method
      const trimmedQuery = sqlQuery.trim().toLowerCase();
      
      if (trimmedQuery.startsWith('select')) {
        // Extract table name and columns (simplified - for production, use a proper SQL parser)
        const match = trimmedQuery.match(/from\s+(\w+)/i);
        if (match) {
          const tableName = match[1];
          const { data, error } = await supabase
            .from(tableName as any)
            .select('*')
            .limit(100);

          if (error) throw error;
          setResults({ type: 'select', data, count: data?.length || 0 });
          toast.success(`Query executed successfully. Returned ${data?.length || 0} rows.`);
        } else {
          throw new Error('Could not parse SELECT query. Please use Supabase client methods directly.');
        }
      } else {
        // For other queries, show a message that they should use RPC or migrations
        toast.error('Complex queries should be executed via database migrations or RPC functions for security.');
        setResults({
          type: 'error',
          message: 'For security reasons, only SELECT queries are supported here. Use migrations or RPC functions for DDL/DML operations.'
        });
      }
    } catch (error: any) {
      console.error('Error executing query:', error);
      setResults({
        type: 'error',
        message: error.message || 'Failed to execute query'
      });
      toast.error('Query execution failed');
    } finally {
      setIsExecuting(false);
      setShowConfirmDialog(false);
      setPendingQuery('');
    }
  };

  const confirmDangerousQuery = () => {
    executeQuery(pendingQuery);
  };

  const exampleQueries = [
    {
      name: 'Get all users',
      query: 'SELECT * FROM profiles LIMIT 50'
    },
    {
      name: 'Get recent games',
      query: 'SELECT * FROM standard_game_results ORDER BY created_at DESC LIMIT 50'
    },
    {
      name: 'Get daily challenges',
      query: 'SELECT * FROM daily_challenge_results ORDER BY challenge_date DESC LIMIT 50'
    }
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Tools
          </CardTitle>
          <CardDescription>
            Execute database queries and manage data (read-only operations recommended)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Example Queries */}
          <div className="space-y-2">
            <Label>Example Queries</Label>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuery(example.query)}
                >
                  {example.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Query Input */}
          <div className="space-y-2">
            <Label htmlFor="sql-query">SQL Query</Label>
            <Textarea
              id="sql-query"
              placeholder="SELECT * FROM profiles LIMIT 10;"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="font-mono text-sm"
              rows={6}
            />
            {isDangerousQuery(query) && (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>This query contains potentially dangerous operations</span>
              </div>
            )}
          </div>

          <Button
            onClick={handleExecuteQuery}
            disabled={isExecuting || !query.trim()}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Query
              </>
            )}
          </Button>

          {/* Results */}
          {results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {results.type === 'error' ? (
                    <span className="text-destructive">Error</span>
                  ) : (
                    <span className="text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Results ({results.count || 0} rows)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {results.type === 'error' ? (
                  <div className="text-destructive font-mono text-sm">
                    {results.message}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-96">
                      {JSON.stringify(results.data, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Warning */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Security Notice:</strong> Only SELECT queries are fully supported here. 
                For DDL/DML operations (CREATE, DROP, DELETE, UPDATE), use database migrations 
                or RPC functions to ensure proper security and auditing.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Dangerous Query</AlertDialogTitle>
            <AlertDialogDescription>
              This query contains potentially dangerous operations (DROP, DELETE, TRUNCATE, etc.).
              Are you sure you want to execute it?
              <br /><br />
              <code className="text-xs bg-muted p-2 rounded block mt-2">{pendingQuery}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDangerousQuery} className="bg-destructive text-destructive-foreground">
              Execute Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

