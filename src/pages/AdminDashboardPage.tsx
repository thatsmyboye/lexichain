import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Home, AlertCircle } from 'lucide-react';
import { ProfileManagement } from '@/components/admin/ProfileManagement';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { AdminActions } from '@/components/admin/AdminActions';
import { UserRoleManagement } from '@/components/admin/UserRoleManagement';
import { SystemOverview } from '@/components/admin/SystemOverview';
import { GameDataManagement } from '@/components/admin/GameDataManagement';
import { DatabaseTools } from '@/components/admin/DatabaseTools';

export default function AdminDashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(user);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isLoadingAdmin && !isAdmin && user) {
      navigate('/');
    }
  }, [isAdmin, isLoadingAdmin, user, navigate]);

  if (isLoadingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              You must be logged in to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              <Home className="h-4 w-4 mr-2" />
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto py-8 space-y-6 max-w-7xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-primary" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">
              Manage users, view audit logs, and access administrative tools
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6" id="admin-tabs">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="profiles">Profiles</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <SystemOverview />
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <AdminActions />
          </TabsContent>

          <TabsContent value="games" className="space-y-4">
            <GameDataManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserRoleManagement />
          </TabsContent>

          <TabsContent value="profiles" className="space-y-4">
            <ProfileManagement />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <AuditLogViewer />
          </TabsContent>

          <TabsContent value="database" className="space-y-4">
            <DatabaseTools />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
