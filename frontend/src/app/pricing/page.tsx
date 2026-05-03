"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, Bot, Zap, ArrowRight, XCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function PricingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>("startup");
  const [userStatus, setUserStatus] = useState<string>("active");
  const [usageLimit, setUsageLimit] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          router.push("/auth?mode=login");
          return;
        }
        
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setCurrentPlan(data.plan || "startup");
            setUserStatus(data.subscriptionStatus || "active");
            
            // If they are on startup plan and reached message limit
            if (data.plan === "startup" && data.stats?.messages >= 100) {
              setUsageLimit(true);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      });
    };
    checkUserStatus();
  }, [router]);

  const handleCheckout = async (planId: string) => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    if (planId === "startup") {
      // Free plan logic - just redirect if limit isn't reached
      if (!usageLimit) {
        // Automatically ensure they have startup plan in DB
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          plan: "startup",
          subscriptionStatus: "active"
        });
        router.push("/dashboard");
      }
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: auth.currentUser.uid,
          email: auth.currentUser.email,
          planId: planId,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        console.error("Backend error:", data.error);
        alert(`Checkout failed: ${data.error || 'Unknown error'}`);
        setLoading(false);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to initiate checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="flex justify-center mb-6">
            <div className="text-primary bg-primary/10 p-3 rounded-2xl">
              <Bot className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-foreground/60 mb-4">
            Unlock the full power of AI-driven WhatsApp automation.
          </p>
          
          {userStatus === "inactive" && (
             <div className="mt-6 inline-flex items-center gap-3 glass-panel px-6 py-4 rounded-xl border border-red-500/30 bg-red-500/10">
               <XCircle className="w-6 h-6 text-red-500 shrink-0" />
               <div className="text-left">
                  <p className="text-red-200 font-medium">Your subscription is inactive.</p>
                  <p className="text-red-200/70 text-sm">Please select a plan to restore platform access.</p>
               </div>
             </div>
          )}

          {usageLimit && currentPlan === "startup" && userStatus !== "inactive" && (
             <div className="mt-6 inline-flex items-center gap-3 glass-panel px-6 py-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
               <Zap className="w-6 h-6 text-yellow-500 shrink-0" />
               <div className="text-left">
                  <p className="text-yellow-200 font-medium">Your free trial has ended.</p>
                  <p className="text-yellow-200/70 text-sm">Please upgrade your plan to continue.</p>
               </div>
             </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Startup (Free) */}
          <div className={`glass-panel rounded-3xl p-8 border flex flex-col ${currentPlan === 'startup' ? 'border-primary/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' : 'border-white/10'}`}>
            <h3 className="text-2xl font-bold text-white mb-2">Startup Plan</h3>
            <p className="text-foreground/60 text-sm mb-6 flex-1">Perfect for testing the AI WhatsApp capabilities before scaling.</p>
            <div className="mb-8">
              <span className="text-4xl font-extrabold text-white">Free</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">100 messages free limit</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">Voice AI feature access</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">Basic Support</span>
              </li>
            </ul>
            <button 
              onClick={() => handleCheckout("startup")}
              disabled={loading || usageLimit || userStatus === "inactive"}
              className="w-full py-4 px-6 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {usageLimit ? "Limit Reached" : currentPlan === "startup" ? "Current Plan" : "Get Started"}
              {!usageLimit && currentPlan !== "startup" && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Starter (PKR 1000) */}
          <div className="glass-panel rounded-3xl p-8 border border-primary bg-primary/5 shadow-[0_0_40px_rgba(99,102,241,0.2)] transform md:-translate-y-4 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-purple-600" />
            <div className="inline-flex max-w-fit px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-semibold mb-4 mx-auto md:mx-0">
              POPULAR
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Starter Plan</h3>
            <p className="text-foreground/60 text-sm mb-6 flex-1">For growing businesses needing stable, standard AI agent operations.</p>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">PKR 1000</span>
              <span className="text-foreground/50">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground/80">Full unrestricted messages</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground/80">All current system features</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground/80">Full Auto-Orders & Leads Dashboard</span>
              </li>
            </ul>
            <button 
              onClick={() => handleCheckout("starter")}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl btn-primary text-white font-semibold shadow-lg hover:shadow-primary/25 disabled:opacity-50 transition-all flex justify-center items-center gap-2"
            >
              {loading ? "Processing..." : "Subscribe Now"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Starter Pro Plus (PKR 2000) */}
          <div className={`glass-panel rounded-3xl p-8 border flex flex-col ${currentPlan === 'starter_pro' ? 'border-primary/50' : 'border-white/10'}`}>
            <h3 className="text-2xl font-bold text-white mb-2">Starter Pro Plus</h3>
            <p className="text-foreground/60 text-sm mb-6 flex-1">For power users requiring custom integrations and advanced APIs.</p>
            <div className="mb-8 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white">PKR 2000</span>
              <span className="text-foreground/50">/month</span>
            </div>
            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">Everything in Starter</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">API Access (Coming Soon)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">Webhooks (Coming Soon)</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-foreground/80">Priority Support</span>
              </li>
            </ul>
            <button 
              onClick={() => handleCheckout("starter_pro")}
              disabled={loading}
              className="w-full py-4 px-6 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? "Processing..." : "Subscribe to Pro"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
