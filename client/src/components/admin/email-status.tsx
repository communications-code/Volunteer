import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeInNewYork } from "@/lib/utils";
import {
  Mail,
  CheckCircle,
  XCircle,
  Users,
  Send,
  Clock,
  Loader2,
  AlertTriangle,
  MousePointerClick,
  Eye,
} from "lucide-react";

interface EmailStatusData {
  mailerlite: {
    connected: boolean;
    apiKeySet: boolean;
    subscriberCount: number;
    groupName: string;
    lastCampaign: {
      subject: string;
      sentAt: string;
      opens: number;
      clicks: number;
    } | null;
  };
  mailersend: {
    connected: boolean;
  };
}

export function EmailStatus() {
  const { data: status, isLoading, error } = useQuery<EmailStatusData>({
    queryKey: ["/api/email/status"],
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#197991]" />
        <span className="ml-2 text-sm text-gray-500">Checking email connections...</span>
      </div>
    );
  }

  if (error || !status) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-600">Unable to load email status.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* MailerLite Status */}
        <Card className={status.mailerlite.connected ? "border-green-200" : "border-red-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              MailerLite
              {status.mailerlite.connected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <XCircle className="h-3 w-3 mr-1" /> {status.mailerlite.apiKeySet ? "Error" : "No API Key"}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {status.mailerlite.connected && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-slate-600">
                    <span className="font-semibold text-slate-800">{status.mailerlite.subscriberCount}</span> subscribers
                    {status.mailerlite.groupName && (
                      <span className="text-slate-400"> in {status.mailerlite.groupName}</span>
                    )}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* MailerSend Status */}
        <Card className={status.mailersend.connected ? "border-green-200" : "border-red-200"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Send className="h-4 w-4" />
              MailerSend (Transactional)
              {status.mailersend.connected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" /> Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <XCircle className="h-3 w-3 mr-1" /> No API Key
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              Used for pledge confirmations and admin notifications.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Last MailerLite Campaign Sent</CardTitle>
        </CardHeader>
        <CardContent>
          {status.mailerlite.lastCampaign ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800 truncate">
                {status.mailerlite.lastCampaign.subject}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {formatDateTimeInNewYork(status.mailerlite.lastCampaign.sentAt, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
              <div className="flex gap-4 text-xs">
                <span className="flex items-center gap-1 text-slate-600">
                  <Eye className="h-3 w-3 text-blue-500" />
                  {status.mailerlite.lastCampaign.opens} opens
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <MousePointerClick className="h-3 w-3 text-green-500" />
                  {status.mailerlite.lastCampaign.clicks} clicks
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No campaigns sent yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
