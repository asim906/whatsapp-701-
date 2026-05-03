"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Bot, 
  LayoutDashboard, 
  MessageSquare, 
  BarChart3, 
  Users, 
  Store, 
  Settings, 
  LogOut,
  ShoppingBag,
  Zap,
  Menu,
  X
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { SyncEngine } from "@/components/SyncEngine";

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Check if we just returned from a successful Stripe checkout
    const urlParams = new URLSearchParams(window.location.search);
    const isSuccess = urlParams.get("success") === "true";
    const sessionId = urlParams.get("session_id");
    
    if (isSuccess) {
      setVerifyingPayment(true);
      
      // Fallback: If webhook didn't run (common in local dev), trigger manual verification
      if (sessionId) {
        fetch(`${BACKEND_URL}/api/stripe/verify-session?session_id=${sessionId}`)
          .then(res => res.json())
          .then(data => console.log("Stripe fallback verification:", data))
          .catch(err => console.error("Verify session error:", err));
      }
    }

    let firestoreUnsubscribe: (() => void) | undefined;
    
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/auth?mode=login");
        if (firestoreUnsubscribe) firestoreUnsubscribe();
      } else {
        firestoreUnsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            
            // If we are waiting for payment verification, stay in loading until it's active
            if (isSuccess && data.subscriptionStatus !== "active") {
               // Just wait, the webhook will update this document soon
               return;
            }

            if (isSuccess && data.subscriptionStatus === "active") {
               setVerifyingPayment(false);
               window.history.replaceState({}, '', '/dashboard');
            }
            
            if (data.subscriptionStatus === "inactive" && !isSuccess) {
              router.push("/pricing");
            } else if (data.plan === "startup" && data.stats?.messages >= 100 && !isSuccess) {
              router.push("/pricing?limit=true");
            } else {
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        }, (error) => {
          console.error("Firestore listen error", error);
          setLoading(false);
        });
      }
    });

    return () => {
      authUnsubscribe();
      if (firestoreUnsubscribe) firestoreUnsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Chats", href: "/dashboard/chats", icon: MessageSquare },
    { name: "Leads", href: "/dashboard/leads", icon: Users },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
    { name: "Store", href: "/dashboard/store", icon: Store },
    { name: "Orders", href: "/dashboard/orders", icon: ShoppingBag },
    { name: "Tools & Bulk", href: "/dashboard/tools", icon: Zap },
    { name: "AI Settings", href: "/dashboard/settings", icon: Settings },
  ];

  if (loading || verifyingPayment) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-center items-center gap-4">
        <Bot className="w-12 h-12 text-primary animate-bounce opacity-80" />
        {verifyingPayment && (
          <div className="text-center animate-pulse">
            <h2 className="text-xl font-bold text-white mb-2">Verifying Payment...</h2>
            <p className="text-foreground/60 text-sm">Please wait while we activate your subscription.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 glass-panel border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } lg:static lg:block`}
      >
        <div className="p-6 flex items-center gap-2 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-wide text-white">Antigravity</span>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1.5 scrollbar-thin">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(99,102,241,0.1)]" 
                    : "text-foreground/70 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-foreground/50 group-hover:text-foreground/80"}`} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all w-full text-left"
          >
            <LogOut className="w-5 h-5 opacity-70" />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <SyncEngine />
        
        {/* Top Header Layer */}
        {userData?.plan === "startup" && (
          <div className="absolute top-4 right-4 md:top-8 md:right-8 z-50">
            <div className="glass-panel px-4 py-3 rounded-2xl border border-white/10 flex flex-col gap-2 min-w-[200px] shadow-lg animate-in fade-in slide-in-from-top-4">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-foreground/70 uppercase tracking-wider">Trial Usage</span>
                <span className={`transition-colors ${
                    (userData?.stats?.messages || 0) >= 100 ? 'text-red-400' : 
                    (userData?.stats?.messages || 0) >= 80 ? 'text-yellow-400' : 'text-white'
                  }`}>
                  {Math.min(userData?.stats?.messages || 0, 100)}%
                </span>
              </div>
              <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden shadow-inner">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    (userData?.stats?.messages || 0) >= 100 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                    (userData?.stats?.messages || 0) >= 80 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                  }`}
                  style={{ width: `${Math.min(userData?.stats?.messages || 0, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-foreground/50 text-right mt-0.5">
                {userData?.stats?.messages || 0} / 100 Messages Used
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 pt-24 lg:pt-10 scrollbar-thin relative z-0">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
