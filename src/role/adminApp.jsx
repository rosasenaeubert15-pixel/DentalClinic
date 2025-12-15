import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase.config";
import AdminSidebar from "./roleComponents/Sidebar";
import Dashboard from "./rolePages/Dashboard";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import AdminUserAdmin from "./rolePages/AdminUser";
import AdminUserDentist from "./rolePages/DentistUser";
import AdminUserPatient from "./rolePages/PatientUser";
import AdminUserStaff from "./rolePages/StaffUser";
import AdminOnlineRequest from "./rolePages/OnlineRequest";
import AdminWalkInRequest from "./rolePages/WalkInRequest";
import AdminCalendar from "./rolePages/Calendar";
import Treatment from "./rolePages/Treatment";
import AI from "./rolePages/AI";
import DentalRecords from "./rolePages/DentalRecords";
import Billing from "./rolePages/Billing";
import Notification from "./rolePages/Notification";

export default function AdminApp() {
  const navigate = useNavigate();

  // page state (default to Dashboard so it's the first page shown)
  const [page, setPage] = useState("Dashboard");

  // sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
  const [viewedAppointments, setViewedAppointments] = useState(new Set());
  const [viewedNotifications, setViewedNotifications] = useState(new Set());

  // role + auth guard
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      localStorage.clear();
      navigate("/", { replace: true });
      return;
    }

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user) {
        localStorage.removeItem("role");
        navigate("/", { replace: true });
      }
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
    // eslint-disable-next-line
  }, [navigate]);

  // handle logout (firebase signOut if available)
  const handleLogout = async () => {
    try {
      if (auth && typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        const { signOut } = await import("firebase/auth");
        await signOut(auth);
      }
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      try {
        localStorage.removeItem("role");
      } catch (e) {}
      navigate("/", { replace: true });
    }
  };

  // toggle helpers
  const openMobileSidebar = (next) => {
    if (typeof next === "boolean") setSidebarOpen(next);
    else setSidebarOpen((s) => !s);
  };
  const toggleCollapsed = (next) => {
    if (typeof next === "boolean") setSidebarCollapsed(next);
    else setSidebarCollapsed((s) => !s);
  };

  // Mark appointment as viewed to reduce badge count
  const handleAppointmentViewed = useCallback((appointmentId) => {
    setViewedAppointments(prev => new Set(prev).add(appointmentId));
  }, []);

  // Mark notification as viewed to reduce badge count
  const handleNotificationViewed = useCallback((notificationId) => {
    setViewedNotifications(prev => new Set(prev).add(notificationId));
  }, []);

  // render pages - UPDATED with new pages
  const renderPage = () => {
    switch (page) {
      case "Dashboard":
        return <Dashboard />;
      case "Online Request":
        return <AdminOnlineRequest />;
      case "Calendar":
        return <AdminCalendar onAppointmentViewed={handleAppointmentViewed} />;
      case "Walk In Request":
        return <AdminWalkInRequest />;
      case "Admin Users":
        return <AdminUserAdmin />;
      case "Dentist Users":
        return <AdminUserDentist />;
      case "Staff Users":
        return <AdminUserStaff />;
      case "Patient Users":
        return <AdminUserPatient />;
      case "Admin Appointment":
        return <AdminAppointment />;
      case "Treatment":
        return <Treatment />;
      case "AI":
      case "DentaVisAi":
        return <AI />;
      case "Dental Records":
        return <DentalRecords />;
      case "Billing":
        return <Billing />;
      case "Notification":
        return <Notification onNotificationViewed={handleNotificationViewed} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex">
      {/* Sidebar */}
      <AdminSidebar
        setPage={(k) => {
          console.log("Setting page to:", k); // For debugging
          setPage(k);
          setSidebarOpen(false); // close mobile after selection
        }}
        currentPage={page}
        handleLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggle={(next) => toggleCollapsed(next)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
        viewedAppointments={viewedAppointments}
        viewedNotifications={viewedNotifications}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-md shadow-sm">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Toast container local to admin (optional, App already includes one globally) */}
      <ToastContainer
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
      />
    </div>
  );
}