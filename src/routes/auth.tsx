import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — ZUKI" },
      { name: "description", content: "Sign in to your calm, intentional productivity space." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery") || window.location.search.includes("reset=true");
    if (isRecovery) {
      setMode("reset");
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        nav({ to: "/today" });
      }
    });
  }, [nav]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      try {
        localStorage.removeItem("zuki:loggedOut");
      } catch {}
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/today" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendResetLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) throw error;
      toast.success("Password reset link sent! Check your inbox.");
      setMode("signin");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully. Access granted.");
      nav({ to: "/today" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      try {
        localStorage.removeItem("zuki:loggedOut");
      } catch {}
      const isLocal = typeof window !== "undefined" && 
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

      if (isLocal) {
        // Direct Supabase OAuth for local development
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/today`,
          },
        });
        if (error) throw error;
      } else {
        // Keep Lovable Cloud Auth for production compatibility
        const res = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (res.error) throw res.error;
        if (!res.redirected) nav({ to: "/today" });
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden">
      {/* Dynamic ambient backlight glows */}
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse duration-10000" />
      <div className="absolute bottom-1/3 right-1/3 translate-x-1/2 translate-y-1/2 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none animate-float" />
      
      <div className="aurora-card w-full max-w-md rounded-3xl p-8 interactive-card shadow-soft animate-in fade-in-0 slide-in-from-bottom-8 duration-700 ease-out">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary glow animate-float">
            <img src="/icon.svg" className="h-7 w-7 object-contain" alt="ZUKI Logo" />
          </div>
          <h1 className="font-display text-4xl text-foreground shimmer-text font-semibold">ZUKI</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            {mode === "reset"
              ? "Choose a strong, secure new password."
              : mode === "forgot"
              ? "We'll send you a link to reset your password."
              : "A quiet space to plan your day with intention."}
          </p>
        </div>

        {mode === "reset" ? (
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <Input
              type="password"
              required
              minLength={6}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background/40"
            />
            <Input
              type="password"
              required
              minLength={6}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-background/40"
            />
            <Button type="submit" disabled={loading} className="w-full">
              Update Password
            </Button>
          </form>
        ) : mode === "forgot" ? (
          <form onSubmit={handleSendResetLink} className="space-y-3">
            <Input
              type="email"
              required
              placeholder="you@calm.day"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-background/40"
            />
            <Button type="submit" disabled={loading} className="w-full">
              Send Reset Link
            </Button>
            <div className="text-center pt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                onClick={() => setMode("signin")}
              >
                Back to Sign in
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleEmail} className="space-y-3">
              <Input
                type="email"
                required
                placeholder="you@calm.day"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-background/40"
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-background/40"
              />
              {mode === "signin" && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              <Button type="submit" disabled={loading} className="w-full">
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button onClick={handleGoogle} variant="outline" disabled={loading} className="w-full">
              Continue with Google
            </Button>
          </>
        )}

        {mode !== "forgot" && mode !== "reset" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">← back home</Link>
        </p>
      </div>
    </div>
  );
}
