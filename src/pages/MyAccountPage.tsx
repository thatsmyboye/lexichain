import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { validateDisplayName } from "@/lib/contentFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export default function MyAccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [validationError, setValidationError] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  // Set once the account is deleted, so the sign-out that follows goes home
  // instead of to the sign-in page.
  const accountDeleted = useRef(false);
  const navigate = useNavigate();
  const { profile, loading, getDisplayName, updateDisplayName } = useProfile(user);

  useEffect(() => {
    // Get current user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate("/auth");
        return;
      }
      setUser(user);
    });

    // Listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (accountDeleted.current) return;
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
    }
  }, [profile]);

  // Validate display name as user types
  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (value.trim()) {
      const validation = validateDisplayName(value);
      setValidationError(validation.isValid ? "" : validation.error || "");
    } else {
      setValidationError("");
    }
  };

  const handleSaveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) return;
    
    const success = await updateDisplayName(displayName.trim());
    if (success) {
      setValidationError("");
      // Keep the form in sync with the saved value
      setDisplayName(profile?.display_name || "");
    }
  };

  // Permanently deletes the account and its server-side data
  // (supabase/migrations/20261123120000_add_delete_my_account.sql). Required
  // by the App Store and Google Play for apps that allow sign-up.
  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      setDeleting(false);
      toast.error("Couldn't delete your account. Check your connection and try again.");
      return;
    }
    accountDeleted.current = true;
    // The server session is already gone; clear the one stored on this device.
    await supabase.auth.signOut({ scope: "local" });
    toast.success("Your account has been deleted");
    navigate("/", { replace: true });
  };

  const handleBack = () => {
    navigate("/leaderboard");
  };

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4">
      <div className="container mx-auto py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-bold mb-2">My Account</h1>
          <p className="text-muted-foreground">
            Manage your profile settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Your display name will be shown on leaderboards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email Display */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user.email || ""}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Email address cannot be changed
              </p>
            </div>

            {/* Display Name */}
            <form onSubmit={handleSaveDisplayName} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                {loading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Input
                    id="display-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    placeholder={user.email ? user.email.split('@')[0] : "Enter display name"}
                    maxLength={30}
                    className={validationError ? "border-destructive" : ""}
                  />
                )}
                {validationError && (
                  <p className="text-sm text-destructive mt-1">{validationError}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {displayName.length}/30 characters
                  {!validationError && (
                    <span className="block">
                      {profile?.display_name 
                        ? "This name will appear on leaderboards"
                        : `Without a display name, "${user.email?.split('@')[0] || 'Anonymous'}" will be used`
                      }
                    </span>
                  )}
                </p>
              </div>

              <div className="flex gap-2 mt-4 sm:flex-row flex-col">
                <Button
                  type="submit"
                  disabled={loading || validationError !== "" || displayName.trim() === (profile?.display_name || "")}
                  className="sm:flex-1"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleBack}
                  className="sm:flex-1"
                >
                  Back to Leaderboards
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/")}
                  className="sm:flex-1"
                >
                  🏠 Back to Home
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6 border-destructive/40">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently delete your account, display name, saved game results and leaderboard
              entries. Progress stored on this device (trophies, personal bests, settings) stays
              here and keeps working without an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete my account"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes {user.email ? <strong>{user.email}</strong> : "your account"} and
                    all of its saved results. It can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep account</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
