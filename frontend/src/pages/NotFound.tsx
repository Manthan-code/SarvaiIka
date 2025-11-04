import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { FileQuestion, Home, ArrowLeft, Search } from "lucide-react";

interface NotFoundProps {
  message?: string;
  details?: string;
}

const NotFound = ({ 
  message = "Page Not Found", 
  details = "The page you're looking for doesn't exist or has been moved." 
}: NotFoundProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleSearch = () => {
    // Navigate to a search page or open search functionality
    navigate("/search");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <FileQuestion className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">404</CardTitle>
          <CardDescription className="text-lg font-medium text-gray-700">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{details}</p>
          <div className="bg-gray-100 p-3 rounded-md">
            <p className="text-xs text-gray-500 mb-1">Requested URL:</p>
            <p className="text-sm font-mono text-gray-700 break-all">{location.pathname}</p>
          </div>
          <p className="text-sm text-gray-500">
            Double-check the URL or try searching for what you need.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handleGoHome} className="w-full">
              <Home className="mr-2 h-4 w-4" />
              Go to Home
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleGoBack} variant="outline" className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
              <Button onClick={handleSearch} variant="outline" className="flex-1">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
