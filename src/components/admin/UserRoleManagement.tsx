import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Shield, ShieldCheck, ShieldOff, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

interface UserWithRole {
  id: string;
  user_id: string;
  display_name: string | null;
  email?: string;
  is_admin: boolean;
  created_at: string;
}

const emailSchema = z.string().email('Invalid email address').max(255);

export function UserRoleManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionUser, setActionUser] = useState<UserWithRole | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<'grant' | 'revoke'>('grant');

  useEffect(() => {
    fetchUsersWithRoles();
  }, []);

  const fetchUsersWithRoles = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      // Create a set of admin user IDs
      const adminUserIds = new Set(roles?.map(r => r.user_id) || []);

      // Combine the data
      const usersWithRoles: UserWithRole[] = profiles?.map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        display_name: profile.display_name,
        is_admin: adminUserIds.has(profile.user_id),
        created_at: profile.created_at
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users with roles:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantAdmin = async (user: UserWithRole) => {
    setActionUser(user);
    setActionType('grant');
    setShowConfirmDialog(true);
  };

  const handleRevokeAdmin = async (user: UserWithRole) => {
    setActionUser(user);
    setActionType('revoke');
    setShowConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!actionUser) return;

    try {
      if (actionType === 'grant') {
        // Grant admin role using the database function
        const { error } = await supabase.rpc('grant_admin_role', {
          target_user_id: actionUser.user_id
        });

        if (error) throw error;
        toast.success(`Admin privileges granted to ${actionUser.display_name || 'user'}`);
      } else {
        // Revoke admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', actionUser.user_id)
          .eq('role', 'admin');

        if (error) throw error;

        // Log the revocation
        await supabase.rpc('log_security_event', {
          event_type: 'ADMIN_ROLE_REVOKED',
          event_level: 'INFO',
          event_details: {
            target_user_id: actionUser.user_id,
            target_display_name: actionUser.display_name
          }
        });

        toast.success(`Admin privileges revoked from ${actionUser.display_name || 'user'}`);
      }

      // Refresh the list
      await fetchUsersWithRoles();
    } catch (error) {
      console.error(`Error ${actionType}ing admin role:`, error);
      toast.error(`Failed to ${actionType} admin privileges`);
    } finally {
      setShowConfirmDialog(false);
      setActionUser(null);
    }
  };

  const filteredUsers = users.filter(user =>
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            User Role Management
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
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            User Role Management
          </CardTitle>
          <CardDescription>
            Grant or revoke admin privileges for users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by display name or user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button onClick={fetchUsersWithRoles} variant="outline" size="sm">
              Refresh
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.display_name || 'Anonymous'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {user.user_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {user.is_admin ? (
                          <Badge variant="default" className="bg-primary/10 text-primary border-primary/20">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserCog className="h-3 w-3 mr-1" />
                            User
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.is_admin ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevokeAdmin(user)}
                            className="gap-2"
                          >
                            <ShieldOff className="h-3 w-3" />
                            Revoke Admin
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGrantAdmin(user)}
                            className="gap-2 border-primary/50 hover:border-primary"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            Grant Admin
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
            {' • '}
            {users.filter(u => u.is_admin).length} admins
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'grant' ? 'Grant Admin Privileges' : 'Revoke Admin Privileges'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'grant' ? (
                <>
                  Are you sure you want to grant admin privileges to{' '}
                  <span className="font-semibold">{actionUser?.display_name || 'this user'}</span>?
                  This will give them full access to the admin dashboard and all administrative functions.
                </>
              ) : (
                <>
                  Are you sure you want to revoke admin privileges from{' '}
                  <span className="font-semibold">{actionUser?.display_name || 'this user'}</span>?
                  They will lose access to the admin dashboard and all administrative functions.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              {actionType === 'grant' ? 'Grant Admin' : 'Revoke Admin'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
