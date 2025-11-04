import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import supabase from '../services/supabaseClient';

function MyApp({ Component, pageProps }) {
  const { user, session } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          navigate('/login');
        }
      }
    );

    // Check initial session state
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      }
    };

    checkSession();

    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate]);

  return <Component {...pageProps} />;
}

export default MyApp;