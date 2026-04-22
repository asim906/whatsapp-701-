"use client";

import { useEffect, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, MessageSquare, Bot, Users } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

export default function AnalyticsPage() {
  const [user] = useAuthState(auth);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch(`http://localhost:3001/api/analytics/${user.uid}`)
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => console.error("Analytics fetch error:", err));
  }, [user]);

  if (loading) return <div className="text-foreground/50 p-8">Loading Analytics...</div>;

  // Process last 7 days for chart
  const getLast7Days = () => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dateKey = d.toISOString().split('T')[0];
      const stats = data?.daily?.[dateKey] || { messages: 0, aiResponses: 0, humanResponses: 0 };
      result.push({ day: dayStr, ...stats });
    }
    return result;
  };

  const chartData = getLast7Days();
  const maxVal = Math.max(...chartData.map(d => Math.max(d.aiResponses, d.humanResponses))) + 10;
  
  const totals = data.totals;

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-white">Analytics</h1>
        <p className="text-foreground/60 mt-1">Track your AI agent performance and message stats.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Total Messages (Overall)", value: totals.messages, icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "AI Responses", value: totals.aiResponses, icon: Bot, color: "text-primary", bg: "bg-primary/10" },
          { label: "Human Responses", value: totals.humanResponses, icon: Users, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <div key={i} className="glass-panel p-6 rounded-2xl border border-white/5">
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-4 ${stat.color}`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-foreground/50 text-sm">{stat.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="glass-panel rounded-2xl border border-white/5 p-6 md:p-8">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="text-xl font-bold text-white">Daily Messages (Last 7 Days)</h2>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary"></div><span className="text-foreground/60">AI</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500"></div><span className="text-foreground/60">Human</span></div>
          </div>
        </div>

        {/* Chart */}
        <div className="flex items-end gap-3 h-48">
          {chartData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 items-end" style={{ height: "160px" }}>
                <div
                  className="flex-1 rounded-t-lg bg-primary/70 hover:bg-primary transition-colors"
                  style={{ height: `${(d.aiResponses / maxVal) * 100}%` }}
                  title={`AI: ${d.aiResponses}`}
                />
                <div
                  className="flex-1 rounded-t-lg bg-purple-500/70 hover:bg-purple-500 transition-colors"
                  style={{ height: `${(d.humanResponses / maxVal) * 100}%` }}
                  title={`Human: ${d.humanResponses}`}
                />
              </div>
              <span className="text-xs text-foreground/40">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI vs Human */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Resolution Rate</h3>
          <div className="space-y-4">
            {totals.aiResponses + totals.humanResponses > 0 ? (
              <>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground/60">AI Handled</span>
                    <span className="text-primary font-semibold">
                      {Math.round((totals.aiResponses / (totals.aiResponses + totals.humanResponses)) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(totals.aiResponses / (totals.aiResponses + totals.humanResponses)) * 100}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-foreground/60">Human Handled</span>
                    <span className="text-purple-400 font-semibold">
                      {Math.round((totals.humanResponses / (totals.aiResponses + totals.humanResponses)) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(totals.humanResponses / (totals.aiResponses + totals.humanResponses)) * 100}%` }}></div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground/40 text-center py-4">No data to calculate resolution rate.</p>
            )}
          </div>
        </div>

        <div className="glass-panel rounded-2xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Stats</h3>
          <div className="space-y-3">
            {[
              { label: "Total Leads Captured", value: totals.leads || "0", trend: "up" },
              { label: "Messages (Total History)", value: totals.messages || "0", trend: "up" },
              { label: "AI Completion Rate", value: "High", trend: "up" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <span className="text-foreground/60 text-sm">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm">{item.value}</span>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
