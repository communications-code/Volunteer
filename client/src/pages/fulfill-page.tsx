import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicShell } from '@/components/layout/public-shell';
import { InsetGroup } from '@/components/layout/inset-group';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface TokenData {
  valid: boolean;
  message?: string;
  needId?: number;
  action?: string;
  need?: {
    id: number;
    title: string;
    category: string;
    status: string;
  };
}

export default function FulfillPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isFulfilling, setIsFulfilling] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setIsLoading(false);
        setError('No token provided. Please check your link.');
        return;
      }

      try {
        const response = await fetch(`/api/verify-token/${token}`);
        const data = await response.json();

        setTokenData(data);
        setIsLoading(false);

        if (!data.valid) {
          setError(data.message || 'Invalid token');
        }
      } catch (err) {
        console.error('Error verifying token:', err);
        setIsLoading(false);
        setError('An error occurred while verifying the token. Please try again later.');
      }
    }

    verifyToken();
  }, [token]);

  const handleFulfill = async () => {
    if (!token) return;

    setIsFulfilling(true);

    try {
      const response = await apiRequest('POST', '/api/fulfill-need', { token });
      const data = await response.json();

      if (data.success) {
        setSuccess(data.message || 'Need successfully marked as fulfilled!');
        queryClient.invalidateQueries({ queryKey: ['/api/needs'] });
      } else {
        setError(data.message || 'Failed to fulfill need');
      }
    } catch (err) {
      console.error('Error fulfilling need:', err);
      setError('An error occurred while processing your request. Please try again later.');
    } finally {
      setIsFulfilling(false);
    }
  };

  return (
    <PublicShell title="Need Fulfillment" subtitle="Confirm the final status of this need." backHref="/" backLabel="Needs" hideTabs>
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
        <InsetGroup className="w-full">
          <CardHeader className="text-center">
            <CardTitle>Need Fulfillment</CardTitle>
            <CardDescription>VFW Post 7570 Serving Network</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
                <p className="text-muted-foreground">Verifying your link...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center rounded-[1.25rem] bg-rose-50 px-4 py-6 text-center">
                <XCircle className="mb-4 h-12 w-12 text-rose-600" />
                <h3 className="mb-2 text-lg font-semibold">Error</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-600" />
                <h3 className="mb-2 text-lg font-semibold">Success</h3>
                <p className="text-muted-foreground">{success}</p>
                {tokenData?.need ? (
                  <div className="mt-4 w-full rounded-[1.25rem] bg-slate-50 p-4 text-left">
                    <h4 className="font-medium text-slate-900">{tokenData.need.title}</h4>
                    <p className="text-sm text-muted-foreground">Category: {tokenData.need.category}</p>
                    <p className="text-sm text-muted-foreground">Status: FULFILLED</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[1.25rem] bg-slate-50 p-4">
                  <h3 className="mb-2 font-medium text-slate-900">Confirm Fulfillment</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    You&apos;re about to mark the following need as fulfilled.
                  </p>
                  {tokenData?.need ? (
                    <div className="rounded-[1rem] border bg-white p-3">
                      <h4 className="font-medium text-slate-900">{tokenData.need.title}</h4>
                      <p className="text-sm text-muted-foreground">Category: {tokenData.need.category}</p>
                      <p className="text-sm text-muted-foreground">Current Status: {tokenData.need.status}</p>
                    </div>
                  ) : null}
                </div>

                <Button onClick={handleFulfill} disabled={isFulfilling} className="w-full">
                  {isFulfilling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Mark as Fulfilled'
                  )}
                </Button>
              </div>
            )}
          </CardContent>

          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => setLocation('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Serving Network
            </Button>
          </CardFooter>
        </InsetGroup>
      </div>
    </PublicShell>
  );
}
