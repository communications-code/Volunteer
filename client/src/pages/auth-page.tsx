import { useEffect } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { useAuth } from "@/hooks/use-auth";
import { PublicShell } from "@/components/layout/public-shell";
import { InsetGroup } from "@/components/layout/inset-group";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmbeddedLoginAccess } from "@/components/auth/embedded-login-access";

const loginSchema = z.object({
  username: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const AuthPage = () => {
  const [, navigate] = useLocation();
  const { user, loginMutation, requestMagicLinkMutation, verifyMagicLinkMutation } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("magic");
    if (!token) return;

    verifyMagicLinkMutation.mutate(
      { token },
      {
        onSuccess: () => {
          params.delete("magic");
          const search = params.toString();
          window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
          navigate("/");
        },
      },
    );
  }, [navigate, verifyMagicLinkMutation]);

  const onLoginSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(
      {
        username: values.username.trim().toLowerCase(),
        password: values.password,
      },
      {
        onSuccess: () => {
          navigate("/");
        },
      },
    );
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
    <PublicShell
      title="Admin Sign In"
      subtitle="Use your admin credentials or request a secure sign-in link."
      backHref="/"
      backLabel="Needs"
      hideTabs
    >
      <div className="mx-auto max-w-xl">
        <InsetGroup>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Access the Serving Network admin workspace from one calm, focused screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <EmbeddedLoginAccess />
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="admin@vfwharrisonoh.org" {...field} />
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
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-3">
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending || verifyMagicLinkMutation.isPending}>
                    {loginMutation.isPending ? "Signing in..." : "Sign In"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={requestMagicLinkMutation.isPending || verifyMagicLinkMutation.isPending}
                    onClick={onRequestMagicLink}
                  >
                    {requestMagicLinkMutation.isPending ? "Sending sign-in link..." : "Email me a sign-in link"}
                  </Button>
                  {verifyMagicLinkMutation.isPending ? (
                    <p className="text-sm text-slate-500">Verifying your sign-in link...</p>
                  ) : null}
                </div>
              </form>
            </Form>
          </CardContent>
        </InsetGroup>
      </div>
    </PublicShell>
  );
};

export default AuthPage;
