import React, { useCallback, useState, useEffect } from "react";
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  User,
  X,
  ChevronLeft,
  ChevronRight,
  Bell,
  Timer,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { auth, db } from "../../../firebase.config";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PatientSidebar({
  setPage,
  currentPage,
  handleLogout,
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}) {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadBillingCount, setUnreadBillingCount] = useState(0);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [appointmentBillingCount, setAppointmentBillingCount] = useState(0);
  const [onlineRequestBillingCount, setOnlineRequestBillingCount] = useState(0);

  // Load user profile data and unread notifications count (real-time)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserProfile({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: data.email || user.email || "",
            avatarUrl: data.avatarUrl || "",
          });
        } else {
          setUserProfile({
            firstName: user.displayName?.split(" ")[0] || "",
            lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
            email: user.email || "",
            avatarUrl: "",
          });
        }

        // Real-time listener for unread notifications count
        const notifQuery = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("read", "==", false)
        );
        
        const unsubscribeNotif = onSnapshot(
          notifQuery,
          (snapshot) => {
            setUnreadCount(snapshot.size);
          },
          (error) => {
            console.error("Error listening to notifications:", error);
          }
        );

        // Real-time listener for unpaid/partial billing records from appointments
        const appointmentBillingQuery = query(
          collection(db, "appointments"),
          where("userId", "==", user.uid),
          where("status", "==", "treated")
        );
        
        const unsubscribeAppointmentBilling = onSnapshot(
          appointmentBillingQuery,
          (snapshot) => {
            const unpaidCount = snapshot.docs.filter(doc => {
              const data = doc.data();
              return data.balance > 0; // Count bills with remaining balance
            }).length;
            setAppointmentBillingCount(unpaidCount);
          },
          (error) => {
            console.error("Error listening to appointment billing:", error);
          }
        );

        // Real-time listener for unpaid/partial billing records from online requests
        const onlineRequestBillingQuery = query(
          collection(db, "onlineRequests"),
          where("userId", "==", user.uid),
          where("status", "==", "treated")
        );
        
        const unsubscribeOnlineRequestBilling = onSnapshot(
          onlineRequestBillingQuery,
          (snapshot) => {
            const unpaidOnlineCount = snapshot.docs.filter(doc => {
              const data = doc.data();
              return data.balance > 0; // Count bills with remaining balance
            }).length;
            setOnlineRequestBillingCount(unpaidOnlineCount);
          },
          (error) => {
            console.error("Error listening to online request billing:", error);
          }
        );

        setLoading(false);
        return () => {
          unsubscribeNotif();
          unsubscribeAppointmentBilling();
          unsubscribeOnlineRequestBilling();
        };
      } catch (error) {
        console.error("Error loading user profile:", error);
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  // Update billing badge count when either source changes
  useEffect(() => {
    setUnreadBillingCount(appointmentBillingCount + onlineRequestBillingCount);
  }, [appointmentBillingCount, onlineRequestBillingCount]);

  const menuItems = [
    { key: "Patient Dashboard", label: "My Dashboard", Icon: LayoutDashboard },
    { key: "Patient Appointment", label: "Book Appointment", Icon: Calendar },
    { key: "Patient Timeline", label: "Timeline", Icon: Timer },
    { key: "Patient Billing", label: "My Billing", Icon: CreditCard, badge: unreadBillingCount },
    { key: "Patient Notifications", label: "Notifications", Icon: Bell, badge: unreadCount },
    { key: "Patient Profile", label: "Profile", Icon: User },
  ];

  const handleToggle = useCallback(() => {
    if (typeof onToggle === "function") onToggle(!collapsed);
  }, [collapsed, onToggle]);

  const handleItemClick = (key) => {
    if (typeof setPage === "function") setPage(key);
    if (typeof onMobileClose === "function") onMobileClose();
  };

  const getInitials = () => {
    if (!userProfile) return "PT";
    const first = userProfile.firstName?.charAt(0)?.toUpperCase() || "";
    const last = userProfile.lastName?.charAt(0)?.toUpperCase() || "";
    return first + last || "PT";
  };

  const getUserName = () => {
    if (!userProfile) return "Patient";
    return `${userProfile.firstName} ${userProfile.lastName}`.trim() || "Patient";
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    if (handleLogout) handleLogout();
  };

  const cancelLogout = () => {
    setShowLogoutModal(false);
  };

  return (
    <>
      {/* LOGOUT MODAL - Simplified */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm"
            onClick={cancelLogout}
          />
          
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Confirm Logout</h3>
                  <p className="text-sm text-gray-500">Are you sure you want to sign out?</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 flex gap-3">
              <button
                onClick={cancelLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

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
                PT
              </div>
              <div>
                <div className="text-sm font-bold text-gray-800">Patient</div>
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

          {/* Navigation */}
          <nav aria-label="Mobile patient menu" className="px-3 py-4 space-y-1">
            {menuItems.map(({ key, label, Icon, badge }) => {
              const active = currentPage === key;
              return (
                <button
                  key={key}
                  onClick={() => handleItemClick(key)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm relative ${
                    active
                      ? "bg-gray-700 text-white font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <div className="relative">
                    <Icon className="w-4 h-4" />
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                        {badge > 9 ? "9" : badge}
                      </span>
                    )}
                  </div>
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-300 bg-white">
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-300">
              <div className="relative flex-shrink-0">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="User avatar"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                    {getInitials()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900 truncate">
                  {getUserName()}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {userProfile?.email}
                </div>
              </div>
              <button
                onClick={handleLogoutClick}
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
        aria-label="Patient sidebar"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3.5 bg-white border-b border-gray-300">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 text-white font-bold text-sm flex-shrink-0">
              {collapsed ? "PT" : <User className="w-4 h-4" />}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-gray-800">Patient</div>
                <div className="text-[10px] text-gray-500 truncate">Abeledo Dental</div>
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

        {/* Navigation Menu */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {menuItems.map(({ key, label, Icon, badge }) => {
            const active = currentPage === key;
            return (
              <button
                key={key}
                onClick={() => handleItemClick(key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 text-left rounded-lg transition-colors text-sm ${
                  active
                    ? "bg-gray-700 text-white font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? label : ""}
              >
                <div className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                      {badge > 9 ? "9" : badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-2 border-t border-gray-300 bg-white">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-300">
              <div className="relative flex-shrink-0">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="User avatar"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                    {getInitials()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-900 truncate">
                  {getUserName()}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {userProfile?.email}
                </div>
              </div>
              <button
                onClick={handleLogoutClick}
                aria-label="Sign out"
                className="p-1.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5 text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {userProfile?.avatarUrl ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt="User avatar"
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-700 text-white flex items-center justify-center font-bold text-sm">
                    {getInitials()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
              </div>
              <button
                onClick={handleLogoutClick}
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