import React, { useEffect, useState } from "react";
import {
  Bell,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  RefreshCw,
  X,
  DollarSign,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { auth, db } from "../../../firebase.config";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PatientNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Pagination
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setNotifications([]);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Real-time notifications listener
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const notifData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            if (!a.timestamp || !b.timestamp) return 0;
            return b.timestamp.toMillis() - a.timestamp.toMillis();
          });
        setNotifications(notifData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Check for upcoming appointments and send reminders
  useEffect(() => {
    if (!userId) return;

    const checkUpcomingAppointments = async () => {
      try {
        const appointmentsQuery = query(
          collection(db, "onlineRequests"),
          where("userId", "==", userId),
          where("status", "==", "confirmed")
        );

        const snapshot = await getDocs(appointmentsQuery);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        snapshot.docs.forEach(async (docSnap) => {
          const appointment = docSnap.data();
          const appointmentDate = new Date(appointment.date);
          appointmentDate.setHours(0, 0, 0, 0);

          if (appointmentDate.getTime() === tomorrow.getTime()) {
            const reminderQuery = query(
              collection(db, "notifications"),
              where("userId", "==", userId),
              where("type", "==", "appointment_reminder"),
              where("appointmentId", "==", docSnap.id)
            );

            const reminderSnapshot = await getDocs(reminderQuery);

            const recentReminder = reminderSnapshot.docs.find((doc) => {
              const data = doc.data();
              if (data.timestamp) {
                const reminderDate = data.timestamp.toDate();
                const hoursDiff = (now - reminderDate) / (1000 * 60 * 60);
                return hoursDiff < 24;
              }
              return false;
            });

            if (!recentReminder) {
              await addDoc(collection(db, "notifications"), {
                userId: userId,
                appointmentId: docSnap.id,
                type: "appointment_reminder",
                title: "Appointment Reminder",
                message: `You have an appointment tomorrow at ${appointment.time}. Please arrive 1 hour early to avoid being late.`,
                read: false,
                timestamp: serverTimestamp(),
                details: {
                  appointmentDate: appointment.date,
                  time: appointment.time,
                  treatment: appointment.treatment,
                  dentist: appointment.preferredDentist,
                },
              });
            }
          }
        });
      } catch (error) {
        console.error("Error checking appointments:", error);
      }
    };

    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 3600000);

    return () => clearInterval(interval);
  }, [userId]);

  // Check for unpaid bills and send payment reminders
  useEffect(() => {
    if (!userId) return;

    const checkUnpaidBills = async () => {
      try {
        // Check appointments
        const appointmentsQuery = query(
          collection(db, "appointments"),
          where("userId", "==", userId),
          where("status", "==", "treated")
        );

        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        
        // Check online requests
        const onlineQuery = query(
          collection(db, "onlineRequests"),
          where("userId", "==", userId),
          where("status", "==", "treated")
        );

        const onlineSnapshot = await getDocs(onlineQuery);

        // Combine both sources
        const allBillings = [
          ...appointmentsSnapshot.docs.map(d => ({ id: d.id, source: "appointments", ...d.data() })),
          ...onlineSnapshot.docs.map(d => ({ id: d.id, source: "onlineRequests", ...d.data() }))
        ];

        const now = new Date();

        for (const billing of allBillings) {
          const totalAmount = billing.price || 0;
          const amountPaid = billing.amountPaid || 0;
          const balance = totalAmount - amountPaid;

          // Only send reminder if there's a balance
          if (balance > 0) {
            // Check if we already sent a reminder in the last 7 days
            const reminderQuery = query(
              collection(db, "notifications"),
              where("userId", "==", userId),
              where("type", "==", "payment_reminder"),
              where("billingId", "==", billing.id)
            );

            const reminderSnapshot = await getDocs(reminderQuery);
            
            const recentReminder = reminderSnapshot.docs.find((doc) => {
              const data = doc.data();
              if (data.timestamp) {
                const reminderDate = data.timestamp.toDate();
                const daysDiff = (now - reminderDate) / (1000 * 60 * 60 * 24);
                return daysDiff < 7; // Only remind every 7 days
              }
              return false;
            });

            if (!recentReminder) {
              await addDoc(collection(db, "notifications"), {
                userId: userId,
                billingId: billing.id,
                billingSource: billing.source,
                type: "payment_reminder",
                title: "Payment Reminder",
                message: `You have an outstanding balance of ₱${balance.toLocaleString()} for ${billing.treatment || billing.treatmentOption || "your treatment"}. Please settle your payment at your earliest convenience.`,
                read: false,
                timestamp: serverTimestamp(),
                details: {
                  treatment: billing.treatment || billing.treatmentOption || "Treatment",
                  dateVisit: billing.date || "N/A",
                  totalAmount: totalAmount,
                  amountPaid: amountPaid,
                  balance: balance,
                  notes: billing.notes || "",
                  treatmentOption: billing.treatmentOption || "",
                },
              });
            }
          }
        }
      } catch (error) {
        console.error("Error checking unpaid bills:", error);
      }
    };

    checkUnpaidBills();
    // Check every 24 hours
    const interval = setInterval(checkUnpaidBills, 86400000);

    return () => clearInterval(interval);
  }, [userId]);

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Recently";

    const now = new Date();
    const notifTime = timestamp.toDate();
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notifTime.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getFullDateTime = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate();
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      return "Invalid date";
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      await deleteDoc(doc(db, "notifications", id));
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter((n) => !n.read);
      const updatePromises = unreadNotifs.map((notif) =>
        updateDoc(doc(db, "notifications", notif.id), { read: true })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const getStatusBadge = (type) => {
    if (type === "appointment_cancelled") {
      return (
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
          Cancelled
        </span>
      );
    }
    if (type === "appointment_confirmed") {
      return (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
          Confirmed
        </span>
      );
    }
    if (type === "appointment_reminder") {
      return (
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">
          Reminder
        </span>
      );
    }
    if (type === "payment_reminder") {
      return (
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
          Payment Due
        </span>
      );
    }
    if (type === "appointment_reschedule") {
      return (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
          Rescheduled
        </span>
      );
    }
    return (
      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">
        Pending
      </span>
    );
  };

  const getNotificationIcon = (type) => {
    if (type === "payment_reminder") {
      return <DollarSign size={14} className="text-amber-600" />;
    }
    if (type === "appointment_confirmed") {
      return <CheckCircle size={14} className="text-green-600" />;
    }
    if (type === "appointment_cancelled") {
      return <XCircle size={14} className="text-red-600" />;
    }
    if (type === "appointment_reminder") {
      return <Clock size={14} className="text-orange-600" />;
    }
    if (type === "appointment_reschedule") {
      return <RefreshCw size={14} className="text-blue-600" />;
    }
    return <Bell size={14} className="text-gray-600" />;
  };

  // Filter notifications
  const filteredNotifications = notifications.filter((notif) => {
    // Status filter
    if (statusFilter === "Unread" && notif.read) return false;
    if (statusFilter === "Read" && !notif.read) return false;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        notif.title?.toLowerCase().includes(query) ||
        notif.message?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Count statistics
  const allCount = notifications.length;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = allCount - unreadCount;

  // Pagination
  const totalPages = Math.ceil(filteredNotifications.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedData = filteredNotifications.slice(startIndex, endIndex);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Status Summary Cards */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setStatusFilter("All")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "All"
                  ? "border-gray-500 bg-gray-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="text-2xl font-bold text-gray-700">{allCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">
                ALL
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("Unread")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "Unread"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="text-2xl font-bold text-blue-600">
                {unreadCount}
              </div>
              <div className="text-xs text-gray-600 font-semibold mt-1">
                UNREAD
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("Read")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "Read"
                  ? "border-green-500 bg-green-50"
                  : "border-green-300 hover:bg-green-50"
              }`}
            >
              <div className="text-2xl font-bold text-green-600">
                {readCount}
              </div>
              <div className="text-xs text-gray-600 font-semibold mt-1">
                READ
              </div>
            </button>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded border border-gray-300 p-4">
          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Show</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-400 rounded px-2 py-1 text-xs bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-xs font-medium"
                >
                  <CheckCircle size={14} />
                  Mark All Read
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Notification
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Date/Time
                  </th>
                  <th className="text-center px-3 py-2 font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-8 text-gray-500">
                      {statusFilter !== "All"
                        ? `No ${statusFilter.toLowerCase()} notifications found`
                        : "No notifications found"}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((notif, idx) => {
                    return (
                      <tr
                        key={notif.id}
                        onClick={() => {
                          setSelectedNotif(notif);
                          setShowDetailsModal(true);
                          if (!notif.read) handleMarkAsRead(notif.id);
                        }}
                        className={`border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors ${
                          !notif.read
                            ? "bg-blue-50 font-medium"
                            : idx % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                        }`}
                        title="Click to view details"
                      >
                        <td className="px-3 py-2 border-r border-gray-200">
                          <div className="flex items-start gap-2">
                            {getNotificationIcon(notif.type)}
                            <div className="flex-1">
                              <div className="font-medium text-gray-800 flex items-center gap-2">
                                {notif.title}
                                {!notif.read && (
                                  <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-500 truncate max-w-md mt-0.5">
                                {notif.message}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-600 border-r border-gray-200">
                          <div className="flex items-center gap-1">
                            <Clock size={12} className="text-gray-400" />
                            {getTimeAgo(notif.timestamp)}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {getStatusBadge(notif.type)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4">
            <div className="text-xs text-gray-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, filteredNotifications.length)} of{" "}
              {filteredNotifications.length} entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {getPageNumbers().map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-2 py-1 text-xs border rounded ${
                        currentPage === page
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedNotif && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {selectedNotif.title}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {getTimeAgo(selectedNotif.timestamp)}
                </p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Status Badge */}
              <div className="mb-4">{getStatusBadge(selectedNotif.type)}</div>

              {/* Payment Details for Payment Reminders */}
              {selectedNotif.type === "payment_reminder" && selectedNotif.details && (
                <div className="bg-amber-50 border border-amber-200 rounded p-4 mb-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber-600" />
                    Payment Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-amber-200">
                      <span className="text-gray-600">Treatment:</span>
                      <span className="font-semibold text-gray-800">
                        {selectedNotif.details.treatment}
                      </span>
                    </div>

                    {selectedNotif.details.treatmentOption && (
                      <div className="flex justify-between items-center py-1 border-b border-amber-200">
                        <span className="text-gray-600">Option:</span>
                        <span className="font-medium text-gray-700 text-xs">
                          {selectedNotif.details.treatmentOption}
                        </span>
                      </div>
                    )}
                    
                    {selectedNotif.details.dateVisit && selectedNotif.details.dateVisit !== "N/A" && (
                      <div className="flex justify-between items-center py-1 border-b border-amber-200">
                        <span className="text-gray-600">Date of Visit:</span>
                        <span className="font-semibold text-gray-800">
                          {selectedNotif.details.dateVisit}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-1 border-b border-amber-200">
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-semibold text-gray-800">
                        ₱{selectedNotif.details.totalAmount?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-amber-200">
                      <span className="text-gray-600">Amount Paid:</span>
                      <span className="font-semibold text-green-600">
                        ₱{selectedNotif.details.amountPaid?.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 bg-amber-100 rounded px-2 mt-2">
                      <span className="text-gray-700 font-medium">Outstanding Balance:</span>
                      <span className="font-bold text-xl text-amber-700">
                        ₱{selectedNotif.details.balance?.toLocaleString()}
                      </span>
                    </div>

                  </div>
                </div>
              )}

              {/* Appointment Details for Appointment Notifications */}
              {selectedNotif.type !== "payment_reminder" && selectedNotif.details && (
                <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Appointment Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedNotif.details.appointmentDate && (
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-semibold text-gray-800">
                          {selectedNotif.details.appointmentDate}
                        </span>
                      </div>
                    )}

                    {selectedNotif.details.time && (
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="text-gray-600">Time:</span>
                        <span className="font-semibold text-gray-800">
                          {selectedNotif.details.time}
                        </span>
                      </div>
                    )}

                    {selectedNotif.details.treatment && (
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="text-gray-600">Treatment:</span>
                        <span className="font-semibold text-gray-800">
                          {selectedNotif.details.treatment}
                        </span>
                      </div>
                    )}

                    {selectedNotif.details.dentist && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-600">Dentist:</span>
                        <span className="font-semibold text-gray-800">
                          {selectedNotif.details.dentist}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Message */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  Message
                </h3>
                <p className="text-sm text-gray-800 leading-relaxed">
                  {selectedNotif.message}
                </p>
              </div>

              {/* Received Time */}
              <div className="bg-gray-50 border border-gray-300 rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Received: {getFullDateTime(selectedNotif.timestamp)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-300 mt-4">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "Are you sure you want to delete this notification?"
                      )
                    ) {
                      handleDelete(selectedNotif.id);
                      setShowDetailsModal(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  Delete
                </button>

                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2.5 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}