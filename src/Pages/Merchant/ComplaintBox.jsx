import React, { useState, useEffect, useMemo } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { updateComplaintStatus, complaintIssues, getComplaintIssues } from '../../api/ComplaintBox';
import Loader from '../../components/Loader';
import { 
  LifeBuoy, 
  Send, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  User, 
  Filter, 
  Search, 
  Tag, 
  AlertCircle,
  CornerDownRight
} from 'lucide-react';

const ComplaintBox = ({ currentUser }) => {
  const [complaints, setComplaints] = useState([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Admin Reply Modal state
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [targetStatus, setTargetStatus] = useState('resolved');
  const [isReplyModalOpen, setIsReplyModalOpen] = useState(false);

  const rawRole = String(currentUser?.role || '').toLowerCase();
  const isAdmin = rawRole === 'admin' || rawRole === 'employee';
  const userId = currentUser?.id || currentUser?.user_id;

  useEffect(() => {
    fetchComplaints();
  }, []);

  const fetchComplaints = async () => {
    try {
      setFetching(true);
      const response = await getComplaintIssues();
      const list = response?.data || response || [];
      setComplaints(Array.isArray(list) ? list : []);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch tickets');
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error('Please enter a message describing your issue');
      return;
    }

    const payload = {
      subject: subject.trim() || 'Help Request',
      category: category,
      message: message.trim(),
      user_details: {
        id: userId,
        name: currentUser?.name || currentUser?.full_name || currentUser?.user_name || 'User',
        email: currentUser?.email || '',
        mobile_number: currentUser?.mobile_number || currentUser?.mobile || '',
        role: currentUser?.role || 'user',
      },
    };

    try {
      setLoading(true);
      const res = await complaintIssues(payload);
      const createdTicket = res?.data;
      if (createdTicket) {
        setComplaints((prev) => [createdTicket, ...prev]);
      } else {
        await fetchComplaints();
      }

      setSubject('');
      setMessage('');
      setCategory('General');
      toast.success('Help ticket raised successfully!');
    } catch (error) {
      toast.error(error.message || 'Failed to submit ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReplyModal = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText(ticket.admin_reply || ticket.reply || '');
    setTargetStatus(ticket.status === 'closed' ? 'closed' : ticket.status === 'resolved' ? 'resolved' : 'resolved');
    setIsReplyModalOpen(true);
  };

  const handleSaveAdminReply = async () => {
    if (!selectedTicket) return;
    try {
      setLoading(true);
      const res = await updateComplaintStatus(selectedTicket.id, targetStatus, replyText);
      const updatedData = res?.data;

      setComplaints((prev) =>
        prev.map((item) =>
          String(item.id) === String(selectedTicket.id)
            ? {
                ...item,
                status: targetStatus,
                admin_reply: replyText,
                updated_at: new Date().toISOString(),
                ...(updatedData || {}),
              }
            : item
        )
      );

      toast.success('Ticket updated with reply!');
      setIsReplyModalOpen(false);
      setSelectedTicket(null);
    } catch (error) {
      toast.error(error.message || 'Failed to update ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStatusChange = async (ticketId, newStatus) => {
    try {
      setLoading(true);
      await updateComplaintStatus(ticketId, newStatus);

      setComplaints((prev) =>
        prev.map((item) =>
          String(item.id) === String(ticketId) ? { ...item, status: newStatus } : item
        )
      );

      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  // Filter complaints based on user role, search, & status
  const visibleComplaints = useMemo(() => {
    return complaints.filter((item) => {
      // Non-admins see tickets they raised or all relevant tickets
      const itemUserId = item.user_details?.id || item.user_id || item.userId;
      if (!isAdmin && userId && itemUserId && String(itemUserId) !== String(userId)) {
        // If ticket has specific user_id that doesn't match current non-admin user
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const itemStatus = String(item.status || 'pending').toLowerCase();
        if (statusFilter === 'pending' && !['pending', 'open'].includes(itemStatus)) return false;
        if (statusFilter === 'in_progress' && itemStatus !== 'in_progress') return false;
        if (statusFilter === 'resolved' && itemStatus !== 'resolved') return false;
        if (statusFilter === 'closed' && itemStatus !== 'closed') return false;
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const msg = String(item.message || '').toLowerCase();
        const subj = String(item.subject || '').toLowerCase();
        const userName = String(item.user_details?.name || '').toLowerCase();
        const idStr = String(item.id || '').toLowerCase();
        return msg.includes(term) || subj.includes(term) || userName.includes(term) || idStr.includes(term);
      }

      return true;
    });
  }, [complaints, isAdmin, userId, statusFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = visibleComplaints.length;
    const pending = visibleComplaints.filter((c) => ['pending', 'open'].includes(String(c.status || '').toLowerCase())).length;
    const resolved = visibleComplaints.filter((c) => String(c.status).toLowerCase() === 'resolved').length;
    const closed = visibleComplaints.filter((c) => String(c.status).toLowerCase() === 'closed').length;
    return { total, pending, resolved, closed };
  }, [visibleComplaints]);

  const getStatusBadge = (statusStr) => {
    const st = String(statusStr || 'pending').toLowerCase();
    if (st === 'resolved') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" /> Resolved
        </span>
      );
    }
    if (st === 'closed') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
          <XCircle className="w-3 h-3 mr-1 text-gray-500" /> Closed
        </span>
      );
    }
    if (st === 'in_progress') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#00D3CD]/15 text-teal-900 border border-[#00D3CD]/30">
          <Clock className="w-3 h-3 mr-1 text-[#00A8A3] animate-pulse" /> In Progress
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        <AlertCircle className="w-3 h-3 mr-1 text-amber-600" /> Open / Pending
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="bg-primary rounded-2xl p-6 text-white shadow-lg border border-[#00D3CD]/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#00D3CD]/20 rounded-xl border border-white">
              <LifeBuoy className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Help & Support Desk</h1>
              <p className="text-white text-sm mt-0.5">
                {isAdmin
                  ? 'Manage, respond to, and resolve support tickets raised by Merchants & Franchises.'
                  : 'Raise tickets for transaction, payout, POS machine, or technical assistance.'}
              </p>
            </div>
          </div>

          {/* <div className="flex items-center space-x-2">
            <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-300">
              Role: <strong className="text-white capitalize">{currentUser?.role || 'User'}</strong>
            </span>
          </div> */}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Total Tickets</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="p-2.5 bg-gray-100 rounded-lg text-gray-600">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-600 uppercase">Open / Pending</p>
            <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pending}</p>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-emerald-600 uppercase">Resolved</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.resolved}</p>
          </div>
          <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase">Closed</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.closed}</p>
          </div>
          <div className="p-2.5 bg-gray-100 rounded-lg text-gray-600">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Ticket Creation Form for Merchant / Franchise */}
      {!isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-2 border-b border-gray-100 pb-4 mb-5">
            <Send className="w-5 h-5 text-[#00D3CD]" />
            <h2 className="text-lg font-semibold text-gray-900">Raise a New Ticket</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <div className="relative">
                  <Tag className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:bg-white transition-all text-sm text-gray-900"
                  >
                    <option value="General">General Query</option>
                    <option value="Transaction">POS Transaction Issue</option>
                    <option value="Payout">Payout / Bank Settlement</option>
                    <option value="Hardware">POS Machine / Machine Hardware</option>
                    <option value="RateSetting">Charges & Rates</option>
                    <option value="Technical">Technical Bug / App Error</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject / Summary
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Transaction amount hold or POS terminal error..."
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:bg-white transition-all text-sm text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Detailed Message <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Explain your problem clearly. Mention Transaction ID or RRN if applicable..."
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D3CD] focus:bg-white transition-all text-sm text-gray-900"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-2.5 bg-[#00D3CD] hover:bg-[#00bdb7] text-white font-medium rounded-xl shadow-sm transition-colors disabled:opacity-50 text-sm"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 mr-2" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" /> Submit Ticket
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Complaints List Section */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <MessageSquare className="w-5 h-5 text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">
              {isAdmin ? 'All User Support Tickets' : 'Your Raised Tickets'}
            </h2>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
              {visibleComplaints.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:flex-none">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search ticket, ID or user..."
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-[#00D3CD] focus:bg-white"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg text-xs font-medium">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'pending' ? 'bg-amber-500 text-white shadow-sm' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                Open
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'resolved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => setStatusFilter('closed')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  statusFilter === 'closed' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Closed
              </button>
            </div>
          </div>
        </div>

        {/* Tickets Cards List */}
        {fetching ? (
          <div className="py-12 flex justify-center items-center">
            <Loader />
          </div>
        ) : visibleComplaints.length === 0 ? (
          <div className="py-12 text-center text-gray-500 space-y-2">
            <LifeBuoy className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="text-base font-medium text-gray-700">No tickets found</p>
            <p className="text-xs text-gray-400">
              {searchTerm || statusFilter !== 'all'
                ? 'Try clearing your filters or search terms.'
                : 'There are no active support tickets at the moment.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleComplaints.map((ticket) => {
              const ticketUser = ticket.user_details || {};
              const ticketIdStr = ticket.id || `TKT-${Math.random().toString().slice(2, 8)}`;
              const createdDate = ticket.created_at || ticket.createdAt
                ? new Date(ticket.created_at || ticket.createdAt).toLocaleString('en-IN')
                : 'Recent';

              return (
                <div
                  key={ticket.id}
                  className="border border-gray-200 hover:border-gray-300 rounded-xl p-4 transition-all shadow-xs bg-white space-y-3"
                >
                  {/* Ticket Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-gray-900">
                        #{ticketIdStr}
                      </span>
                      {ticket.category && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                          {ticket.category}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        • {createdDate}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>

                  {/* User Details & Subject */}
                  <div>
                    {ticket.subject && (
                      <h4 className="font-semibold text-gray-900 text-sm mb-1">
                        {ticket.subject}
                      </h4>
                    )}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      {ticket.message || 'No description provided.'}
                    </p>
                  </div>

                  {/* Submitted By Info */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 gap-2 pt-1">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        Raised by:{' '}
                        <strong className="text-gray-700">
                          {ticketUser.name || ticketUser.user_name || 'User'}
                        </strong>{' '}
                        {ticketUser.role && `(${ticketUser.role})`}
                      </span>
                      {ticketUser.mobile_number && (
                        <span className="text-gray-400 font-mono">
                          • {ticketUser.mobile_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Admin Reply Section (if exists) */}
                  {(ticket.admin_reply || ticket.reply) && (
                    <div className="mt-3 p-3.5 bg-[#00D3CD]/10 border-l-4 border-[#00D3CD] rounded-r-xl space-y-1">
                      <div className="flex items-center justify-between text-xs text-[#005c58] font-bold">
                        <span className="flex items-center">
                          <CornerDownRight className="w-3.5 h-3.5 mr-1 text-[#00D3CD]" /> Admin / Support Response:
                        </span>
                      </div>
                      <p className="text-xs text-teal-950 whitespace-pre-wrap leading-relaxed font-medium">
                        {ticket.admin_reply || ticket.reply}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                    {isAdmin ? (
                      <>
                        <button
                          onClick={() => handleOpenReplyModal(ticket)}
                          className="px-3.5 py-1.5 bg-[#00D3CD] hover:bg-[#00bdb7] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center"
                        >
                          <MessageSquare className="w-3.5 h-3.5 mr-1" />
                          {ticket.admin_reply ? 'Edit Reply / Status' : 'Reply & Update'}
                        </button>

                        {ticket.status !== 'resolved' && (
                          <button
                            onClick={() => handleQuickStatusChange(ticket.id, 'resolved')}
                            className="px-3.5 py-1.5 bg-[#00A8A3] hover:bg-[#00918c] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors inline-flex items-center"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Resolved
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {ticket.status !== 'closed' && (
                          <button
                            onClick={() => handleQuickStatusChange(ticket.id, 'closed')}
                            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors inline-flex items-center"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" /> Close Ticket
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Admin Reply & Status Modal */}
      {isReplyModalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-semibold text-gray-900 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-[#00D3CD]" /> Respond to Ticket #{selectedTicket.id}
              </h3>
              <button
                onClick={() => setIsReplyModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Original Ticket Summary */}
            <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1 border border-gray-200">
              <p className="font-semibold text-gray-800">
                User: {selectedTicket.user_details?.name || 'User'}
              </p>
              <p className="text-gray-600 line-clamp-2">
                "{selectedTicket.message}"
              </p>
            </div>

            {/* Status Dropdown */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Update Status
              </label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-medium text-gray-900 focus:ring-2 focus:ring-[#00D3CD]"
              >
                <option value="pending">Open / Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {/* Reply Textarea */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Admin Response / Resolution Note
              </label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
                placeholder="Type response to user..."
                className="w-full p-3 bg-gray-50 border border-gray-300 rounded-xl text-xs text-gray-900 focus:ring-2 focus:ring-[#00D3CD]"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setIsReplyModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAdminReply}
                disabled={loading}
                className="px-5 py-2 bg-[#00D3CD] hover:bg-[#00bdb7] text-white rounded-xl text-xs font-medium shadow-xs disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Send Response & Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer position="top-right" autoClose={4000} theme="light" />
    </div>
  );
};

export default ComplaintBox;
