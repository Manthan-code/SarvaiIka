import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, Mail, MessageCircle, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface HelpPageProps {
  showCloseButton?: boolean;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: 'How do I start a new conversation with the AI?',
    answer: 'Click the "New Chat" button in the sidebar or use the keyboard shortcut Ctrl+N (Cmd+N on Mac). You can also click on the chat input field and start typing your message.'
  },
  {
    id: '2',
    question: 'Can I save and organize my conversations?',
    answer: 'Yes! All your conversations are automatically saved and appear in the sidebar. You can search through them using the search function, and they\'re organized chronologically for easy access.'
  },
  {
    id: '3',
    question: 'What are the differences between subscription plans?',
    answer: 'Our Free plan includes basic AI conversations with limited monthly usage. The Plus plan offers unlimited conversations, faster response times, and priority support. The Pro plan includes all Plus features plus advanced AI models and team collaboration tools.'
  },
  {
    id: '4',
    question: 'How do I upgrade or change my subscription plan?',
    answer: 'Go to Settings > Upgrade Plan or click the "Upgrade" button in the sidebar. You can change your plan at any time, and changes take effect immediately. Downgrades will take effect at the end of your current billing period.'
  },
  {
    id: '5',
    question: 'Is my data secure and private?',
    answer: 'Absolutely. We use enterprise-grade encryption to protect your data. Your conversations are stored securely and are never shared with third parties. You can delete your data at any time from the Privacy settings.'
  },
  {
    id: '6',
    question: 'Can I use the AI for commercial purposes?',
    answer: 'Yes, our Plus and Pro plans allow commercial use. Please review our Terms of Service for specific guidelines. The Free plan is intended for personal use only.'
  },
  {
    id: '7',
    question: 'How do I delete my account and data?',
    answer: 'Go to Settings > Privacy & Data > Delete Account. This will permanently remove all your data, conversations, and account information. This action cannot be undone.'
  }
];

export function HelpPage({ showCloseButton = true }: HelpPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const filteredFAQ = faqData.filter(
    item =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto p-6 space-y-8 relative"
    >
      {/* Close Button - Only show when not in hash routing context */}
      {showCloseButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 h-8 w-8 p-0 hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">Help Center</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Find answers to common questions and get the help you need to make the most of your AI assistant.
        </p>
      </div>

      {/* Search Bar */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
          <CardDescription>
            {searchQuery ? `Found ${filteredFAQ.length} result(s)` : 'Common questions and answers'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnimatePresence>
            {filteredFAQ.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Collapsible
                  open={openItems.has(item.id)}
                  onOpenChange={() => toggleItem(item.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto text-left hover:bg-muted/50 rounded-lg"
                    >
                      <span className="font-medium text-base">{item.question}</span>
                      {openItems.has(item.id) ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-muted-foreground leading-relaxed"
                    >
                      {item.answer}
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
                {item.id !== filteredFAQ[filteredFAQ.length - 1].id && (
                  <div className="border-b border-border/50 mt-4" />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {filteredFAQ.length === 0 && searchQuery && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No articles found matching "{searchQuery}"</p>
              <p className="text-sm mt-2">Try different keywords or contact support below.</p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="shadow-sm border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Mail className="h-6 w-6 text-primary" />
            Contact Support
          </CardTitle>
          <CardDescription>
            Need more help? Our support team is here to assist you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Email Support</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Get detailed help via email. We typically respond within 24 hours.
              </p>
              <Button asChild className="w-full">
                <a href="mailto:support@aiagent.com">
                  <Mail className="h-4 w-4 mr-2" />
                  support@aiagent.com
                </a>
              </Button>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Live Chat</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Chat with our support team in real-time during business hours.
              </p>
              <Button variant="outline" className="w-full">
                <MessageCircle className="h-4 w-4 mr-2" />
                Start Live Chat
              </Button>
            </div>
          </div>
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm text-muted-foreground text-center">
              <strong>Need more help?</strong> Check out our{' '}
              <a href="#" className="text-primary hover:underline">
                documentation
              </a>{' '}
              or{' '}
              <a href="#" className="text-primary hover:underline">
                video tutorials
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}