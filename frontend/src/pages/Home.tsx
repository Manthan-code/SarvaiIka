import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Bot, Zap, Shield, Users } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  {
    icon: Bot,
    title: "Advanced AI Agent",
    description: "Powered by state-of-the-art language models for intelligent conversations and task automation."
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized for speed with real-time responses and seamless user experience."
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your data is protected with enterprise-grade security and privacy measures."
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Share conversations, collaborate on projects, and manage team access effortlessly."
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Hero Section */}
      <section className="relative px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Welcome to IntelliChat
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            The next generation AI agent platform that transforms how you work, create, and collaborate.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="btn-hero">
              <Link to="/chat">
                Start Chatting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/dashboard">
                View Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose IntelliChat?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Experience the future of AI-powered conversations with cutting-edge features designed for professionals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:bg-card/80 hover:shadow-card">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-lg w-fit">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-center">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-card/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Join thousands of professionals who are already using IntelliChat to boost their productivity.
          </p>
          <Button asChild size="lg" className="btn-hero">
            <Link to="/subscriptions">
              View Plans
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}