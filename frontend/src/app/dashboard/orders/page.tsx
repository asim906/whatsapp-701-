"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, Search, Filter, Trash2, CheckCircle2, Package, Clock } from "lucide-react";
import { auth } from "@/lib/firebase";

interface Order {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  customerName: string;
  customerPhone: string;
  address: string;
  status: "pending" | "confirmed" | "delivered";
  timestamp: string;
}

const BACKEND_URL = "https://whatsapp-701-production.up.railway.app";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "delivered">("all");
  const [search, setSearch] = useState("");

  const fetchOrders = async () => {
    if (!auth.currentUser) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${auth.currentUser.uid}`);
      if (res.ok) {
        const data = await res.json();
        // Sort newest first
        setOrders(data.sort((a: Order, b: Order) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDelete = async (orderId: string) => {
    if (!auth.currentUser) return;
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      await fetch(`${BACKEND_URL}/api/orders/${auth.currentUser.uid}/${orderId}`, {
        method: "DELETE"
      });
      setOrders(orders.filter(o => o.id !== orderId));
    } catch (error) {
      console.error("Failed to delete order", error);
    }
  };

  const updateStatus = async (order: Order, newStatus: Order["status"]) => {
    if (!auth.currentUser) return;
    try {
      const updatedOrder = { ...order, status: newStatus };
      await fetch(`${BACKEND_URL}/api/orders/${auth.currentUser.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedOrder)
      });
      setOrders(orders.map(o => o.id === order.id ? updatedOrder : o));
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search && !o.customerName.toLowerCase().includes(search.toLowerCase()) && !o.productName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary" />
            Orders Management
          </h1>
          <p className="text-foreground/60 mt-2">Track, manage and fulfill your customer orders.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ShoppingBag className="w-16 h-16 text-white" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">Total Orders</p>
          <h3 className="text-3xl font-bold text-white">{orders.length}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-yellow-500/50 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="w-16 h-16 text-yellow-500" />
            </div>
            <p className="text-sm font-medium text-foreground/60 mb-1">Pending Processing</p>
            <h3 className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'pending').length}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Package className="w-16 h-16 text-blue-500" />
            </div>
            <p className="text-sm font-medium text-foreground/60 mb-1">Confirmed</p>
            <h3 className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'confirmed').length}</h3>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-green-500/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          </div>
          <p className="text-sm font-medium text-foreground/60 mb-1">Total Delivered</p>
          <h3 className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'delivered').length}</h3>
        </div>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden flex flex-col h-[600px] shadow-xl">
        <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-2 p-1 bg-black/20 rounded-lg overflow-x-auto">
            {(["all", "pending", "confirmed", "delivered"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all ${
                  filter === f 
                    ? "bg-primary text-white shadow-md" 
                    : "text-foreground/70 hover:text-white hover:bg-white/5"
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50" />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="bg-white/5 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Date</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Customer</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Product</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Qty</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Total (PKR)</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10">Status</th>
                <th className="px-6 py-4 text-sm font-medium text-foreground/60 border-b border-white/10 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-foreground/50">
                    <div className="flex justify-center mb-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-foreground/50">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    No orders found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-sm text-foreground/70">
                        {new Date(order.timestamp).toLocaleDateString()}
                        <div className="text-xs text-foreground/40">{new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{order.customerName}</div>
                      <div className="text-xs text-foreground/50">{order.customerPhone}</div>
                      {order.address && order.address !== "Unknown" && <div className="text-xs text-foreground/50 truncate max-w-[150px]" title={order.address}>{order.address}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80 font-medium">
                      {order.productName}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80">
                      x{order.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80 font-semibold text-green-400">
                      {order.totalPrice.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                        <select 
                            value={order.status}
                            onChange={(e) => updateStatus(order, e.target.value as any)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full outline-none appearance-none cursor-pointer border ${
                                order.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                'bg-green-500/10 text-green-500 border-green-500/20'
                            }`}
                        >
                            <option value="pending" className="bg-background text-foreground">Pending</option>
                            <option value="confirmed" className="bg-background text-foreground">Confirmed</option>
                            <option value="delivered" className="bg-background text-foreground">Delivered</option>
                        </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(order.id)}
                        className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
