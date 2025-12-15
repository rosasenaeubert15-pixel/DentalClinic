// src/components/PatientTopbar.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  Menu,
  Bell,
  Clock,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Calendar,
  CreditCard,
  FileText,
  CheckCircle,
  XCircle,
  Info,
} from "lucide-react";
import { auth, db } from "../../../firebase.config";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDocs,
  Timestamp,
  orderBy,
  limit,
  addDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PatientTopbar({
  pageTitle = "Dashboard",
  onMobileMenu,
  onCollapseToggle,
  onNavigateToNotifications,
  notificationTrigger = 0,
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const notifRef = useRef(null);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setNotifications([]);
      }
    });
    return () => unsub();
  }, []);

  // Real-time notifications listener - LIMITED to 5 most recent
  useEffect(() => {
    if (!userId) return;

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      const notifData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(notifData);
    });

    return () => unsubscribe();
  }, [userId, notificationTrigger]);

  // Check for today's and tomorrow's appointments - create reminder notifications
  useEffect(() => {
    if (!userId) return;

    const checkUpcomingAppointments = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        // Check onlineRequests instead of appointments
        const appointmentsQuery = query(
          collection(db, "onlineRequests"),
          where("userId", "==", userId),
          where("status", "==", "confirmed")
        );

        const snapshot = await getDocs(appointmentsQuery);
        
        for (const appointmentDoc of snapshot.docs) {
          const appointment = appointmentDoc.data();
          
          // Convert appointment date string to Date object
          const appointmentDateStr = appointment.date; // Format: "YYYY-MM-DD"
          if (!appointmentDateStr) continue;
          
          const [year, month, day] = appointmentDateStr.split('-').map(Number);
          const appointmentDate = new Date(year, month - 1, day);
          appointmentDate.setHours(0, 0, 0, 0);

          const isToday = appointmentDate.getTime() === today.getTime();
          const isTomorrow = appointmentDate.getTime() === tomorrow.getTime();

          // TODAY'S APPOINTMENT - Reminder to arrive 1 hour early
          if (isToday) {
            const notifCheckToday = query(
              collection(db, "notifications"),
              where("userId", "==", userId),
              where("type", "==", "appointment_today"),
              where("appointmentId", "==", appointmentDoc.id)
            );
            
            const existingNotifToday = await getDocs(notifCheckToday);
            
            if (existingNotifToday.empty) {
              await addDoc(collection(db, "notifications"), {
                userId: userId,
                type: "appointment_today",
                appointmentId: appointmentDoc.id,
                title: "Appointment Today - Arrive Early!",
                message: `Your appointment for ${appointment.treatment || "dental service"} is scheduled today at ${appointment.time || "your scheduled time"}. Please arrive 1 hour before your appointment time.`,
                details: {
                  dentistName: appointment.preferredDentist || "Dentist",
                  date: appointment.date,
                  time: appointment.time || "",
                  treatment: appointment.treatment || "",
                  location: "Abeledo Dental Clinic",
                  reminderType: "same_day",
                  arriveEarly: "Please arrive 1 hour before your scheduled time",
                },
                read: false,
                timestamp: Timestamp.now(),
              });
              console.log("Created today's appointment notification");
            }
          }

          // TOMORROW'S APPOINTMENT - Advance reminder
          if (isTomorrow) {
            const notifCheckTomorrow = query(
              collection(db, "notifications"),
              where("userId", "==", userId),
              where("type", "==", "appointment_reminder"),
              where("appointmentId", "==", appointmentDoc.id)
            );
            
            const existingNotifTomorrow = await getDocs(notifCheckTomorrow);
            
            if (existingNotifTomorrow.empty) {
              await addDoc(collection(db, "notifications"), {
                userId: userId,
                type: "appointment_reminder",
                appointmentId: appointmentDoc.id,
                title: "Appointment Tomorrow",
                message: `Reminder: You have an appointment tomorrow at ${appointment.time || "your scheduled time"} for ${appointment.treatment || "dental service"}. Please arrive 1 hour early.`,
                details: {
                  dentistName: appointment.preferredDentist || "Dentist",
                  date: appointment.date,
                  time: appointment.time || "",
                  treatment: appointment.treatment || "",
                  location: "Abeledo Dental Clinic",
                  reminderType: "next_day",
                  arriveEarly: "Please arrive 1 hour before your scheduled time",
                },
                read: false,
                timestamp: Timestamp.now(),
              });
              console.log("Created tomorrow's appointment notification");
            }
          }
        }
      } catch (error) {
        console.error("Error checking appointments:", error);
      }
    };

    checkUpcomingAppointments();
    // Check every 30 minutes
    const interval = setInterval(checkUpcomingAppointments, 1800000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await updateDoc(doc(db, "notifications", id), {
        read: true,
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      const unreadNotifs = notifications.filter((n) => !n.read);
      const updatePromises = unreadNotifs.map((notif) =>
        updateDoc(doc(db, "notifications", notif.id), { read: true })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    setNotifOpen(false);
    if (onNavigateToNotifications) {
      onNavigateToNotifications(notif.id);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "appointment":
      case "appointment_today":
      case "appointment_reminder":
        return <Calendar className="w-5 h-5" />;
      case "appointment_confirmed":
        return <CheckCircle className="w-5 h-5" />;
      case "appointment_cancelled":
        return <XCircle className="w-5 h-5" />;
      case "appointment_reschedule":
        return <Clock className="w-5 h-5" />;
      case "billing":
      case "payment":
        return <CreditCard className="w-5 h-5" />;
      case "invoice":
        return <FileText className="w-5 h-5" />;
      case "reminder":
      case "medication":
        return <Clock className="w-5 h-5" />;
      case "alert":
        return <AlertCircle className="w-5 h-5" />;
      case "success":
        return <CheckCircle className="w-5 h-5" />;
      case "info":
        return <Info className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case "appointment":
      case "appointment_today":
      case "appointment_reminder":
        return "bg-blue-100 text-blue-600";
      case "appointment_confirmed":
      case "success":
        return "bg-green-100 text-green-600";
      case "appointment_cancelled":
      case "alert":
        return "bg-red-100 text-red-600";
      case "appointment_reschedule":
        return "bg-orange-100 text-orange-600";
      case "billing":
      case "payment":
      case "invoice":
        return "bg-amber-100 text-amber-600";
      case "reminder":
      case "medication":
        return "bg-purple-100 text-purple-600";
      case "info":
        return "bg-cyan-100 text-cyan-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Recently";
    
    const now = new Date();
    const notifTime = timestamp.toDate();
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return notifTime.toLocaleDateString();
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
          {/* LEFT SECTION */}
          <div className="flex items-center gap-4">
            <button
              onClick={onMobileMenu}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all md:hidden"
              aria-label="Toggle mobile menu"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>

            <button
              onClick={onCollapseToggle}
              className="hidden md:flex p-2 hover:bg-gray-100 rounded-lg transition-all"
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5 text-gray-700" />
            </button>

            <div className="hidden md:block w-px h-6 bg-gray-200" />

            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-800 bg-clip-text text-transparent">
                {pageTitle}
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                Welcome back to your portal
              </p>
            </div>
          </div>

          {/* RIGHT SECTION - NOTIFICATIONS */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2.5 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-blue-50 rounded-xl transition-all group"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="w-5 h-5 text-gray-700 group-hover:text-cyan-600 transition-colors" />
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
                  <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        <Bell className="w-5 h-5 text-cyan-600" />
                        Notifications
                      </h3>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="text-xs text-cyan-600 hover:text-cyan-700 font-semibold hover:bg-white px-3 py-1.5 rounded-lg transition-all border border-cyan-200 hover:border-cyan-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notifications List */}
                  <div className="overflow-y-auto flex-1 scrollbar-thin">
                    {notifications.length === 0 ? (
                      <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Bell className="w-8 h-8 text-cyan-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          No notifications yet
                        </p>
                        <p className="text-xs text-gray-500">
                          We'll notify you when something arrives
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all cursor-pointer group ${
                              !notif.read ? "bg-cyan-50/30" : ""
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
                                  <p className="text-sm font-semibold text-gray-900">
                                    {notif.title || "Notification"}
                                  </p>
                                  {!notif.read && (
                                    <div className="w-2 h-2 rounded-full bg-cyan-600 flex-shrink-0 mt-1.5 animate-pulse" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                  {notif.message}
                                </p>
                                {/* Show arrival reminder for appointment notifications */}
                                {(notif.type === "appointment_today" || 
                                  notif.type === "appointment_reminder" || 
                                  notif.type === "appointment_confirmed") && 
                                  notif.details?.arriveEarly && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                                    <p className="text-xs text-amber-800 font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {notif.details.arriveEarly}
                                    </p>
                                  </div>
                                )}
                                <div className="flex items-center justify-between">
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {getTimeAgo(notif.timestamp)}
                                  </p>
                                  {!notif.read && (
                                    <button
                                      onClick={(e) => handleMarkAsRead(notif.id, e)}
                                      className="p-1.5 hover:bg-cyan-100 rounded-lg transition-all flex-shrink-0 group/btn"
                                      title="Mark as read"
                                    >
                                      <Check className="w-4 h-4 text-cyan-600 group-hover/btn:scale-110 transition-transform" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-gradient-to-r from-gray-50 to-transparent">
                      <button 
                        onClick={handleViewAll}
                        className="w-full text-center text-sm text-cyan-600 hover:text-cyan-700 font-semibold py-2.5 px-4 flex items-center justify-center gap-2 rounded-lg hover:bg-cyan-50 transition-all group"
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
