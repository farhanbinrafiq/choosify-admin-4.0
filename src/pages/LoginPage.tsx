import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bolt, LayoutDashboard, Building2, Award, Users, ChevronRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth, UserRole } from '../contexts/AuthContext';
import { ChoosifyLogo } from '../components/common/ChoosifyLogo';

const ALLOWED_ROLES: UserRole[] = ['super_admin', 'seller', 'creator', 'moderator'];

function resolveRoleParam(value: string | null): UserRole | null {
  if (!value) return null;
  return ALLOWED_ROLES.includes(value as UserRole) ? (value as UserRole) : null;
}

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const prefillEmail = searchParams.get('email')?.trim() || '';
  const intent = searchParams.get('intent');
  const nextPath = searchParams.get('next')?.trim() || '';
  const roleFromQuery = resolveRoleParam(searchParams.get('role'));

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(roleFromQuery || 'super_admin');
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const isJoinIntent = intent === 'join';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const role = await loginWithEmail(email, password, selectedRole);
    
    let redirectPath = '/admin/dashboard';
    if (nextPath.startsWith('/') && !nextPath.startsWith('//')) {
      redirectPath = nextPath;
    } else if (role === 'seller') {
      redirectPath = '/seller/products';
    } else if (role === 'creator') {
      redirectPath = '/dashboard/content-studio/guides';
    }
    
    navigate(redirectPath);
  };

  const roles: { role: UserRole; label: string; icon: any; color: string; desc: string }[] = [
    { role: 'super_admin', label: 'Admin', icon: ShieldCheck, color: 'from-purple-500 to-indigo-600', desc: 'Platform control & monitoring' },
    { role: 'seller', label: 'Seller', icon: Building2, color: 'from-orange-500 to-red-600', desc: 'Manage products & orders' },
    { role: 'creator', label: 'Creator', icon: Award, color: 'from-blue-500 to-cyan-600', desc: 'Campaigns & engagement' },
    { role: 'moderator', label: 'Staff (optional)', icon: Users, color: 'from-teal-500 to-emerald-600', desc: 'Platform operations & support' },
  ];

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 font-sans relative">
      <a
        href="https://choosify.bd"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-8 left-8 flex items-center gap-2 text-app-text-secondary hover:text-white transition-colors text-sm font-bold"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Visit choosify.bd
      </a>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-app-card rounded-[2.5rem] overflow-hidden shadow-2xl border border-app-border">
         {/* Left Side: Illustration / Info */}
         <div className="hidden lg:flex flex-col justify-between p-12 bg-app-sidebar relative overflow-hidden group">
            <div className="relative z-10">
               <div className="flex items-center gap-3 mb-10">
                  <ChoosifyLogo variant="full" theme="dark" className="h-9 w-auto select-none" />
               </div>
               <h2 className="text-4xl font-extrabold text-white tracking-tight mb-6 leading-tight">
                  Discover <br/> Bangladesh's <br/> finest products.
               </h2>
               <p className="text-app-text-secondary text-sm leading-relaxed max-w-xs">
                  A unified ecosystem for buyers, sellers, and creators to connect and thrive.
               </p>
            </div>
            <div className="relative z-10 text-[10px] text-app-text-secondary uppercase font-bold tracking-widest opacity-40">
               © 2026 Choosify Bangladesh Ltd.
            </div>
            
            {/* Abstract Background Design */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-app-accent rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity" />
            <div className="absolute bottom-[-5%] left-[-5%] w-48 h-48 bg-blue-500 rounded-full blur-[100px] opacity-10 group-hover:opacity-20 transition-opacity" />
         </div>

         {/* Right Side: Login Form */}
         <div className="p-8 md:p-12">
            <div className="mb-8">
               <h3 className="text-2xl font-bold text-white mb-2">
                 {isJoinIntent ? 'Join as a Seller' : 'Welcome Back'}
               </h3>
               <p className="text-sm text-app-text-secondary">
                 {isJoinIntent
                   ? 'Confirm your password to create or link your seller dashboard account with this email.'
                   : 'Please sign in to your dashboard'}
               </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
               <div className="space-y-4">
                  <div className="space-y-1.5">
                     <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">Email Address</label>
                     <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                        <input 
                           type="email" 
                           required
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           placeholder="admin@choosify.com.bd"
                           className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5">
                     <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">Password</label>
                     <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-secondary opacity-50" />
                        <input 
                           type="password" 
                           required
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
                           placeholder="••••••••"
                           className="w-full bg-app-sidebar border border-app-border rounded-xl px-12 py-3.5 text-sm text-white focus:border-app-accent transition-colors outline-none placeholder:text-app-text-secondary/30"
                        />
                     </div>
                  </div>
               </div>

               <div className="space-y-4 pt-2">
                  <label className="text-[10px] text-app-text-secondary uppercase font-bold tracking-widest px-1">Access Role <span className="text-app-accent-light">(Prototype selection)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                     {roles.map((r) => (
                       <button
                         key={r.role}
                         type="button"
                         onClick={() => setSelectedRole(r.role)}
                         className={`relative flex flex-col items-start p-4 rounded-2xl border transition-all text-left group ${
                           selectedRole === r.role 
                             ? 'bg-app-accent/10 border-app-accent shadow-lg shadow-app-accent/5' 
                             : 'bg-app-sidebar border-app-border hover:bg-white/5 hover:border-white/20'
                         }`}
                       >
                          <r.icon className={`w-5 h-5 mb-2 ${selectedRole === r.role ? 'text-app-accent-light' : 'text-app-text-secondary'}`} />
                          <div className={`text-[11px] font-bold ${selectedRole === r.role ? 'text-white' : 'text-app-text-secondary group-hover:text-white'}`}>{r.label}</div>
                          {selectedRole === r.role && (
                             <motion.div layoutId="activeRole" className="absolute top-2 right-2 w-1.5 h-1.5 bg-app-accent-light rounded-full" />
                          )}
                       </button>
                     ))}
                  </div>
               </div>

               <button 
                  type="submit"
                  className="w-full bg-app-accent hover:bg-app-accent-light text-white font-bold py-4 rounded-2xl shadow-xl shadow-app-accent/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2 group"
               >
                  <span>Sign In</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
               </button>
               
               <div className="text-center">
                  <button type="button" className="text-[10px] text-app-text-secondary uppercase tracking-widest font-bold hover:text-white transition-colors">Forgot your password?</button>
               </div>
            </form>
         </div>
      </div>
    </div>
  );
}
