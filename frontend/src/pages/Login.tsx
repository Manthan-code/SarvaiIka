import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { GoogleOAuthButton, GitHubOAuthButton, MicrosoftOAuthButton } from "../components/auth";
import supabase from "@/services/supabaseClient";
import { authRefreshManager } from "../lib/authRefresh";

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated, session, user, loading: authLoading } = useAuthStore();

  // Get return URL from query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const returnUrl = urlParams.get('returnUrl');
  const isCheckoutSuccess = urlParams.get('checkout_success') === 'true';

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && session && user) {
      if (returnUrl) {
        navigate(decodeURIComponent(returnUrl));
      } else {
        navigate('/dashboard');
      }
    }
  }, [session, user, authLoading, navigate, returnUrl]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setLoading(true);
    setErrors({});

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });


      console.log('DEBUG: Supabase response error:', error);
      if (error) {
        console.log('DEBUG: Setting error state');
        if (error.message.includes('Email not confirmed')) {
          setErrors({ 
            general: 'Please verify your email address before logging in. Check your inbox for a verification link.' 
          });
        } else if (error.message.includes('Invalid login credentials')) {
          console.log('DEBUG: Setting invalid credentials error');
          setErrors({ general: 'Invalid email or password. Please try again.' });
        } else {
          setErrors({ general: error.message });
        }
        return;
      }

      if (data.session) {
        // Supabase automatically updates the auth store via onAuthStateChange
        // Start the refresh timer
        authRefreshManager.startMonitoring();
        
        // Navigation will happen automatically via useEffect
      }

    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4" data-testid="login-page">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
          <CardDescription className="text-gray-600">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {console.log('DEBUG: Current errors state:', errors)}
            {errors.general && (
              <Alert variant="destructive">
                <AlertDescription>{errors.general}</AlertDescription>
              </Alert>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange('email')}
                  className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  className={`pl-10 pr-10 ${errors.password ? 'border-red-500' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing In...
                </div>
              ) : (
                <div className="flex items-center">
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with</span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            <GoogleOAuthButton />
            <GitHubOAuthButton />
            <MicrosoftOAuthButton />
          </div>

          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}