import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Database, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function AdminActions() {
  const navigate = useNavigate();

  const handleDebugTools = () => {
    navigate('/debug');
    toast.success('Opening debug tools');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Admin Actions
        </CardTitle>
        <CardDescription>
          Quick access to administrative functions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={handleDebugTools}
          >
            <Database className="h-6 w-6" />
            <span>Debug Tools</span>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/leaderboard')}
          >
            <Shield className="h-6 w-6" />
            <span>View Leaderboards</span>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/stats')}
          >
            <RefreshCw className="h-6 w-6" />
            <span>Game Statistics</span>
          </Button>

          <Button
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2"
            onClick={() => navigate('/store')}
          >
            <Settings className="h-6 w-6" />
            <span>Store Management</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
