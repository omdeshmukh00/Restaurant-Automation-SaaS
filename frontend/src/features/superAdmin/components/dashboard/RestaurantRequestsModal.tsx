import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useRestaurantRequestsStore,
  RestaurantRequest,
} from '../../store/RestaurantRequests';
import {
  Building2,
  X,
  Mail,
  Phone,
  MapPin,
  Compass,
  Check,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

interface RestaurantRequestsModalProps {
  darkMode: boolean;
  onClose?: () => void;
}

export default function RestaurantRequestsModal({
  darkMode,
  onClose,
}: RestaurantRequestsModalProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requests = useRestaurantRequestsStore((state) => state.requests);
  const approveRequest = useRestaurantRequestsStore((state) => state.approveRequest);
  const denyRequest = useRestaurantRequestsStore((state) => state.denyRequest);

  // Modal local states
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("Incomplete Information");
  const [customRejectionReason, setCustomRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingRequest, setViewingRequest] = useState<RestaurantRequest | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [shouldRefund, setShouldRefund] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      searchParams.delete("requests");
      setSearchParams(searchParams);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-12 pb-6 px-4 overflow-y-auto bg-black/50 backdrop-blur-sm animate-fadeIn">
        <div
          className={`w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border shadow-2xl ${
            darkMode
              ? "bg-slate-950 border-slate-800 text-slate-100"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {/* Header */}
          <div
            className={`px-5 py-4 border-b flex items-start justify-between gap-4 ${
              darkMode ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div>
              <h3 className="text-lg font-bold">New Restaurant Requests</h3>
              <p
                className={`text-xs mt-1 ${
                  darkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Review restaurants requesting access to the automation service.
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                darkMode
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-900"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
              aria-label="Close new requests"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className={`flex border-b px-5 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'pending'
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-slate-400 hover:text-slate-500"
              }`}
            >
              New Requests
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'history'
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-slate-400 hover:text-slate-500"
              }`}
            >
              Request History
            </button>
          </div>

          {/* Request List */}
          <div className="p-4 sm:p-5 overflow-y-auto max-h-[calc(86vh-88px)]">
            {(() => {
              const filteredList = requests.filter((r) => {
                const isHist = r.status === 'APPLICATION_APPROVED' || r.status === 'REJECTED' || r.status === 'APPROVED';
                return activeTab === 'pending' ? !isHist : isHist;
              });

              if (filteredList.length === 0) {
                return (
                  <div
                    className={`rounded-xl border px-4 py-10 text-center ${
                      darkMode
                        ? "border-slate-800 bg-slate-900/40"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <Building2
                      size={28}
                      className={`mx-auto mb-3 ${
                        darkMode ? "text-slate-600" : "text-slate-300"
                      }`}
                    />
                    <p className="text-sm font-semibold">No requests found</p>
                    <p
                      className={`text-xs mt-1 ${
                        darkMode ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {activeTab === 'pending'
                        ? "New applications will appear here when submitted."
                        : "Processed applications will show up here."}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredList.map((request) => {
                    const isProcessing = processingId === request.id;
                    const isRejected = request.status === 'REJECTED';
                    const isApproved = request.status === 'APPLICATION_APPROVED' || request.status === 'APPROVED';
                    const isPendingPayment = request.status === 'PENDING_PAYMENT';

                    return (
                      <div
                        key={request.id}
                        onClick={() => {
                          setActionError(null);
                          setViewingRequest(request);
                        }}
                        className={`rounded-xl border p-4 cursor-pointer hover:border-orange-500/50 hover:shadow-md transition-all ${
                          darkMode
                            ? "bg-slate-900/50 border-slate-800"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold truncate">
                                {request.name}
                              </p>
                              {request.paymentId && (
                                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                  request.paymentStatus === 'REFUNDED'
                                    ? "bg-blue-500/10 text-blue-400"
                                    : "bg-emerald-500/10 text-emerald-400"
                                }`}>
                                  {request.paymentStatus === 'REFUNDED' ? 'Refunded' : 'Fee Paid'}
                                </span>
                              )}
                            </div>
                            <p
                              className={`text-xs mt-1 ${
                                darkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              Owner: {request.owner}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            {request.status && (
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                isApproved
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : isRejected
                                  ? "bg-red-500/15 text-red-400"
                                  : isPendingPayment
                                  ? "bg-amber-500/15 text-amber-400 font-extrabold"
                                  : "bg-orange-500/10 text-orange-400"
                              }`}>
                                {isPendingPayment ? 'Unpaid' : request.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>

                        <p
                          className={`mt-3 text-xs leading-relaxed ${
                            darkMode ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {request.message}
                        </p>

                        {isRejected && request.rejectionReason && (
                          <div className="mt-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-400">
                            <strong>Rejection Reason:</strong> {request.rejectionReason}
                          </div>
                        )}

                        <div className="mt-4 space-y-2 text-xs">
                          <p className="flex items-center gap-2">
                            <Mail size={13} className="text-orange-500" />
                            <span className="truncate">{request.email}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone size={13} className="text-orange-500" />
                            <span>{request.phone}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin size={13} className="text-orange-500" />
                            <span className="truncate">{request.location}</span>
                          </p>
                          {request.latitude && request.longitude && (
                            <p className="flex items-center gap-2">
                              <Compass size={13} className="text-orange-500" />
                              <a
                                href={request.googleMapsUrl || `https://www.google.com/maps?q=${request.latitude},${request.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-orange-400 hover:text-orange-300 hover:underline truncate font-semibold"
                              >
                                {request.googleMapsUrl ? "Google Maps Link" : `Map View: ${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`}
                              </a>
                            </p>
                          )}
                        </div>

                        {activeTab === 'pending' && (
                          <div
                            className={`mt-4 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                              darkMode ? "border-slate-800" : "border-slate-200"
                            }`}
                          >
                            <span
                              className={`text-[11px] ${
                                darkMode ? "text-slate-500" : "text-slate-400"
                              }`}
                            >
                              Requested {request.requestedAt}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                disabled={isProcessing}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRejectingRequestId(request.id);
                                }}
                                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${
                                  darkMode
                                    ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                                    : "border-slate-200 text-slate-600 hover:bg-white"
                                } disabled:opacity-55`}
                              >
                                <X size={13} />
                                Deny
                              </button>
                              {!isPendingPayment && (
                                <button
                                  disabled={isProcessing}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setProcessingId(request.id);
                                    try {
                                      await approveRequest(request.id);
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setProcessingId(null);
                                    }
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-55"
                                >
                                  {isProcessing ? (
                                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Check size={13} />
                                  )}
                                  Approve
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Rejection Reason Modal */}
      {rejectingRequestId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            <h3 className="text-base font-bold mb-2">Reject Partner Application</h3>
            <p className="text-xs text-slate-400 mb-4">Select the reason for rejecting this application. An automated email will be sent explaining the reason.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Reason</label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-orange-500/50 ${
                    darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <option value="Duplicate Application">Duplicate Application</option>
                  <option value="Incomplete Information">Incomplete Information</option>
                  <option value="Verification Failed">Verification Failed</option>
                  <option value="Outside Service Area">Outside Service Area</option>
                  <option value="Invalid Documents">Invalid Documents</option>
                  <option value="Fraudulent Information">Fraudulent Information</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {rejectionReason === "Other" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom Explanation</label>
                  <textarea
                    rows={4}
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Provide a detailed explanation of the rejection..."
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-500/50 resize-none ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              )}

              {(() => {
                const rejectingReq = requests.find(r => r.id === rejectingRequestId);
                const hasPaidFee = rejectingReq && rejectingReq.paymentId && rejectingReq.paymentStatus === 'CAPTURED';
                return hasPaidFee && (
                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="shouldRefundModal"
                      checked={shouldRefund}
                      onChange={(e) => setShouldRefund(e.target.checked)}
                      className="rounded text-orange-500 bg-slate-950 border-slate-800 focus:ring-orange-500/20"
                    />
                    <label htmlFor="shouldRefundModal" className="text-xs text-slate-300">
                      Refund Onboarding Fee (₹{rejectingReq?.paymentAmount || 0}) via Razorpay
                    </label>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setRejectingRequestId(null);
                    setCustomRejectionReason("");
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold ${
                    darkMode ? 'border-slate-850 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const finalReason = rejectionReason === "Other" 
                      ? `Other - ${customRejectionReason}` 
                      : rejectionReason;
                    if (!finalReason.trim()) return;
                    const rejectingReq = requests.find(r => r.id === rejectingRequestId);
                    const hasPaidFee = rejectingReq && rejectingReq.paymentId && rejectingReq.paymentStatus === 'CAPTURED';
                    try {
                      await denyRequest(rejectingRequestId, finalReason, hasPaidFee ? shouldRefund : false);
                      setRejectingRequestId(null);
                      setCustomRejectionReason("");
                    } catch (err: any) {
                      console.error(err);
                      alert(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'An error occurred during rejection.');
                    }
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Request Modal */}
      {viewingRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border shadow-2xl ${
            darkMode ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
          }`}>
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4 mb-4 border-slate-800/10">
              <div>
                <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border mb-1.5 inline-block ${
                  darkMode ? "text-orange-400 border-orange-500/20 bg-orange-500/10" : "text-orange-700 border-orange-200 bg-orange-50"
                }`}>
                  {viewingRequest.plan} Plan
                </span>
                <h3 className="text-lg font-bold">{viewingRequest.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Submitted: {new Date(viewingRequest.requestedAt).toLocaleString()}</p>
              </div>
              <button
                onClick={() => {
                  setViewingRequest(null);
                  setActionError(null);
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            {actionError && (
              <div className="flex items-start gap-3 p-4 mb-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-650 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Information Grid */}
            <div className="space-y-5 text-xs">
              {/* Business Overview */}
              <div>
                <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-orange-500 mb-2">Business Information</h4>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                  <div>
                    <span className="text-slate-500 block">Owner Name</span>
                    <span className="font-semibold">{viewingRequest.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cuisine Category</span>
                    <span className="font-semibold">{viewingRequest.cuisine || 'Not Specified'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Total Branches</span>
                    <span className="font-semibold">{viewingRequest.branches || 1} outlet(s)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Expected Monthly Orders</span>
                    <span className="font-semibold">{viewingRequest.expectedMonthlyOrders?.toLocaleString() || '0'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">GST Number</span>
                    <span className="font-semibold tracking-wider font-mono">{viewingRequest.gstNumber || 'None Provided'}</span>
                  </div>
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-orange-500 mb-2">Contact Details</h4>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                  <div>
                    <span className="text-slate-500 block">Email Address</span>
                    <span className="font-semibold font-mono">{viewingRequest.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Phone Number</span>
                    <span className="font-semibold font-mono">{viewingRequest.phone}</span>
                  </div>
                </div>
              </div>

              {/* Address & Geography */}
              <div>
                <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-orange-500 mb-2">Address & Location</h4>
                <div className="space-y-2 p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10">
                  <div>
                    <span className="text-slate-500">Street Address: </span>
                    <span className="font-semibold">{viewingRequest.address || viewingRequest.location}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div>
                      <span className="text-slate-500 block">City</span>
                      <span className="font-semibold">{viewingRequest.city || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">State</span>
                      <span className="font-semibold">{viewingRequest.state || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">PIN Code</span>
                      <span className="font-semibold font-mono">{viewingRequest.pinCode || '-'}</span>
                    </div>
                  </div>
                  {viewingRequest.latitude && viewingRequest.longitude && (
                    <div className="pt-2 border-t border-slate-800/10 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <span className="text-slate-500 font-mono">Coords: {viewingRequest.latitude.toFixed(5)}, {viewingRequest.longitude.toFixed(5)}</span>
                      <a
                        href={viewingRequest.googleMapsUrl || `https://www.google.com/maps?q=${viewingRequest.latitude},${viewingRequest.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-orange-500 hover:underline font-bold flex items-center gap-1"
                      >
                        Open Google Maps <ExternalLink size={11} />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Details */}
              {viewingRequest.paymentId && (
                <div>
                  <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-orange-500 mb-2">Billing & Payment Info</h4>
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                    <div>
                      <span className="text-slate-500 block">Payment ID</span>
                      <span className="font-semibold font-mono tracking-wider text-emerald-500">{viewingRequest.paymentId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Amount Paid</span>
                      <span className="font-extrabold text-emerald-500">₹{viewingRequest.paymentAmount || '0'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Payment Status</span>
                      <span className="font-bold text-[10px] uppercase text-emerald-500">{viewingRequest.paymentStatus || 'CAPTURED'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Message */}
              {viewingRequest.message && (
                <div>
                  <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-orange-500 mb-2">Application Message</h4>
                  <p className={`p-3 rounded-2xl border leading-relaxed whitespace-pre-wrap ${
                    darkMode ? 'bg-slate-950/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    {viewingRequest.message}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            {viewingRequest.status !== 'APPLICATION_APPROVED' && viewingRequest.status !== 'APPROVED' && viewingRequest.status !== 'REJECTED' && (
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-800/10">
                <button
                  onClick={() => {
                    const id = viewingRequest.id;
                    setViewingRequest(null);
                    setRejectingRequestId(id);
                  }}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold ${
                    darkMode ? 'border-slate-800 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Deny Application
                </button>
                {viewingRequest.status !== 'PENDING_PAYMENT' && (
                  <button
                    onClick={async () => {
                      const id = viewingRequest.id;
                      try {
                        await approveRequest(id);
                        setViewingRequest(null);
                      } catch (err: any) {
                        setActionError(err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Approval failed.');
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/10"
                  >
                    Approve Application
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
