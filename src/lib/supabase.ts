import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gwsggzowjibnwbnllctz.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3c2dnem93amlibndibmxsY3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDE2ODMsImV4cCI6MjEwMjA3NzY4M30.F5gsxD_CwyQ_txBzI6qb-RboTXioF5UaKJDCNRCVlH4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function signInWithGitHub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) console.error('[supabase] GitHub OAuth error:', error);
}

export async function signOut() {
  await supabase.auth.signOut();
}
