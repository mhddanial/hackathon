"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F7FA] relative flex flex-col items-center justify-center p-4">
      
      {/* Background Brand Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <div className="relative flex items-center justify-center opacity-30">
          <div className="w-[600px] h-[600px] rounded-full border-[16px] border-[#E2E8F0] absolute"></div>
          <div className="w-[500px] h-[500px] rounded-full border-[16px] border-[#E2E8F0] absolute"></div>
          
          {/* Abstract criss-cross lines */}
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute rotate-[30deg] rounded-full"></div>
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute -rotate-[30deg] rounded-full"></div>
          <div className="w-[800px] h-[40px] bg-[#E2E8F0] absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
          
          {/* FLOW Text */}
          <div className="absolute left-[350px] font-bold text-[#E2E8F0] text-[150px] tracking-tighter">FLOW</div>
        </div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[420px] bg-white rounded-xl shadow-xl shadow-slate-200/50 p-8 sm:p-10 border border-slate-100">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-10 h-10 rounded-md border border-slate-200 flex items-center justify-center bg-blue-50/50 mb-6">
            <span className="text-blue-600 font-serif font-bold text-xl leading-none">C</span>
          </div>
          <h1 className="text-2xl font-serif text-slate-900 mb-2">Welcome back</h1>
          <p className="text-sm text-slate-500">Sign in to manage your cross-border logistics.</p>
        </div>

        {/* Form */}
        <form className="space-y-5">
          
          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900 block" htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email"
              placeholder="name@company.com" 
              className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
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
                className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-slate-50/50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pr-12"
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
            <Link href="/dashboard" className="w-full">
              <button 
                type="button" 
                className="w-full h-12 rounded-lg bg-[#003380] hover:bg-blue-900 text-white font-medium text-sm transition-colors shadow-md shadow-blue-900/10"
              >
                Sign In
              </button>
            </Link>
            
            <button 
              type="button" 
              className="w-full h-12 rounded-lg bg-white hover:bg-slate-50 text-slate-900 font-medium text-sm border border-slate-200 transition-colors"
            >
              Create account
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
