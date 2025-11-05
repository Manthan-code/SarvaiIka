import React from "react";
import { Loader2 } from "lucide-react";

type ChatLoadingIndicatorProps = {
  size?: number;
  className?: string;
  "data-testid"?: string;
};

/**
 * A small, reusable loading spinner meant for AI chat apps.
 * Center it above the input area for a subtle, consistent indicator.
 */
export function ChatLoadingIndicator({
  size = 20,
  className = "",
  "data-testid": testId = "chat-loading-indicator",
}: ChatLoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`w-full flex justify-center ${className}`}
      data-testid={testId}
    >
      <Loader2
        className="animate-spin text-gray-700 dark:text-gray-300"
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export default ChatLoadingIndicator;