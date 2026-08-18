import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const AdminUsersTable = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['/api/admin/users'],
    staleTime: 60 * 1000, // 1 minute
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (payload: { userId: number; newPassword: string; notifyUser: boolean }) => {
      const res = await apiRequest(
        "POST",
        `/api/admin/users/${payload.userId}/reset-password`,
        {
          newPassword: payload.newPassword,
          notifyUser: payload.notifyUser,
        },
      );
      return res.json() as Promise<{ notificationSent: boolean }>;
    },
    onSuccess: (result) => {
      toast({
        title: "Password reset",
        description: result.notificationSent
          ? "Password updated and user notified by email."
          : "Password updated. Email notification was not sent.",
      });
      setResetOpen(false);
      setSelectedUser(null);
      setNewPassword("");
      setConfirmPassword("");
      setNotifyUser(true);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openResetDialog = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setNotifyUser(true);
    setResetOpen(true);
  };

  const submitReset = () => {
    if (!selectedUser) return;
    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Confirm password must match the new password.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      userId: selectedUser.id,
      newPassword,
      notifyUser,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-10 border rounded-lg">
        <p className="text-gray-500">No admin users found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.id}</TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>
                {user.isAdmin ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <Shield className="w-3 h-3 mr-1" /> Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    User
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {user.isAdmin ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openResetDialog(user)}
                  >
                    Reset Password
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Admin Password</DialogTitle>
            <DialogDescription>
              {selectedUser
                ? `Set a new password for ${selectedUser.username}.`
                : "Set a new password for this admin."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">New password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
                className="mt-1"
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={notifyUser}
                onCheckedChange={(checked) => setNotifyUser(Boolean(checked))}
                className="mt-0.5"
              />
              <span>Email this admin their temporary password</span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetOpen(false)}
              disabled={resetPasswordMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitReset}
              disabled={resetPasswordMutation.isPending || !selectedUser}
              className="bg-[#d14633] hover:bg-[#197991]"
            >
              {resetPasswordMutation.isPending ? "Saving..." : "Save New Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersTable;
