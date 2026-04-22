"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { 
  MessageSquare, 
  Bot, 
  Zap, 
  BarChart3, 
  ShieldCheck, 
  Users,
  ChevronRight,
  Sparkles
} from "lucide-react";

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute top-[40%] right-[-10%] w-[30%] h-[50%] rounded-full bg-secondary/15 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-500/10 blur-[130px]" />
      </div>

      {/* Header */}
      <header className="fixed top-0 w-full z-50 glass-panel border-b-0 border-white/5 rounded-b-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Bot className="text-white w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-wide text-white">Antigravity<span className="text-primary">Chat</span></span>
          </div>

          <nav className="hidden md:flex flex-1 justify-center gap-8 text-sm font-medium text-foreground/80">
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="#about" className="hover:text-white transition-colors">About</Link>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/auth?mode=login" className="text-sm font-medium text-white hover:text-primary transition-colors">
              Login
            </Link>
            <Link href="/auth?mode=signup" className="text-sm font-medium btn-primary px-5 py-2.5 rounded-full hover-lift flex items-center gap-2">
              Sign Up <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32">
        {/* Hero Section */}
        <section className="relative px-6 pt-20 pb-32 max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-pill text-xs font-medium text-secondary mb-8">
              <Sparkles className="w-4 h-4" />
              <span>Next-Gen WhatsApp AI Automation</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-[1.1]">
              Automate WhatsApp with <br className="hidden md:block" />
              <span className="text-gradient">Superhuman AI</span>
            </h1>
            
            <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mx-auto mb-10">
              Connect your WhatsApp via QR code and let AI handle your customer support, lead generation, and sales 24/7. Never miss a message again.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth?mode=signup" className="w-full sm:w-auto btn-primary px-8 py-4 rounded-full text-lg font-medium hover-lift flex items-center justify-center gap-2">
                Get Started Free <ChevronRight className="w-5 h-5" />
              </Link>
              <Link href="#features" className="w-full sm:w-auto glass-panel px-8 py-4 rounded-full text-lg font-medium hover-lift text-white transition-colors border border-white/10 hover:bg-white/5">
                Explore Features
              </Link>
            </div>
          </motion.div>
          
          {/* Dashboard Preview Mockup */}
          <motion.div 
            className="mt-24 relative mx-auto max-w-5xl rounded-2xl glass-panel p-2 shadow-2xl shadow-primary/20"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 rounded-2xl"></div>
            <div className="rounded-xl overflow-hidden bg-[#1a1d2d] aspect-[16/9] relative border border-white/10 flex flex-col">
              {/* Fake Header */}
              <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                </div>
                <div className="ml-4 h-6 w-48 bg-white/5 rounded mx-auto"></div>
              </div>
              {/* Fake Content */}
              <div className="flex flex-1">
                {/* Sidebar */}
                <div className="w-64 border-r border-white/5 p-4 flex flex-col gap-3">
                  <div className="h-8 bg-white/5 rounded-md w-full"></div>
                  <div className="h-12 bg-primary/20 rounded-md w-full border border-primary/30"></div>
                  <div className="h-12 bg-white/5 rounded-md w-full"></div>
                  <div className="h-12 bg-white/5 rounded-md w-full"></div>
                </div>
                {/* Main */}
                <div className="flex-1 p-8 flex flex-col gap-6">
                  <div className="flex gap-4">
                    <div className="h-32 bg-white/5 rounded-xl w-1/3 p-4 border border-white/10 flex flex-col justify-end"><div className="h-4 bg-white/20 w-1/2 rounded"></div></div>
                    <div className="h-32 bg-white/5 rounded-xl w-1/3 p-4 border border-white/10 flex flex-col justify-end"><div className="h-4 bg-white/20 w-3/4 rounded"></div></div>
                    <div className="h-32 bg-primary/10 rounded-xl w-1/3 p-4 border border-primary/20 flex flex-col justify-end"><div className="h-4 bg-primary/40 w-2/3 rounded"></div></div>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-xl border border-white/10"></div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">Enterprise Features</h2>
              <p className="text-foreground/70 max-w-2xl mx-auto">Everything you need to scale your WhatsApp operations automatically.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Zap, title: "Instant QR Login", desc: "No complex API setups. Just scan the QR code like WhatsApp Web and you're connected." },
                { icon: Bot, title: "24/7 AI Autopilot", desc: "Your AI agent responds instantly to leads and customers, even when your laptop is closed." },
                { icon: ShieldCheck, title: "Isolated User Data", desc: "Enterprise-grade security with completely isolated data and sessions for every user." },
                { icon: Users, title: "Lead Generation", desc: "Automatically capture names, phones, and emails from chats straight into your CRM." },
                { icon: MessageSquare, title: "Bulk Messaging", desc: "Send targeted campaigns to your contacts with intelligent anti-ban delays." },
                { icon: BarChart3, title: "Rich Analytics", desc: "Track messaging volume, AI vs Human resolution rates, and team performance." },
              ].map((feature, i) => (
                <div key={i} className="glass-panel p-8 rounded-2xl hover-lift border border-white/5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 text-primary">
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-foreground/60 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-background/50 relative z-10 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="text-primary w-6 h-6" />
              <span className="text-xl font-bold text-white">Antigravity<span className="text-primary">Chat</span></span>
            </div>
            <p className="text-foreground/60 max-w-sm">
              The ultimate Multi-User WhatsApp AI Agent Platform. Automate, scale, and dominate your customer communication.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="#features" className="text-foreground/60 hover:text-white transition-colors">Features</Link></li>
              <li><Link href="#pricing" className="text-foreground/60 hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="#about" className="text-foreground/60 hover:text-white transition-colors">About</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-foreground/60 hover:text-white transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/privacy" className="text-foreground/60 hover:text-white transition-colors">Privacy Policy</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between">
          <p className="text-foreground/50 text-sm">© 2026 AntigravityChat. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
