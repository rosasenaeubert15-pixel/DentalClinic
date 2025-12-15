// AdminTopbar.jsx - Improved with persistent notifications
import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  Clock,
  Check,
  ChevronRight,
  Calendar,
  User,
  CheckCircle,
  XCircle,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { db } from "../../../firebase.config";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";

export default function AdminTopbar({
  pageTitle = "Dashboard",
  onNavigateToNotifications,
  adminId = "admin_default", // Pass the logged-in admin ID
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const notifRef = useRef(null);
  const unsubscribeRefs = useRef([]);

  // Load read notifications from Firebase
  useEffect(() => {
    const loadReadNotifications = async () => {
      try {
        const readDocRef = doc(db, "adminNotifications", adminId);
        const readDoc = await getDoc(readDocRef);
        
        if (readDoc.exists()) {
          const readIds = readDoc.data().readNotificationIds || [];
          setReadNotifications(new Set(readIds));
        }
      } catch (error) {
        console.error("Error loading read notifications:", error);
      }
    };

    loadReadNotifications();
  }, [adminId]);

  // Real-time listener for appointments (new, confirmed, cancelled)
  useEffect(() => {
    const q = query(
      collection(db, "onlineRequests"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifList = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date();
          const status = (data.status || data.reservationStatus || "")
            .toString()
            .toLowerCase();

          let type = "appointment_pending";
          let title = "New Appointment Request";
          let message = "";

          // Determine notification type and message based on status
          if (status === "cancelled") {
            type = "appointment_cancelled";
            title = "Appointment Cancelled";
            message = `${data.userName || "A patient"} cancelled their appointment for ${data.date} at ${data.time}`;
          } else if (status === "confirmed" || status === "paid") {
            type = "appointment_confirmed";
            title = "Appointment Confirmed";
            message = `${data.userName || "A patient"} confirmed appointment for ${data.date} at ${data.time}`;
          } else {
            message = `${data.userName || "A patient"} requested an appointment for ${data.date} at ${data.time}`;
          }

          message += ` - ${data.treatmentOption || data.treatment}`;

          notifList.push({
            id: `appointment_${doc.id}`,
            sourceId: doc.id,
            type: type,
            patientName: data.userName || "Unknown Patient",
            patientEmail: data.userEmail || "",
            title: title,
            message: message,
            timestamp: createdAt,
            appointmentDate: `${data.date}, ${data.time}`,
            service: data.treatmentOption || data.treatment,
            status: data.status || data.reservationStatus,
            price: data.price,
            duration: data.duration,
            reservationMethod: data.reservationMethod,
          });
        });

        setNotifications((prev) => {
          // Merge with existing notifications from other sources
          const otherNotifs = prev.filter(
            (n) => !n.id.startsWith("appointment_")
          );
          return [...notifList, ...otherNotifs].sort(
            (a, b) => b.timestamp - a.timestamp
          );
        });
      },
      (error) => {
        console.error("Error fetching appointment notifications:", error);
      }
    );

    unsubscribeRefs.current.push(unsubscribe);

    return () => {
      unsubscribeRefs.current.forEach((unsub) => unsub());
    };
  }, []);

  // Real-time listener for PayPal payments
  useEffect(() => {
    const q = query(
      collection(db, "payments"), // Assuming you have a payments collection
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentNotifs = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date();
          
          // Only create notification for successful payments
          if (data.status === "completed" || data.status === "success") {
            paymentNotifs.push({
              id: `payment_${doc.id}`,
              sourceId: doc.id,
              type: "payment_received",
              patientName: data.userName || data.customerName || "Unknown Patient",
              patientEmail: data.userEmail || data.customerEmail || "",
              title: "Payment Received",
              message: `Payment of ₱${(data.amount || 0).toLocaleString()} received via PayPal from ${data.userName || data.customerName || "a patient"}`,
              timestamp: createdAt,
              appointmentDate: data.appointmentDate || "",
              service: data.service || data.treatment || "",
              price: data.amount,
              paymentMethod: "PayPal",
              transactionId: data.transactionId || doc.id,
            });
          }
        });

        setNotifications((prev) => {
          // Merge with existing notifications
          const otherNotifs = prev.filter((n) => !n.id.startsWith("payment_"));
          return [...otherNotifs, ...paymentNotifs].sort(
            (a, b) => b.timestamp - a.timestamp
          );
        });
      },
      (error) => {
        console.error("Error fetching payment notifications:", error);
      }
    );

    unsubscribeRefs.current.push(unsubscribe);
  }, []);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !readNotifications.has(n.id))
    .length;

  // Mark notification as read in Firebase
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();

    try {
      const readDocRef = doc(db, "adminNotifications", adminId);
      const newReadIds = new Set(readNotifications);
      newReadIds.add(id);

      await setDoc(
        readDocRef,
        {
          readNotificationIds: Array.from(newReadIds),
          lastUpdated: Timestamp.now(),
        },
        { merge: true }
      );

      setReadNotifications(newReadIds);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all notifications as read
  const handleClearAll = async () => {
    try {
      const allIds = notifications.map((n) => n.id);
      const readDocRef = doc(db, "adminNotifications", adminId);

      await setDoc(
        readDocRef,
        {
          readNotificationIds: allIds,
          lastUpdated: Timestamp.now(),
        },
        { merge: true }
      );

      setReadNotifications(new Set(allIds));
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!readNotifications.has(notif.id)) {
      handleMarkAsRead(notif.id);
    }
    setNotifOpen(false);
    if (onNavigateToNotifications) {
      onNavigateToNotifications(notif.sourceId, notif.type);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "appointment_upcoming":
      case "appointment_pending":
        return <Calendar className="w-5 h-5" />;
      case "appointment_confirmed":
        return <CheckCircle className="w-5 h-5" />;
      case "appointment_cancelled":
        return <XCircle className="w-5 h-5" />;
      case "payment_received":
        return <DollarSign className="w-5 h-5" />;
      case "appointment_reminder":
        return <Clock className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "appointment_upcoming":
      case "appointment_pending":
        return "bg-cyan-100 text-cyan-700";
      case "appointment_confirmed":
        return "bg-emerald-100 text-emerald-700";
      case "appointment_cancelled":
        return "bg-rose-100 text-rose-700";
      case "payment_received":
        return "bg-green-100 text-green-700";
      case "appointment_reminder":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Recently";

    const now = new Date();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return timestamp.toLocaleDateString();
  };

  const handleViewAll = () => {
    setNotifOpen(false);
    if (onNavigateToNotifications) {
      onNavigateToNotifications();
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* LEFT SECTION - Page Title */}
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-700 to-cyan-900 bg-clip-text text-transparent">
                {pageTitle}
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Abeledo Dental Clinic Management
              </p>
            </div>
          </div>

          {/* RIGHT SECTION - Notifications Only */}
          <div className="flex items-center">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2.5 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-blue-50 rounded-xl transition-all group"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="w-5 h-5 text-gray-700 group-hover:text-cyan-700 transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center font-bold shadow-lg shadow-red-200 animate-pulse">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-3 w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-[32rem] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-cyan-50 via-blue-50 to-teal-50">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Bell className="w-5 h-5 text-cyan-700" />
                        Notifications
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {unreadCount > 0
                          ? `${unreadCount} unread notification${
                              unreadCount > 1 ? "s" : ""
                            }`
                          : "All caught up!"}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-xs text-cyan-700 hover:text-cyan-800 font-semibold hover:bg-white px-3 py-1.5 rounded-lg transition-all border border-cyan-200 hover:border-cyan-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="overflow-y-auto flex-1">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Bell className="w-8 h-8 text-cyan-700" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          No notifications yet
                        </p>
                        <p className="text-xs text-gray-500">
                          We'll notify you of appointments, cancellations, and
                          payments
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((notif) => {
                          const isRead = readNotifications.has(notif.id);
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-4 hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all cursor-pointer group ${
                                !isRead ? "bg-cyan-50/30" : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${getNotificationColor(
                                    notif.type
                                  )}`}
                                >
                                  {getNotificationIcon(notif.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">
                                        {notif.title}
                                      </p>
                                      {notif.patientName && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                          <User className="w-3 h-3" />
                                          {notif.patientName}
                                          {notif.patientEmail && (
                                            <span className="text-gray-400">
                                              • {notif.patientEmail}
                                            </span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                    {!isRead && (
                                      <div className="w-2 h-2 rounded-full bg-cyan-700 flex-shrink-0 mt-1.5 animate-pulse" />
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  {(notif.appointmentDate || notif.service || notif.price) && (
                                    <div className="flex flex-col gap-1 mb-2">
                                      {notif.appointmentDate && (
                                        <div className="flex items-center gap-2 text-xs text-cyan-700 bg-cyan-50 rounded-lg px-2 py-1 w-fit">
                                          <Calendar className="w-3 h-3" />
                                          <span className="font-medium">
                                            {notif.appointmentDate}
                                          </span>
                                        </div>
                                      )}
                                      {notif.service && (
                                        <div className="text-xs text-gray-600">
                                          Service:{" "}
                                          <span className="font-medium">
                                            {notif.service}
                                          </span>
                                        </div>
                                      )}
                                      {notif.price && (
                                        <div className="text-xs text-gray-600">
                                          {notif.type === "payment_received"
                                            ? "Amount"
                                            : "Price"}
                                          :{" "}
                                          <span className="font-semibold">
                                            ₱{notif.price.toLocaleString()}
                                          </span>
                                        </div>
                                      )}
                                      {notif.duration && (
                                        <div className="text-xs text-gray-600">
                                          Duration:{" "}
                                          <span className="font-medium">
                                            {notif.duration} minutes
                                          </span>
                                        </div>
                                      )}
                                      {notif.transactionId && (
                                        <div className="text-xs text-gray-500">
                                          Transaction: {notif.transactionId}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {getTimeAgo(notif.timestamp)}
                                    </p>
                                    {!isRead && (
                                      <button
                                        onClick={(e) =>
                                          handleMarkAsRead(notif.id, e)
                                        }
                                        className="p-1.5 hover:bg-cyan-100 rounded-lg transition-all flex-shrink-0 group/btn"
                                        title="Mark as read"
                                      >
                                        <Check className="w-4 h-4 text-cyan-700 group-hover/btn:scale-110 transition-transform" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-transparent">
                      <button
                        onClick={handleViewAll}
                        className="w-full text-center text-sm text-cyan-700 hover:text-cyan-800 font-semibold py-2.5 px-4 flex items-center justify-center gap-2 rounded-lg hover:bg-cyan-50 transition-all group"
                      >
                        View All Notifications
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}