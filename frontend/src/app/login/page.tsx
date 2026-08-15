"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (signInError) throw signInError;
      
      // Successfully logged in, AuthProvider will catch this via onAuthStateChange
      router.push("/dashboard");
      
    } catch (err: any) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "An error occurred with Google Sign-In.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FA] relative flex flex-col items-center justify-center p-4">
      
      {/* Background Brand Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <div className="relative flex items-center justify-center opacity-30">
          <div className="w-[600px] h-[600px] rounded-full border-[16px] border-[#E2E8F0] absolute"></div>
          <div className="w-[500px] h-[500px] rounded-full border-[16px] border-[#E2E8F0] absolute"></div>
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute rotate-[30deg] rounded-full"></div>
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute -rotate-[30deg] rounded-full"></div>
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
          <div className="absolute left-[350px] font-bold text-[#E2E8F0] text-[150px] tracking-tighter">FLOW</div>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white rounded-xl shadow-xl shadow-slate-200/50 p-8 sm:p-10 border border-slate-100">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo-icon.png" alt="SmartFlow Logo" className="w-14 h-14 object-contain mb-4" />
          <h1 className="text-2xl font-serif text-slate-900 mb-2">Welcome back</h1>
          <p className="text-sm text-slate-500">Sign in to manage your cross-border logistics.</p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full h-12 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm border border-slate-200 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md mb-5"
        >
          {/* Google Icon */}
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-slate-200"></div>
          <span className="text-xs text-slate-400 font-medium">sign in with email</span>
          <div className="flex-1 h-px bg-slate-200"></div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form className="space-y-5" onSubmit={handleLogin}>
          
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900 block" htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email"
              placeholder="name@company.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-900 block" htmlFor="password">Password</label>
              <Link href="#" className="text-xs font-medium text-blue-800 hover:text-blue-600 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                id="password"
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pr-12"
                required
              />
              <button 
                type="button" 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-3 pt-1 pb-2">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                id="remember" 
                className="peer h-4 w-4 appearance-none rounded border border-slate-300 checked:bg-blue-600 checked:border-blue-600 focus:outline-none transition-colors cursor-pointer"
              />
              <svg className="absolute w-3 h-3 left-0.5 top-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer select-none">Stay signed in</label>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full h-12 rounded-lg bg-[#003380] hover:bg-blue-900 disabled:bg-blue-400 text-white font-medium text-sm transition-colors shadow-md shadow-blue-900/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </button>
            
            <Link href="/register" className="w-full">
              <button 
                type="button" 
                className="w-full h-12 rounded-lg bg-white hover:bg-slate-50 text-slate-900 font-medium text-sm border border-slate-200 transition-colors"
              >
                Create account
              </button>
            </Link>
          </div>

        </form>

      </div>
    </div>
  );
}
