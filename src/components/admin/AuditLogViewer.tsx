import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  event_type: string;
  event_level: string;
  event_details: any;
  user_id: string | null;
  created_at: string;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('security_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.event_level.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLevelIcon = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'INFO':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getLevelBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return 'destructive';
      case 'WARNING':
        return 'outline';
      case 'INFO':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Logs
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Security Audit Logs
        </CardTitle>
        <CardDescription>
          View system security events and user actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by event type or level..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <Button onClick={fetchLogs} variant="outline" size="sm">
            Refresh
          </Button>
        </div>

        <ScrollArea className="h-[600px] border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getLevelIcon(log.event_level)}
                        <Badge variant={getLevelBadgeVariant(log.event_level)}>
                          {log.event_level}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.event_type}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(log.event_details, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.user_id ? log.user_id.substring(0, 8) + '...' : 'System'}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} log entries (last 100)
        </div>
      </CardContent>
    </Card>
  );
}
