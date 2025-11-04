import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, ExternalLink, Receipt, Calendar, DollarSign, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import billingService from '../services/billingService';
import { motion, AnimatePresence } from 'framer-motion';

interface Transaction {
  id: string;
  amount: number;
  amountPaid: number;
  currency: string;
  status: string;
  plan: string;
  subscriptionStatus: string;
  invoiceUrl?: string;
  pdfUrl?: string;
  dueDate?: string;
  periodStart?: string;
  periodEnd?: string;
  date: string;
  stripeInvoiceId?: string;
}

export default function TransactionHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, user } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Check if opened via hash
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#transactions') {
        setIsFullscreen(true);
      }
    };
    
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const handleClose = () => {
    setIsFullscreen(false);
    window.history.back();
  };

  useEffect(() => {
    if (!session || !user) {
      navigate('/login');
      return;
    }

    fetchTransactionHistory();
  }, [session, user, navigate]);

  const fetchTransactionHistory = async () => {
    try {
      setIsLoading(true);
      const data = await billingService.getBillingHistory();
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      toast({
        title: "Error",
        description: "Failed to load transaction history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      paid: { variant: 'default' as const, className: 'bg-green-100 text-green-800 border-green-200' },
      open: { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      draft: { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' },
      void: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' },
      uncollectible: { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleDownloadInvoice = (url: string) => {
    window.open(url, '_blank');
  };

  if (!session || !user) {
    return null;
  }

  return (
    <div className={isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}>
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-4 right-4 z-10"
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 hover:bg-background"
            >
              <X className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={isFullscreen ? "p-8 pt-20" : ""}>
        {/* Header */}
        <motion.div 
          className="text-center space-y-6 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 blur-3xl"
              animate={{ 
                background: [
                  "linear-gradient(45deg, rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2), rgba(236, 72, 153, 0.2))",
                  "linear-gradient(45deg, rgba(147, 51, 234, 0.2), rgba(236, 72, 153, 0.2), rgba(59, 130, 246, 0.2))",
                  "linear-gradient(45deg, rgba(236, 72, 153, 0.2), rgba(59, 130, 246, 0.2), rgba(147, 51, 234, 0.2))"
                ]
              }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative">
              <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent mb-4">
                Transaction History
              </h1>
            </div>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            View your complete billing and payment history for all subscription transactions.
          </p>
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-lg text-gray-600">Loading transaction history...</span>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && transactions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600 mb-6">You haven't made any payments yet. Upgrade to a paid plan to see your transaction history.</p>
            <Button onClick={() => navigate('/subscriptions')} className="bg-blue-600 hover:bg-blue-700">
              View Subscription Plans
            </Button>
          </motion.div>
        )}

        {/* Transaction List */}
        {!isLoading && transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="space-y-4"
          >
            {transactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-all duration-200 border-border/50">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Receipt className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {transaction.plan.charAt(0).toUpperCase() + transaction.plan.slice(1)} Plan
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {formatDate(transaction.date)}
                            {transaction.periodStart && transaction.periodEnd && (
                              <span className="text-xs text-gray-500">
                                • Billing period: {formatDate(transaction.periodStart)} - {formatDate(transaction.periodEnd)}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-2xl font-bold text-gray-900">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </span>
                        </div>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Amount Paid:</span>
                          <span className="ml-1">{formatCurrency(transaction.amountPaid, transaction.currency)}</span>
                        </div>
                        {transaction.dueDate && (
                          <div>
                            <span className="font-medium">Due Date:</span>
                            <span className="ml-1">{formatDate(transaction.dueDate)}</span>
                          </div>
                        )}
                        {transaction.stripeInvoiceId && (
                          <div>
                            <span className="font-medium">Invoice ID:</span>
                            <span className="ml-1 font-mono text-xs">{transaction.stripeInvoiceId}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {transaction.pdfUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadInvoice(transaction.pdfUrl!)}
                            className="hover:bg-blue-50 hover:border-blue-200"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            PDF
                          </Button>
                        )}
                        {transaction.invoiceUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadInvoice(transaction.invoiceUrl!)}
                            className="hover:bg-green-50 hover:border-green-200"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}