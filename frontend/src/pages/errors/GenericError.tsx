import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { AlertCircle, Home, RefreshCw, Mail } from "lucide-react";
import { useEffect, useState } from "react";

interface GenericErrorProps {
  statusCode?: number;
  message?: string;
  details?: string;
  errorId?: string;
}

const GenericError = ({ 
  statusCode = 500,
  message = "Something went wrong", 
  details = "An unexpected error occurred. Please try again.",
  errorId
}: GenericErrorProps) => {
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    console.error(`${statusCode} Error:`, { message, details, errorId });
  }, [statusCode, message, details, errorId]);

  const handleGoHome = () => {
    navigate("/");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleReportError = () => {
    const subject = `Error Report - ${statusCode} ${errorId || 'Unknown'}`;
    const body = `Error Details:\n\nStatus Code: ${statusCode}\nMessage: ${message}\nDetails: ${details}\nError ID: ${errorId || 'Not provided'}\nURL: ${window.location.href}\nTimestamp: ${new Date().toISOString()}`;
    window.location.href = `mailto:support@yourapp.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getStatusColor = (code: number) => {
    if (code >= 400 && code < 500) return "orange"; // Client errors
    if (code >= 500) return "red"; // Server errors
    return "blue"; // Other errors
  };

  const statusColor = getStatusColor(statusCode);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-${statusColor}-100`}>
            <AlertCircle className={`h-8 w-8 text-${statusColor}-600`} />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">{statusCode}</CardTitle>
          <CardDescription className="text-lg font-medium text-gray-700">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">{details}</p>
          {errorId && (
            <div className="bg-gray-100 p-3 rounded-md">
              <p className="text-xs text-gray-500 mb-1">Error ID:</p>
              <p className="text-sm font-mono text-gray-700">{errorId}</p>
            </div>
          )}
          <p className="text-sm text-gray-500">
            If this problem persists, please contact our support team.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="w-full"
            >
              {isRefreshing ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isRefreshing ? "Refreshing..." : "Try Again"}
            </Button>
            <div className="flex gap-3">
              <Button onClick={handleReportError} variant="outline" className="flex-1">
                <Mail className="mr-2 h-4 w-4" />
                Report
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

export default GenericError;