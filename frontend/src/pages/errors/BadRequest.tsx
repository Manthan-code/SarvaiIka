import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface BadRequestProps {
  message?: string;
  details?: string;
}

const BadRequest = ({ message = "Bad Request", details = "The request could not be understood by the server." }: BadRequestProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    console.error("400 Error: Bad Request", { message, details });
  }, [message, details]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">400</CardTitle>
          <CardDescription className="text-lg font-medium text-gray-700">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{details}</p>
          <p className="text-sm text-gray-500">
            Please check your request and try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={handleGoBack} variant="outline" className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
            <Button onClick={handleGoHome} className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BadRequest;