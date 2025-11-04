import { OAuthButton } from "./OAuthButton";
import { Github } from "lucide-react";

interface GitHubOAuthButtonProps {
  className?: string;
}

export function GitHubOAuthButton({ className }: GitHubOAuthButtonProps) {
  return (
    <OAuthButton provider="github" className={className}>
      <Github className="mr-2 h-4 w-4" />
      Continue with GitHub
    </OAuthButton>
  );
}