import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import supabase from "../../services/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

interface OAuthButtonProps {
  provider: 'google' | 'github' | 'azure';
  children: React.ReactNode;
  className?: string;
}

export function OAuthButton({ provider, children, className = "" }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuthStore();

  const handleOAuthLogin = async () => {
    try {
      setLoading(true);
      
      // Clear any existing auth state before OAuth
      await signOut();
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
  
      if (error) {
        console.error(`${provider} OAuth error:`, error.message);
        return;
      }
    } catch (error) {
      console.error(`${provider} OAuth error:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={`w-full ${className}`}
      onClick={handleOAuthLogin}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        children
      )}
    </Button>
  );
}