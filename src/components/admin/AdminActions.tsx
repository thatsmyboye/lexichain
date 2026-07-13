import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Database, Settings, BarChart3, Users, Gamepad2, FileText, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function AdminActions() {
  const navigate = useNavigate();

  const handleDebugTools = () => {
    navigate('/debug');
    toast.success('Opening debug tools');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Quick access to administrative functions and tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <BarChart3 className="h-6 w-6" />
              <span>Game Statistics</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                toast.info('Scroll to System Overview section');
              }}
            >
              <Zap className="h-6 w-6" />
              <span>System Overview</span>
            </Button>

            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2"
              onClick={() => {
                const element = document.getElementById('admin-tabs');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
                toast.info('Navigate to tabs below');
              }}
            >
              <FileText className="h-6 w-6" />
              <span>View All Tools</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Navigation Shortcuts</CardTitle>
          <CardDescription>
            Quick navigation to key admin sections
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const element = document.getElementById('admin-tabs');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const trigger = document.querySelector('[value="overview"]');
                    if (trigger) (trigger as HTMLElement).click();
                  }, 500);
                }
              }}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const element = document.getElementById('admin-tabs');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const trigger = document.querySelector('[value="games"]');
                    if (trigger) (trigger as HTMLElement).click();
                  }, 500);
                }
              }}
            >
              <Gamepad2 className="h-4 w-4 mr-2" />
              Games
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const element = document.getElementById('admin-tabs');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const trigger = document.querySelector('[value="users"]');
                    if (trigger) (trigger as HTMLElement).click();
                  }, 500);
                }
              }}
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const element = document.getElementById('admin-tabs');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const trigger = document.querySelector('[value="database"]');
                    if (trigger) (trigger as HTMLElement).click();
                  }, 500);
                }
              }}
            >
              <Database className="h-4 w-4 mr-2" />
              Database
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
