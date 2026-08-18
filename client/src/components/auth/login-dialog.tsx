import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmbeddedLoginAccess } from "@/components/auth/embedded-login-access";

const loginSchema = z.object({
  username: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginDialogProps {
  trigger?: React.ReactNode;
}

/**
 * Inline login dialog that works in iframes without page navigation.
 * Reuses the same auth logic as auth-page.tsx but renders in a Dialog overlay.
 */
export function LoginDialog({ trigger }: LoginDialogProps) {
  const [open, setOpen] = useState(false);
  const { loginMutation, requestMagicLinkMutation } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      {
        username: values.username.trim().toLowerCase(),
        password: values.password,
      },
      {
      onSuccess: () => {
        setOpen(false);
        loginForm.reset();
      },
    });
  };

  const onRequestMagicLink = () => {
    const username = loginForm.getValues("username").trim().toLowerCase();
    const isValidEmail = z.string().email().safeParse(username).success;

    if (!isValidEmail) {
      loginForm.setError("username", {
        type: "manual",
        message: "Enter your admin email first to receive a sign-in link.",
      });
      return;
    }

    requestMagicLinkMutation.mutate({ username });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="sm"
            className="text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
              />
            </svg>
            Admin Login
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#212421]">Admin Login</DialogTitle>
          <DialogDescription>
            Enter your credentials to access admin features.
          </DialogDescription>
        </DialogHeader>
        <EmbeddedLoginAccess compact />
        <Form {...loginForm}>
          <form onSubmit={loginForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={loginForm.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="admin@vfwharrisonoh.org"
                      {...field}
                      className="rounded-md"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={loginForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} className="rounded-full" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={requestMagicLinkMutation.isPending}
              onClick={onRequestMagicLink}
            >
              {requestMagicLinkMutation.isPending
                ? "Sending sign-in link..."
                : "Email me a sign-in link"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
