const supabase = require('../db/supabase/client.js');

// Controller to fetch billing history from subscription invoices
const getBillingHistory = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('subscription_invoices')
            .select(`
                id,
                amount_due,
                amount_paid,
                currency,
                status,
                stripe_invoice_id,
                invoice_pdf_url,
                hosted_invoice_url,
                due_date,
                period_start,
                period_end,
                created_at,
                subscriptions!inner(
                    plan,
                    status
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: 'Failed to fetch billing history' });
        }

        // Transform the data for frontend consumption
        const transformedData = data.map(invoice => ({
            id: invoice.id,
            amount: invoice.amount_due,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            plan: invoice.subscriptions?.plan || 'Unknown',
            subscriptionStatus: invoice.subscriptions?.status || 'Unknown',
            invoiceUrl: invoice.hosted_invoice_url,
            pdfUrl: invoice.invoice_pdf_url,
            dueDate: invoice.due_date,
            periodStart: invoice.period_start,
            periodEnd: invoice.period_end,
            date: invoice.created_at,
            stripeInvoiceId: invoice.stripe_invoice_id
        }));

        res.status(200).json(transformedData);
    } catch (err) {
        console.error('Error fetching billing history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getBillingHistory
};
