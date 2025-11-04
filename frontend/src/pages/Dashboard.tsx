import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, TrendingUp, Clock, Plus, Settings, CreditCard, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useHashRouting } from "@/hooks/useHashRouting";

const Dashboard = () => {
  // Hash routing for subscription navigation
  const { setHash } = useHashRouting();

  // Handle subscription click
  const handleSubscriptionClick = () => {
    setHash('subscription');
  };

  // Updated stats without Team Members
  const stats = [
    {
      title: "Total Chats",
      value: "24",
      description: "Active conversations",
      icon: MessageSquare,
      trend: "+12%"
    },
    {
      title: "Usage This Month",
      value: "1,234",
      description: "Messages sent",
      icon: TrendingUp,
      trend: "+8%"
    },
    {
      title: "Response Time",
      value: "0.8s",
      description: "Average response",
      icon: Clock,
      trend: "-5%"
    }
  ];

  const recentActivity = [
    {
      id: 1,
      action: "Started new chat",
      description: "Project planning discussion",
      time: "2 minutes ago",
      type: "chat"
    },
    {
      id: 2,
      action: "Upgraded plan",
      description: "Switched to Pro plan",
      time: "1 hour ago",
      type: "subscription"
    },
    {
      id: 3,
      action: "Generated report",
      description: "Monthly usage summary",
      time: "3 hours ago",
      type: "report"
    },
    {
      id: 4,
      action: "Updated settings",
      description: "Changed notification preferences",
      time: "1 day ago",
      type: "settings"
    }
  ];

  return (
    <div data-testid="dashboard-page" className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your account.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{stat.trend}</span> {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Overview (Left) and Recent Activity (Right) - Same Level */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Usage Overview - Left Side */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Overview</CardTitle>
            <CardDescription>
              Your current plan usage and limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Messages Used</span>
                  <span>1,234 / 5,000</span>
                </div>
                <Progress value={25} className="h-2" />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Storage Used</span>
                  <span>2.1 GB / 10 GB</span>
                </div>
                <Progress value={21} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - Right Side */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest actions and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center space-x-4">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {activity.action}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions - Horizontal Inline at Bottom */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="flex-1 min-w-[200px]">
              <Link to="/chat">
                <Plus className="mr-2 h-4 w-4" />
                Start New Chat
              </Link>
            </Button>
            
            <Button asChild variant="outline" className="flex-1 min-w-[200px]">
              <a href="#settings">
                <Settings className="mr-2 h-4 w-4" />
                View Settings
              </a>
            </Button>
            
            <Button variant="outline" className="flex-1 min-w-[200px]" onClick={handleSubscriptionClick}>
              <CreditCard className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
            
            <Button asChild variant="outline" className="flex-1 min-w-[200px]">
              <a href="#help">
                <HelpCircle className="mr-2 h-4 w-4" />
                Help
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>


    </div>
  );
};

export default Dashboard;