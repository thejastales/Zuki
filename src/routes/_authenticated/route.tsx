import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LayoutGrid, MessageCircleHeart, LogOut, Sparkles, BookOpen, ShieldAlert, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWaterReminder } from "@/hooks/use-water-reminder";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});



function AuthedLayout() {
  const nav = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useWaterReminder();

  const { user } = Route.useRouteContext();
  const userName = useMemo(() => {
    return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "friend";
  }, [user]);

  const [showSplash, setShowSplash] = useState(true);
  const [splashClosing, setSplashClosing] = useState(false);
  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const isUnnamed = useMemo(() => {
    const fn = user?.user_metadata?.full_name || user?.user_metadata?.name;
    return !fn || fn === "dev-test-user";
  }, [user]);

  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardedName, setOnboardedName] = useState("");
  const [onboardNameChecked, setOnboardNameChecked] = useState(false);

  useEffect(() => {
    if (user) {
      const fn = user.user_metadata?.full_name || user.user_metadata?.name;
      setDisplayName(fn || "");
      setIsOnboarding(!fn || fn === "dev-test-user");
      setOnboardNameChecked(true);
    }
  }, [user]);

  useEffect(() => {
    if (!onboardNameChecked || isOnboarding) return;

    const closeTrigger = setTimeout(() => {
      setSplashClosing(true);
    }, 3400);

    const removeTrigger = setTimeout(() => {
      setShowSplash(false);
    }, 4500);

    return () => {
      clearTimeout(closeTrigger);
      clearTimeout(removeTrigger);
    };
  }, [onboardNameChecked, isOnboarding]);



  async function signOut() {
    try {
      try {
        localStorage.setItem("zuki:loggedOut", "true");
      } catch {}
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out network error:", err);
    } finally {
      nav({ to: "/auth" });
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName.trim() }
      });
      if (error) throw error;
      toast.success("Profile display name updated!");
      setSettingsOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleOnboardSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onboardedName.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: onboardedName.trim() }
      });
      if (error) throw error;
      toast.success(`Welcome, ${onboardedName.trim()}!`);
      // Update local state
      setDisplayName(onboardedName.trim());
      setIsOnboarding(false);
      // Reload to refresh the auth context
      window.location.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  const navItems = [
    { to: "/today", label: "Today", icon: LayoutGrid },
    { to: "/reading", label: "Reading", icon: BookOpen },
    { to: "/worry", label: "Worry Time", icon: ShieldAlert },
    { to: "/vision-board", label: "Vision Board", icon: Sparkles },
    { to: "/chat", label: "ZUKI Chat", icon: MessageCircleHeart },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col relative">
      {/* Global Calm Atmosphere Layer (SVG doodles & stars) */}
      <div className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden">
        {/* Calm Rising Dawn Sun - top left */}
        <div className="absolute top-24 left-2 md:top-28 md:left-8 animate-float z-10" style={{ animationDuration: "6s" }}>
          <div style={{ animation: "doodle-pulse-slow 16s ease-in-out infinite", animationDelay: "2s" }}>
            <svg viewBox="0 0 100 80" className="w-16 h-14 md:w-24 md:h-20 stroke-[1.5] fill-none drop-shadow-[0_0_14px_oklch(0.85_0.15_95/0.35)]" style={{ stroke: "oklch(0.85 0.15 95)" }}>
              <path d="M10,70 L90,70" strokeLinecap="round" />
              <path d="M30,70 A20,20 0 0,1 70,70" fill="oklch(0.85 0.15 95 / 0.06)" />
              <path d="M50,45 L50,30" strokeLinecap="round" />
              <path d="M35,55 L25,48" strokeLinecap="round" />
              <path d="M65,55 L75,48" strokeLinecap="round" />
              <path d="M22,65 L12,62" strokeLinecap="round" />
              <path d="M78,65 L88,62" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Happy Paw Prints - middle right */}
        <div className="absolute top-1/4 right-3 md:top-1/3 md:right-10 animate-sway z-10" style={{ animationDelay: "1.5s", animationDuration: "8s" }}>
          <div style={{ animation: "doodle-pulse-medium 10s ease-in-out infinite" }}>
            <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-16 md:h-16 stroke-[1.5] fill-none drop-shadow-[0_0_12px_oklch(0.82_0.12_85/0.3)]" style={{ stroke: "oklch(0.82 0.12 85)" }}>
              <path d="M35,65 Q30,55 50,55 Q70,55 65,65 Q58,75 50,75 Q42,75 35,65 Z" fill="oklch(0.82 0.12 85 / 0.05)" />
              <ellipse cx="30" cy="45" rx="7" ry="9" fill="oklch(0.82 0.12 85 / 0.05)" />
              <ellipse cx="43" cy="35" rx="8" ry="10" fill="oklch(0.82 0.12 85 / 0.05)" />
              <ellipse cx="57" cy="35" rx="8" ry="10" fill="oklch(0.82 0.12 85 / 0.05)" />
              <ellipse cx="70" cy="45" rx="7" ry="9" fill="oklch(0.82 0.12 85 / 0.05)" />
            </svg>
          </div>
        </div>

        {/* Organic Leaves Sprig - bottom right */}
        <div className="absolute bottom-12 right-2 md:bottom-16 md:right-8 animate-sway z-10" style={{ animationDuration: "12s" }}>
          <div style={{ animation: "doodle-pulse-medium 12s ease-in-out infinite", animationDelay: "0.5s" }}>
            <svg viewBox="0 0 100 150" className="w-16 h-24 md:w-28 md:h-40 stroke-[1.5] fill-none drop-shadow-[0_0_12px_oklch(0.80_0.12_165/0.3)]" style={{ stroke: "oklch(0.80 0.12 165)" }}>
              <path d="M50,140 Q40,90 60,40 Q70,15 55,2" strokeLinecap="round" />
              <path d="M54,105 Q70,95 65,85 Q54,90 51,96 Z" fill="oklch(0.80 0.12 165 / 0.05)" strokeLinejoin="round" />
              <path d="M48,95 Q28,85 32,75 Q42,80 46,88 Z" fill="oklch(0.80 0.12 165 / 0.05)" strokeLinejoin="round" />
              <path d="M50,65 Q68,55 63,45 Q52,50 49,58 Z" fill="oklch(0.80 0.12 165 / 0.05)" strokeLinejoin="round" />
              <path d="M47,55 Q28,45 32,35 Q42,40 45,48 Z" fill="oklch(0.80 0.12 165 / 0.05)" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Floating Zen Pebbles - middle left */}
        <div className="absolute top-[60%] left-2 md:top-1/2 md:left-10 animate-balance z-10" style={{ animationDuration: "7s" }}>
          <div style={{ animation: "doodle-pulse-slow 18s ease-in-out infinite", animationDelay: "3s" }}>
            <svg viewBox="0 0 100 100" className="w-12 h-12 md:w-20 md:h-20 stroke-[1.5] fill-none drop-shadow-[0_0_12px_oklch(0.82_0.12_340/0.3)]" style={{ stroke: "oklch(0.82 0.12 340)" }}>
              <ellipse cx="50" cy="80" rx="30" ry="12" fill="oklch(0.82 0.12 340 / 0.05)" />
              <ellipse cx="48" cy="60" rx="22" ry="10" fill="oklch(0.82 0.12 340 / 0.05)" />
              <ellipse cx="52" cy="42" rx="15" ry="7" fill="oklch(0.82 0.12 340 / 0.05)" />
            </svg>
          </div>
        </div>

        {/* Twinkling Stars & Sparkles Scattered */}
        {/* Star 1 - Top Right (Gold Classic Sparkle) */}
        <div className="absolute top-16 right-16 md:right-32 animate-star-twinkle select-none" style={{ color: "oklch(0.85 0.15 95)", animationDuration: "3.5s", animationDelay: "0.2s" }}>
          <svg viewBox="0 0 80 80" className="w-8 h-8 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 L40,65 M15,40 L65,40" strokeLinecap="round" />
            <path d="M40,30 L50,40 L40,50 L30,40 Z" className="fill-current/25 stroke-none" />
          </svg>
        </div>

        {/* Star 2 - Top Left-Center (Lavender Hollow Diamond) */}
        <div className="absolute top-24 left-[30%] animate-star-twinkle select-none" style={{ color: "oklch(0.78 0.12 285)", animationDuration: "4.5s", animationDelay: "1.5s" }}>
          <svg viewBox="0 0 80 80" className="w-6 h-6 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 Q40,40 65,40 Q40,40 40,65 Q40,40 15,40 Q40,40 40,15 Z" className="fill-current/15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Star 3 - Middle-Right Center (Rose Pulsing Orb) */}
        <div className="absolute top-1/2 right-[20%] animate-star-twinkle select-none" style={{ color: "oklch(0.82 0.12 340)", animationDuration: "5s", animationDelay: "0.8s" }}>
          <svg viewBox="0 0 80 80" className="w-7 h-7 stroke-current stroke-[1.2] fill-none">
            <circle cx="40" cy="40" r="10" className="stroke-current/30" />
            <circle cx="40" cy="40" r="4" className="fill-current" />
            <path d="M40,20 L40,30 M40,50 L40,60 M20,40 L30,40 M50,40 L60,40" strokeLinecap="round" />
          </svg>
        </div>

        {/* Star 4 - Bottom-Left Center (Mint 5-point Star) */}
        <div className="absolute bottom-32 left-[25%] animate-star-twinkle select-none" style={{ color: "oklch(0.80 0.12 165)", animationDuration: "4s", animationDelay: "2.3s" }}>
          <svg viewBox="0 0 80 80" className="w-8 h-8 stroke-current stroke-[1.5] fill-none">
            <path d="M40,10 L48,32 L72,32 L53,46 L60,68 L40,54 L20,68 L27,46 L8,32 L32,32 Z" strokeLinecap="round" strokeLinejoin="round" className="fill-current/20" />
          </svg>
        </div>

        {/* Star 5 - Top-Right Center (Rose Classic Sparkle) */}
        <div className="absolute top-32 right-[35%] animate-star-twinkle select-none" style={{ color: "oklch(0.82 0.12 340)", animationDuration: "3.8s", animationDelay: "1s" }}>
          <svg viewBox="0 0 80 80" className="w-7 h-7 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 L40,65 M15,40 L65,40" strokeLinecap="round" />
            <path d="M40,30 L50,40 L40,50 L30,40 Z" className="fill-current/25 stroke-none" />
          </svg>
        </div>

        {/* Star 6 - Bottom-Right Center (Gold Hollow Diamond) */}
        <div className="absolute bottom-40 right-[30%] animate-star-twinkle select-none" style={{ color: "oklch(0.85 0.15 95)", animationDuration: "4.2s", animationDelay: "3s" }}>
          <svg viewBox="0 0 80 80" className="w-6 h-6 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 Q40,40 65,40 Q40,40 40,65 Q40,40 15,40 Q40,40 40,15 Z" className="fill-current/15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Star 7 - Far Right Middle (Lavender Pulsing Orb) */}
        <div className="absolute top-[65%] right-8 md:right-16 animate-star-twinkle select-none" style={{ color: "oklch(0.78 0.12 285)", animationDuration: "4.8s", animationDelay: "1.8s" }}>
          <svg viewBox="0 0 80 80" className="w-7 h-7 stroke-current stroke-[1.2] fill-none">
            <circle cx="40" cy="40" r="10" className="stroke-current/30" />
            <circle cx="40" cy="40" r="4" className="fill-current" />
            <path d="M40,20 L40,30 M40,50 L40,60 M20,40 L30,40 M50,40 L60,40" strokeLinecap="round" />
          </svg>
        </div>

        {/* Star 8 - Far Left Top (Rose 5-point Star) */}
        <div className="absolute top-48 left-16 md:left-24 animate-star-twinkle select-none" style={{ color: "oklch(0.82 0.12 340)", animationDuration: "5.2s", animationDelay: "0.5s" }}>
          <svg viewBox="0 0 80 80" className="w-7 h-7 stroke-current stroke-[1.5] fill-none">
            <path d="M40,10 L48,32 L72,32 L53,46 L60,68 L40,54 L20,68 L27,46 L8,32 L32,32 Z" strokeLinecap="round" strokeLinejoin="round" className="fill-current/20" />
          </svg>
        </div>

        {/* Star 9 - Bottom Left (Cyan Classic Sparkle) */}
        <div className="absolute bottom-24 left-10 md:left-20 animate-star-twinkle select-none" style={{ color: "oklch(0.80 0.12 165)", animationDuration: "3.6s", animationDelay: "2s" }}>
          <svg viewBox="0 0 80 80" className="w-8 h-8 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 L40,65 M15,40 L65,40" strokeLinecap="round" />
            <path d="M40,30 L50,40 L40,50 L30,40 Z" className="fill-current/25 stroke-none" />
          </svg>
        </div>

        {/* Star 10 - Center Top (Gold Hollow Diamond) */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 animate-star-twinkle select-none" style={{ color: "oklch(0.85 0.15 95)", animationDuration: "4s", animationDelay: "2.8s" }}>
          <svg viewBox="0 0 80 80" className="w-6 h-6 stroke-current stroke-[1.5] fill-none">
            <path d="M40,15 Q40,40 65,40 Q40,40 40,65 Q40,40 15,40 Q40,40 40,15 Z" className="fill-current/15" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Onboarding Splash Welcome Screen Overlay */}
      {showSplash ? (
        <div 
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-2xl select-none",
            splashClosing && "animate-splash-dissolve"
          )}
        >
          {/* Calming visual ambient backlights */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="w-80 h-80 rounded-full bg-primary/10 blur-3xl animate-pulse" />
            <div className="w-96 h-96 rounded-full bg-accent/5 blur-3xl animate-float delay-1000" />
            {/* Concentric rings pulsing like breathing guide */}
            <div className="absolute w-64 h-64 rounded-full border border-primary/20 breath-circle opacity-30" />
            <div className="absolute w-80 h-80 rounded-full border border-primary/10 breath-circle opacity-15 delay-150" />
          </div>

          {isOnboarding ? (
            <div className="z-10 w-full max-w-sm rounded-3xl p-8 aurora-card shadow-soft animate-in fade-in-0 slide-in-from-bottom-8 duration-700 ease-out text-center space-y-6">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary glow animate-float">
                <img src="/icon.svg" className="h-8 w-8 object-contain" alt="ZUKI Logo" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-3xl text-foreground font-semibold">Welcome to Zuki</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A calm space for your mind, habits, and growth. Let's start by personalizing your companion.
                </p>
              </div>
              <form onSubmit={handleOnboardSubmit} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">What should Zuki call you?</label>
                  <Input
                    type="text"
                    required
                    placeholder="Enter your name..."
                    value={onboardedName}
                    onChange={(e) => setOnboardedName(e.target.value)}
                    className="bg-background/40 text-center text-lg font-display tracking-wide focus:border-primary/50"
                  />
                </div>
                <Button type="submit" disabled={savingName || !onboardedName.trim()} className="w-full text-sm py-5 font-semibold">
                  {savingName ? "Preparing space..." : "Begin Journey"}
                </Button>
              </form>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={signOut}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
                >
                  Sign out / Switch account
                </button>
              </div>
            </div>
          ) : (
            /* Kinetic staggered greeting text */
            <div className="z-10 flex flex-col items-center justify-center text-center gap-4 px-6">
              <div 
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary glow animate-float opacity-0 animate-splash-fade"
                style={{ animationDelay: "150ms" }}
              >
                <img src="/icon.svg" className="h-8 w-8 object-contain" alt="ZUKI Logo" />
              </div>
              <h1 
                className="font-display text-4xl sm:text-5xl tracking-wide text-foreground opacity-0 animate-splash-fade"
                style={{ animationDelay: "600ms" }}
              >
                Hey {userName},
              </h1>
              <h1 
                className="font-display text-4xl sm:text-5xl tracking-wide text-primary shimmer-text font-semibold opacity-0 animate-splash-fade"
                style={{ animationDelay: "1600ms" }}
              >
                its Zuki.
              </h1>
            </div>
          )}
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-30 border-b border-border/40 bg-background/60 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
              <Link to="/today" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <img src="/icon.svg" className="h-5 w-5 object-contain" alt="ZUKI Logo" />
                </div>
                <span className="font-display text-xl">ZUKI</span>
              </Link>
              <nav className="flex items-center gap-1">
                {navItems.map((n) => {
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <Link
                      key={n.to}
                      to={n.to}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{n.label}</span>
                    </Link>
                  );
                })}
                <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} title="Profile settings" className="ml-1">
                  <User className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={signOut} title="Sign out" className="ml-1">
                  <LogOut className="h-4 w-4" />
                </Button>
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 animate-in fade-in duration-500">
            <Outlet />
          </main>

          {/* Profile settings dialog */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="aurora-card border-0 sm:max-w-md z-50">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl flex items-center">
                  <User className="mr-2 inline h-5 w-5 text-primary" />
                  Profile Settings
                </DialogTitle>
                <DialogDescription>
                  Update your display name to personalize Zuki's greetings.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Display Name</label>
                  <Input
                    type="text"
                    required
                    placeholder="Your Name (e.g. Thejas)"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="bg-background/40"
                  />
                </div>
                <Button type="submit" disabled={savingName} className="w-full">
                  {savingName ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
