import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { ShieldX, Home, ArrowLeft, Mail } from "lucide-react";
import { useEffect } from "react";

interface ForbiddenProps {
  message?: string;
  details?: string;
}

const Forbidden = ({ 
  message = "Access Forbidden", 
  details = "You don't have permission to access this resource." 
}: ForbiddenProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error("403 Error: Access Forbidden", { message, details });
  }, [message, details]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleContactSupport = () => {
    // You can replace this with your actual support email or contact form
    window.location.href = "mailto:support@yourapp.com?subject=Access Permission Request";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <ShieldX className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">403</CardTitle>
          <CardDescription className="text-lg font-medium text-gray-700">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{details}</p>
          <p className="text-sm text-gray-500">
            If you believe this is an error, please contact support for assistance.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleContactSupport} className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleGoBack} variant="outline" className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
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

export default Forbidden;