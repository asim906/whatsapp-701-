"use client";

import { useState, useEffect } from "react";
import { Store, Package, Plus, Trash2, Tag, DollarSign, Image as ImageIcon } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";

const CATEGORIES = ["Shoes", "Watches", "T-Shirts", "All"];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function StorePage() {
  const [user] = useAuthState(auth);
  const [products, setProducts] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newProduct, setNewProduct] = useState({ title: "", description: "", price: "", stock: "", category: "Shoes", imageUrl: "" });

  const fetchProducts = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/store/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const filtered = activeCategory === "All" ? products : products.filter(p => p.category === activeCategory);

  const addProduct = async () => {
    if (!newProduct.title || !newProduct.price || !user) return;
    
    const productData = {
      ...newProduct,
      id: Date.now().toString(),
      price: parseFloat(newProduct.price),
      stock: parseInt(newProduct.stock) || 0,
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/store/${user.uid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });
      if (res.ok) {
        setProducts([...products, productData]);
        setNewProduct({ title: "", description: "", price: "", stock: "", category: "Shoes", imageUrl: "" });
        setShowAdd(false);
      }
    } catch (err) {
      console.error("Failed to add product:", err);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/store/${user.uid}/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts(products.filter(p => p.id !== productId));
      }
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Store</h1>
          <p className="text-foreground/60 mt-1">Manage your product catalog for AI-powered sales.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${activeCategory === cat
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-white/5 border-white/10 text-foreground/60 hover:text-white hover:bg-white/10"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Add Product Panel */}
      {showAdd && (
        <div className="glass-panel border border-primary/20 rounded-2xl p-6 bg-primary/[0.02]">
          <h3 className="text-lg font-semibold text-white mb-4">New Product</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Product Title *" value={newProduct.title} onChange={e => setNewProduct({...newProduct, title: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="Shoes">Shoes</option>
              <option value="Watches">Watches</option>
              <option value="T-Shirts">T-Shirts</option>
            </select>
            <input placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 md:col-span-2" />
            <input placeholder="Image URL (Direct link to photo)" value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 md:col-span-2" />
            <input type="number" placeholder="Price (PKR) *" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <input type="number" placeholder="Stock Quantity" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addProduct} className="btn-primary px-6 py-2.5 rounded-xl font-medium text-sm">Add Product</button>
            <button onClick={() => setShowAdd(false)} className="px-6 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 font-medium text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-10 text-foreground/40">Loading products...</div>
        ) : filtered.map(product => (
          <div key={product.id} className="glass-panel rounded-2xl border border-white/5 p-6 hover-lift">
            <div className="aspect-video w-full bg-primary/10 rounded-xl mb-4 overflow-hidden relative group">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-10 h-10 text-primary opacity-40" />
                </div>
              )}
              <button onClick={() => deleteProduct(product.id)}
                className="absolute top-2 right-2 p-2 rounded-xl bg-black/40 backdrop-blur-md opacity-0 group-hover:opacity-100 text-white hover:text-red-400 transition-all z-10">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-foreground/60 mb-3">
              <Tag className="w-3 h-3" />{product.category}
            </span>

            <h3 className="font-bold text-white mb-1">{product.title}</h3>
            <p className="text-foreground/50 text-sm mb-4 line-clamp-2">{product.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-white font-bold text-lg">
                <DollarSign className="w-4 h-4 text-green-400" />
                PKR {product.price?.toLocaleString()}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${product.stock > 0 ? (product.stock > 10 ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400") : "bg-red-500/10 text-red-400"}`}>
                {product.stock > 0 ? `${product.stock} left` : "Out of Stock"}
              </span>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="col-span-3 py-24 text-center text-foreground/40">
            <Store className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No products in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
