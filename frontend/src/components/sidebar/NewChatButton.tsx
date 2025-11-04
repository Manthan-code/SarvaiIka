import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface NewChatButtonProps {
  collapsed: boolean;
}

export function NewChatButton({ collapsed }: NewChatButtonProps) {
  const navigate = useNavigate();

  const handleNewChat = () => {
    navigate("/chat");
  };

  return (
    <div className="flex justify-center">
      <Button
        onClick={handleNewChat}
        className={cn(
          "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white shadow-lg rounded-xl transition-all duration-300 ease-in-out relative overflow-hidden",
          collapsed 
            ? "w-12 h-12 justify-center hover:scale-105" 
            : "w-full h-12 justify-start gap-3 hover:scale-[1.02]"
        )}
      >
        <motion.div
          className="flex items-center"
          layout
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Plus 
            className={cn(
              "transition-all duration-300 ease-in-out",
              collapsed ? "w-6 h-6" : "w-5 h-5"
            )} 
          />
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                key="text"
                initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                animate={{ opacity: 1, width: "auto", marginLeft: 12 }}
                exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="font-medium whitespace-nowrap overflow-hidden"
              >
                New Chat
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </Button>
    </div>
  );
}