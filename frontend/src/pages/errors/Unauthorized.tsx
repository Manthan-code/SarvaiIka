import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Lock, LogIn, Home } from "lucide-react";
import { useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";

interface UnauthorizedProps {
  message?: string;
  details?: string;
}

const Unauthorized = ({ 
  message = "Unauthorized Access", 
  details = "You need to be logged in to access this resource." 
}: UnauthorizedProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuthStore();

  useEffect(() => {
    console.error("401 Error: Unauthorized Access", { message, details });
  }, [message, details]);

  const handleLogin = () => {
    navigate("/login");
  };

  const handleGoHome = () => {
    navigate("/");
  };

  const handleLogout = () => {
    signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">401</CardTitle>
          <CardDescription className="text-lg font-medium text-gray-700">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{details}</p>
          <p className="text-sm text-gray-500">
            Please log in with valid credentials to continue.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleLogin} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Log In
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleLogout} variant="outline" className="flex-1">
                Clear Session
              </Button>
              <Button onClick={handleGoHome} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unauthorized;