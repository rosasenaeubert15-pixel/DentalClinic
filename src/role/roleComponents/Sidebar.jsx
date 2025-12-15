import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  Calendar,
  Home,
  LogOut,
  X,
  Users,
  Users2,
  User,
  UserCircle,
  ChevronDown,
  Bell,
  ChevronLeft,
  ChevronRight,
  Brain,
  Activity,
  Stethoscope,
  FolderOpen,
  CreditCard,
} from "lucide-react";
import { db, auth } from "../../../firebase.config";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit,
  getDoc,
  doc 
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function AdminSidebar({
  setPage,
  currentPage,
  handleLogout,
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  viewedAppointments = new Set(),
  viewedNotifications = new Set(),
}) {
  // Initialize role from localStorage (lowercased for consistent checks).
  const [role, setRole] = useState(() => {
    const stored = localStorage.getItem("role");
    return stored ? stored.toLowerCase() : "admin";
  });

  const [userOpen, setUserOpen] = useState(false);
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [unreadBillingCount, setUnreadBillingCount] = useState(0);
  const [userId, setUserId] = useState(null);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [readNotificationsLoaded, setReadNotificationsLoaded] = useState(false);
  const [newAppointmentCount, setNewAppointmentCount] = useState(0);

  // Listen to auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
        setUnreadNotificationCount(0);
      }
    });
    return () => unsub();
  }, []);

  // Load read notifications from Firebase/localStorage
  useEffect(() => {
    if (!userId) return;

    const loadReadNotifications = async () => {
      try {
        const readDocRef = doc(db, "adminNotifications", userId);
        const readDoc = await getDoc(readDocRef);

        if (readDoc.exists()) {
          const readIds = readDoc.data().readNotificationIds || [];
          setReadNotifications(new Set(readIds));
          localStorage.setItem(`readNotifications_${userId}`, JSON.stringify(readIds));
          setReadNotificationsLoaded(true);
        } else {
          const localData = localStorage.getItem(`readNotifications_${userId}`);
          if (localData) {
            setReadNotifications(new Set(JSON.parse(localData)));
            setReadNotificationsLoaded(true);
          }
        }
      } catch (error) {
        console.warn("Error loading read notifications:", error);
        try {
          const localData = localStorage.getItem(`readNotifications_${userId}`);
          if (localData) {
            setReadNotifications(new Set(JSON.parse(localData)));
            setReadNotificationsLoaded(true);
          }
        } catch (localError) {
          console.error("Error loading from localStorage:", localError);
        }
      }
    };

    loadReadNotifications();
  }, [userId]);

  // Recalculate unread count when readNotifications changes
  useEffect(() => {
    if (readNotifications.size > 0) {
      // Get all notification IDs and filter out the read ones
      const allNotificationIds = Array.from(readNotifications.keys());
      const unreadCount = allNotificationIds.filter(id => !readNotifications.has(id)).length;
      // This will be handled by the real-time listeners below
    }
  }, [readNotifications]);

  // Real-time listener for new appointments (pending/confirmed status)
  // Counts from both appointments (walk-in) and onlineRequests collections
  // Badge shows items that would appear in the Appointment data table
  useEffect(() => {
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("status", "in", ["pending", "confirmed"])
    );

    const onlineRequestsQuery = query(
      collection(db, "onlineRequests"),
      where("status", "in", ["pending", "confirmed"])
    );

    const unsubAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      const apt = snapshot.docs.length;
      console.debug(`[Sidebar] appointments (walk-in) with pending/confirmed: ${apt}`);
      appointmentCountsRef.current["walk-in"] = apt;
      updateTotalAppointmentCount();
    }, (error) => {
      console.error("Error listening to appointments:", error);
    });

    const unsubOnlineRequests = onSnapshot(onlineRequestsQuery, (snapshot) => {
      const online = snapshot.docs.length;
      console.debug(`[Sidebar] onlineRequests with pending/confirmed: ${online}`);
      appointmentCountsRef.current.online = online;
      updateTotalAppointmentCount();
    }, (error) => {
      console.error("Error listening to online requests:", error);
    });

    return () => {
      unsubAppointments();
      unsubOnlineRequests();
    };
  }, []);

  // Track appointment counts from both collections
  const appointmentCountsRef = useRef({ "walk-in": 0, online: 0 });

  const updateTotalAppointmentCount = () => {
    // Sum both pending/confirmed from both collections
    // This matches what the data table displays
    const total = appointmentCountsRef.current["walk-in"] + appointmentCountsRef.current.online;
    console.debug(`[Sidebar] total new appointments badge: ${total} (walk-in: ${appointmentCountsRef.current["walk-in"]}, online: ${appointmentCountsRef.current.online})`);
    setNewAppointmentCount(total);
  };
  
  // Real-time listener for unpaid billing (payments with status not 'paid')
  useEffect(() => {
    const billingQuery = query(
      collection(db, 'payments'),
      where('status', '!=', 'paid'),
      orderBy('status'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(
      billingQuery,
      (snapshot) => {
        const unpaidCount = snapshot.docs.length;
        console.debug(`[Sidebar] unpaid billing count: ${unpaidCount}`);
        setUnreadBillingCount(unpaidCount);
      },
      (error) => {
        console.error("Error listening to billing:", error);
      }
    );

    return () => unsub();
  }, []);

  // Real-time listener for notifications; compute per-admin unread count by
  // excluding IDs present in the admin's `adminNotifications/{userId}` read list.
  useEffect(() => {
    if (!userId) {
      setUnreadNotificationCount(0);
      return;
    }

    // Wait until readNotification IDs are loaded so we compute accurate badge counts.
    if (!readNotificationsLoaded) {
      setUnreadNotificationCount(0);
      return;
    }

    const notifQuery = query(
      collection(db, "adminNotifications"),
      orderBy("createdAt", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(
      notifQuery,
      (snapshot) => {
        try {
          const ids = snapshot.docs.map((d) => d.id);
          const samples = snapshot.docs.slice(0, 5).map((d) => d.data());
          console.debug("[Sidebar] notifications snapshot:", ids.length, ids.slice(0,5), samples);
        } catch (e) {
          console.debug("[Sidebar] notifications snapshot - error reading docs:", e);
        }

        try {
          const unread = snapshot.docs.filter((d) => !readNotifications.has(d.id)).length;
          console.debug(`[Sidebar] computed unread=${unread} total=${snapshot.size}`);
          setUnreadNotificationCount(unread);
        } catch (e) {
          console.error("[Sidebar] Error computing unread count:", e);
          setUnreadNotificationCount(snapshot.size);
        }
      },
      (error) => {
        console.error("Error listening to notifications:", error);
      }
    );

    return () => unsub();
  }, [userId, readNotificationsLoaded, readNotifications]);

  const userSub = [
    { key: "Admin Users", label: "Admin", Icon: Users },
    { key: "Dentist Users", label: "Dentist", Icon: Users2 },
    { key: "Staff Users", label: "Staff", Icon: User },
    { key: "Patient Users", label: "Patient", Icon: UserCircle, page: "Patient Users" },
  ];

  const treatmentSub = [
    { key: "DentaVisAi", label: "DentaVisAi", Icon: Brain, page: "AI" },
    { key: "Treatment", label: "Treatment", Icon: Stethoscope, page: "Treatment" },
  ];

  // Filter treatment sub-items for roles
  const filteredTreatmentSub = (() => {
    if (role === "dentist") {
      return treatmentSub.filter((t) => t.key === "DentaVisAi" || t.key === "Treatment");
    }
    if (role === "staff") {
      return []; // Staff walang access sa Treatment
    }
    return treatmentSub;
  })();

  const topLevelItems = [
    { key: "Dental Records", label: "Dental Records", Icon: FolderOpen },
    { key: "Billing", label: "Billing", Icon: CreditCard },
    { key: "Notification", label: "Notification", Icon: Bell },
  ];

  // User management: Staff access lang sa Patient Users - direct button (no dropdown)
  const filteredUserSub = (() => {
    if (role === "staff") {
      return []; // Staff: Patient as direct button, not in dropdown
    }
    if (role === "dentist") {
      return [];
    }
    return userSub;
  })();

  // Top-level items filtering
  const filteredTopLevelItems = (() => {
    if (role === "dentist") {
      return topLevelItems.filter((i) => i.key !== "Billing");
    } else if (role === "staff") {
      // Staff: Dental Records, Billing, and Notification
      return topLevelItems;
    }
    return topLevelItems;
  })();

  const handleToggle = useCallback(() => {
    if (typeof onToggle === "function") onToggle(!collapsed);
  }, [collapsed, onToggle]);

  const toggleUser = () => {
    // Staff pwede mag-toggle kasi may Patient Users sila
    setUserOpen((s) => {
      const next = !s;
      if (next) {
        setTreatmentOpen(false);
      }
      return next;
    });
  };

  const toggleTreatment = () => {
    if (role === "staff") return; // Staff walang Treatment section
    setTreatmentOpen((s) => {
      const next = !s;
      if (next) {
        setUserOpen(false);
      }
      return next;
    });
  };

  const handleItemClick = (key) => {
    if (typeof setPage === "function") setPage(key);
    if (typeof onMobileClose === "function") onMobileClose();

    setUserOpen(false);
    setTreatmentOpen(false);
  };

  const handleSubItemClick = (pageKey) => {
    if (typeof setPage === "function") setPage(pageKey);
    if (typeof onMobileClose === "function") onMobileClose();

    const userKeys = userSub.map((u) => u.page || u.key);
    const treatmentKeys = treatmentSub.map((t) => t.page || t.key);

    if (userKeys.includes(pageKey)) {
      setTreatmentOpen(false);
    }
    if (treatmentKeys.includes(pageKey)) {
      setUserOpen(false);
    }
  };

  // Check kung dapat ipakita ang Dashboard - HIDE for dentist and staff
  const showDashboard = role === "admin";

  return (
    <>
      {/* MOBILE SIDEBAR */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileOpen ? "block" : "hidden"}`}
        aria-hidden={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm"
          onClick={() => onMobileClose && onMobileClose()}
        />
        <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl overflow-y-auto border-r border-gray-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-300">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 text-white font-bold text-sm">
                {role[0]?.toUpperCase() || "A"}
              </div>
              <div>
                <div className="text-sm font-bold capitalize text-gray-800">{role}</div>
                <div className="text-[10px] text-gray-500">Abeledo Dental</div>
              </div>
            </div>

            <button
              aria-label="Close menu"
              onClick={() => onMobileClose && onMobileClose()}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <nav aria-label="Mobile menu" className="px-3 py-4 space-y-1">
            {/* Dashboard - HIDE for dentist and staff */}
            {showDashboard && (
              <button
                onClick={() => handleItemClick("Dashboard")}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
                  currentPage === "Dashboard"
                    ? "bg-gray-700 text-white font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            )}

            {/* Appointment Button */}
            <button
              onClick={() => handleItemClick("Calendar")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm relative ${
                currentPage === "Calendar"
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Appointment</span>
            </button>

            {/* Patient Button - Direct for Staff */}
            {role === "staff" && (
              <button
                onClick={() => handleItemClick("Patient Users")}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
                  currentPage === "Patient Users"
                    ? "bg-gray-700 text-white font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <UserCircle className="w-4 h-4" />
                <span>Patient</span>
              </button>
            )}

            {/* User Management - Admin only */}
            {filteredUserSub.length > 0 && (
              <div>
                <button
                  onClick={toggleUser}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  aria-expanded={userOpen}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-700">Users</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      userOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {userOpen && (
                  <div className="mt-1 space-y-0.5 pl-8">
                    {filteredUserSub.map(({ key, label, Icon, page }) => {
                      const pageId = page || key;
                      const active = currentPage === pageId;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSubItemClick(pageId)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                            active
                              ? "bg-gray-700 text-white font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Treatment Management - HIDE for staff */}
            {filteredTreatmentSub.length > 0 && (
              <div>
                <button
                  onClick={toggleTreatment}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                  aria-expanded={treatmentOpen}
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-gray-700">Treatment</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      treatmentOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {treatmentOpen && (
                  <div className="mt-1 space-y-0.5 pl-8">
                    {filteredTreatmentSub.map(({ key, label, Icon, page }) => {
                      const pageId = page || key;
                      const active = currentPage === pageId;
                      return (
                        <button
                          key={key}
                          onClick={() => handleSubItemClick(pageId)}
                          className={`flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                            active
                              ? "bg-gray-700 text-white font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Top-level items */}
            <div className="space-y-1 pt-2 border-t border-gray-200">
              {filteredTopLevelItems.map(({ key, label, Icon }) => {
                const active = currentPage === key;
                const notifBadge = key === "Notification" && unreadNotificationCount > 0;
                const billingBadge = key === "Billing" && unreadBillingCount > 0;
                const showBadge = notifBadge || billingBadge;
                const badgeCount = notifBadge ? unreadNotificationCount : (billingBadge ? unreadBillingCount : 0);
                
                return (
                  <button
                    key={key}
                    onClick={() => handleItemClick(key)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm relative ${
                      active
                        ? "bg-gray-700 text-white font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-4 h-4" />
                      {showBadge && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                          {badgeCount > 9 ? "9" : badgeCount}
                        </span>
                      )}
                    </div>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-300 bg-white">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-300">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                  {role[0]?.toUpperCase() || "A"}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900 truncate capitalize">
                  {role}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  admin@clinic.com
                </div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* DESKTOP SIDEBAR */}
      <div
        className={`hidden md:flex flex-col bg-white border-r border-gray-300 h-screen sticky top-0 z-10 transition-all duration-300 ${
          collapsed ? "w-16" : "w-56"
        }`}
        role="navigation"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3.5 bg-white border-b border-gray-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 text-white font-bold text-sm flex-shrink-0">
              {collapsed ? role[0]?.toUpperCase() || "A" : <Activity className="w-4 h-4" />}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold truncate capitalize text-gray-800">
                  {role}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Abeledo Dental
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`p-1.5 hover:bg-gray-100 rounded transition-colors flex-shrink-0 ${
              collapsed ? "mx-auto mt-2" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {/* Dashboard - HIDE for dentist and staff */}
          {showDashboard && (
            <button
              onClick={() => handleItemClick("Dashboard")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
                currentPage === "Dashboard"
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              title={collapsed ? "Dashboard" : ""}
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* Appointment */}
          <button
            onClick={() => handleItemClick("Calendar")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
              currentPage === "Calendar"
                ? "bg-gray-700 text-white font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            title={collapsed ? "Appointment" : ""}
          >
            <Calendar className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Appointment</span>}
          </button>

          {/* Patient Button - Direct for Staff */}
          {role === "staff" && (
            <button
              onClick={() => handleItemClick("Patient Users")}
              className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
                currentPage === "Patient Users"
                  ? "bg-gray-700 text-white font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
              title={collapsed ? "Patient" : ""}
            >
              <UserCircle className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Patient</span>}
            </button>
          )}

          {/* User Management - Show for staff (Patient Users only) and admin */}
          {filteredUserSub.length > 0 && (
            <div className="relative">
              <button
                onClick={toggleUser}
                className={`flex items-center ${
                  collapsed ? "justify-center" : "justify-between"
                } w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm ${
                  filteredUserSub.some(({ key, page }) => (page || key) === currentPage)
                    ? "bg-gray-100"
                    : ""
                }`}
                aria-expanded={userOpen}
                title={collapsed ? "Users" : ""}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-4 h-4 flex-shrink-0 text-gray-600" />
                  {!collapsed && (
                    <span className="font-medium text-gray-700">Users</span>
                  )}
                </div>
                {!collapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      userOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {userOpen && (
                <div
                  className={`${
                    collapsed
                      ? "absolute left-full top-0 ml-2 w-44 bg-white border border-gray-300 rounded-lg shadow-lg p-1.5 z-50"
                      : "mt-0.5 space-y-0.5 pl-8"
                  }`}
                >
                  {filteredUserSub.map(({ key, label, Icon, page }) => {
                    const pageId = page || key;
                    const active = currentPage === pageId;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSubItemClick(pageId)}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                          active
                            ? "bg-gray-700 text-white font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Treatment Management - HIDE for staff */}
          {filteredTreatmentSub.length > 0 && (
            <div className="relative">
              <button
                onClick={toggleTreatment}
                className={`flex items-center ${
                  collapsed ? "justify-center" : "justify-between"
                } w-full px-3 py-2.5 rounded-lg hover:bg-gray-100 transition-colors text-sm ${
                  filteredTreatmentSub.some(({ key, page }) => (page || key) === currentPage)
                    ? "bg-gray-100"
                    : ""
                }`}
                aria-expanded={treatmentOpen}
                title={collapsed ? "Treatment" : ""}
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 flex-shrink-0 text-gray-600" />
                  {!collapsed && (
                    <span className="font-medium text-gray-700">Treatment</span>
                  )}
                </div>
                {!collapsed && (
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      treatmentOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {treatmentOpen && (
                <div
                  className={`${
                    collapsed
                      ? "absolute left-full top-0 ml-2 w-44 bg-white border border-gray-300 rounded-lg shadow-lg p-1.5 z-50"
                      : "mt-0.5 space-y-0.5 pl-8"
                  }`}
                >
                  {filteredTreatmentSub.map(({ key, label, Icon, page }) => {
                    const pageId = page || key;
                    const active = currentPage === pageId;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSubItemClick(pageId)}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg transition-colors text-sm ${
                          active
                            ? "bg-gray-700 text-white font-medium"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Top-level items */}
          <div className="space-y-0.5 pt-2 border-t border-gray-200">
            {filteredTopLevelItems.map(({ key, label, Icon }) => {
              const active = currentPage === key;
              const notifBadge = key === "Notification" && unreadNotificationCount > 0;
              const billingBadge = key === "Billing" && unreadBillingCount > 0;
              const showBadge = notifBadge || billingBadge;
              const badgeCount = notifBadge ? unreadNotificationCount : (billingBadge ? unreadBillingCount : 0);
              
              return (
                <button
                  key={key}
                  onClick={() => handleItemClick(key)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm relative ${
                    active
                      ? "bg-gray-700 text-white font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  title={collapsed ? label : ""}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className="w-4 h-4" />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                        {badgeCount > 9 ? "9" : badgeCount}
                      </span>
                    )}
                  </div>
                  {!collapsed && <span>{label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-gray-300 bg-white">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-300">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                  {role[0]?.toUpperCase() || "A"}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900 truncate capitalize">{role}</div>
                <div className="text-[10px] text-gray-500 truncate">admin@clinic.com</div>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                  {role[0]?.toUpperCase() || "A"}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sign out"
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
} 