import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { formatDateInNewYork, formatTimeRangeForDisplay } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PublicShell } from "@/components/layout/public-shell";
import { ArrowLeft, CheckCircle2, Loader2, XCircle } from "lucide-react";

type EventRoleOption = {
  id: number;
  name: string;
  slotDate?: string | null;
  startTime: string;
  endTime: string;
  capacity: number | null;
  filledCount: number;
  remainingCount: number | null;
  isFull: boolean;
};

type ManageSignupResponse = {
  valid: boolean;
  message?: string;
  pledge?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    organization?: string | null;
    notes?: string | null;
    selectedRoleIds: number[];
  };
  need?: {
    id: number;
    title: string;
    status: string;
    eventDate?: string | null;
    eventLocation?: string | null;
  };
  availableRoles?: EventRoleOption[];
};

export default function EventSignupManagePage() {
  const [, navigate] = useLocation();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token")?.trim() || "";
  }, []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCanceled, setIsCanceled] = useState(false);

  const [payload, setPayload] = useState<ManageSignupResponse | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("No sign-up token provided. Please open the link from your email.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(`/api/event-signup/manage/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ManageSignupResponse;

        if (!response.ok || !data.valid || !data.pledge || !data.need) {
          setError(data.message || "This sign-up link is no longer valid.");
          setIsLoading(false);
          return;
        }

        setPayload(data);
        setFirstName(data.pledge.firstName || "");
        setLastName(data.pledge.lastName || "");
        setEmail(data.pledge.email || "");
        setPhone(data.pledge.phone || "");
        setOrganization(data.pledge.organization || "");
        setNotes(data.pledge.notes || "");
        setSelectedRoleIds(data.pledge.selectedRoleIds || []);
      } catch (loadError) {
        console.error("Error loading sign-up management data:", loadError);
        setError("Unable to load sign-up information right now. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token]);

  const handleRoleToggle = (role: EventRoleOption, checked: boolean) => {
    setSelectedRoleIds((current) => {
      const hasRole = current.includes(role.id);
      if (checked && !hasRole) return [...current, role.id];
      if (!checked && hasRole) return current.filter((id) => id !== role.id);
      return current;
    });
  };

  const handleSave = async () => {
    if (!token) return;
    if (selectedRoleIds.length === 0) {
      setError("Please select at least one sign-up slot.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRequest("POST", "/api/event-signup/manage/update", {
        token,
        firstName,
        lastName,
        email,
        phone,
        organization,
        notes,
        selectedEventRoleIds: selectedRoleIds,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to update sign-up details.");
        return;
      }

      setSuccess(data.message || "Your sign-up details were updated.");
      setPayload((current) =>
        current
          ? {
              ...current,
              pledge: {
                ...(current.pledge as NonNullable<ManageSignupResponse["pledge"]>),
                firstName,
                lastName,
                email,
                phone,
                organization,
                notes,
                selectedRoleIds,
              },
            }
          : current,
      );
    } catch (saveError) {
      console.error("Error updating sign-up:", saveError);
      setError("Unable to update sign-up details right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSignup = async () => {
    if (!token) return;

    setIsCanceling(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiRequest("POST", "/api/event-signup/manage/cancel", { token });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to cancel sign-up.");
        return;
      }

      setIsCanceled(true);
      setSuccess(data.message || "Your event sign-up has been canceled.");
    } catch (cancelError) {
      console.error("Error canceling sign-up:", cancelError);
      setError("Unable to cancel sign-up right now.");
    } finally {
      setIsCanceling(false);
    }
  };

  if (isLoading) {
    return (
      <PublicShell title="Manage Sign-Up" subtitle="Loading your sign-up details" backHref="/" backLabel="Needs" hideTabs>
        <div className="container mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center py-10">
          <Card className="w-full">
            <CardContent className="flex items-center justify-center gap-3 py-10 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading your sign-up details...
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    );
  }

  if (error && !payload) {
    return (
      <PublicShell title="Manage Sign-Up" subtitle="This sign-up link is not available." backHref="/" backLabel="Needs" hideTabs>
        <div className="container mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center py-10">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-[#231F20]">Manage Event Sign Up</CardTitle>
              <CardDescription>VFW Post 7570 Serving Network</CardDescription>
            </CardHeader>
            <CardContent className="rounded-[1rem] border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={() => navigate("/")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Return to Serving Network
              </Button>
            </CardFooter>
          </Card>
        </div>
      </PublicShell>
    );
  }

  const roles = payload?.availableRoles || [];

  return (
    <PublicShell
      title="Manage Sign-Up"
      subtitle={payload?.need?.title || "Event"}
      backHref="/"
      backLabel="Needs"
      hideTabs
    >
      <div className="container mx-auto max-w-2xl py-2">
      <Card className="clh-mobile-form-safe w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-[#231F20]">Manage Event Sign Up</CardTitle>
          <CardDescription>
            {payload?.need?.title || "Event"}
            {payload?.need?.eventDate
              ? ` • ${formatDateInNewYork(payload.need.eventDate, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}`
              : ""}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {error ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
              <span>{success}</span>
            </div>
          ) : null}

          {isCanceled ? (
            <div className="text-sm text-slate-700 bg-slate-50 border rounded-lg p-4">
              Your sign-up has been canceled.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">First Name</label>
                  <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Last Name</label>
                  <Input value={lastName} onChange={(event) => setLastName(event.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Phone</label>
                  <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Church / Organization</label>
                <Input value={organization} onChange={(event) => setOrganization(event.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes"
                  className="min-h-[88px]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Selected Slots</p>
                {roles.length === 0 ? (
                  <p className="text-sm text-slate-500">No active slots are available for this event.</p>
                ) : (
                  <div className="space-y-2">
                    {roles.map((role) => {
                      const isSelected = selectedRoleIds.includes(role.id);
                      const isDisabled = role.isFull && !isSelected;
                      const slotDate = role.slotDate
                        ? formatDateInNewYork(role.slotDate, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Date TBD";

                      return (
                        <label
                          key={role.id}
                          className={`flex items-start gap-3 rounded-lg border p-3 ${
                            isDisabled ? "bg-slate-50 text-slate-400" : "bg-white"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            disabled={isDisabled}
                            onCheckedChange={(checked) => handleRoleToggle(role, checked === true)}
                          />
                          <span className="text-sm leading-5">
                            <span className="font-medium text-slate-900">{role.name}</span>
                            <br />
                            <span className="text-slate-600">
                              {slotDate} • {formatTimeRangeForDisplay(role.startTime, role.endTime)}
                            </span>
                            <br />
                            <span className="text-xs text-slate-500">
                              {role.capacity === null
                                ? "Unlimited"
                                : role.remainingCount === 0
                                  ? "Full"
                                  : `${role.remainingCount} spot${role.remainingCount === 1 ? "" : "s"} left`}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => navigate("/")}> 
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Serving Network
          </Button>

          {!isCanceled ? (
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleCancelSignup}
                disabled={isCanceling || isSaving}
              >
                {isCanceling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Cancel Sign Up
              </Button>
              <Button
                className="bg-[#164C83] hover:bg-[#991A1E]"
                onClick={handleSave}
                disabled={isSaving || isCanceling}
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          ) : null}
        </CardFooter>
      </Card>
      </div>
    </PublicShell>
  );
}
