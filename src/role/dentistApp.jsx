import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase.config";
import DentistSidebar from "./roleComponents/Sidebar";
import DentistOnlineRequest from "./rolePages/OnlineRequest";
import DentistWalkInRequest from "./rolePages/WalkInRequest";
import DentistCalendar from "./rolePages/Calendar";
import DentistAI from "./rolePages/AI";
import DentistTreatment from "./rolePages/Treatment";
import DentistDentalRecords from "./rolePages/DentalRecords";
import DentistNotification from "./rolePages/Notification";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function DentistApp() {
  const navigate = useNavigate();

  // Default page for dentist
  const [page, setPage] = useState("Calendar");

  // Sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Role guard: only "dentist" can access
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "dentist") {
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
  }, [navigate]);

  // Logout handler
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
      localStorage.removeItem("role");
      navigate("/", { replace: true });
    }
  };

  // Sidebar toggle helpers
  const openMobileSidebar = (next) => {
    if (typeof next === "boolean") setSidebarOpen(next);
    else setSidebarOpen((s) => !s);
  };

  const toggleCollapsed = (next) => {
    if (typeof next === "boolean") setSidebarCollapsed(next);
    else setSidebarCollapsed((s) => !s);
  };

  // Render dentist pages
  const renderPage = () => {
    switch (page) {
      case "Walk In Request":
        return <DentistWalkInRequest />;
      case "Online Request":
        return <DentistOnlineRequest />;
      case "Calendar":
        return <DentistCalendar />;
      case "AI":
        return <DentistAI />;
      case "Treatment":
        return <DentistTreatment />;
      case "Dental Records":
        return <DentistDentalRecords />;
      case "Notification":
        return <DentistNotification />;
      default:
        return <DentistCalendar />;
    }
  };

  const pageTitle = page;

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <DentistSidebar
        setPage={(k) => {
          setPage(k);
          setSidebarOpen(false);
        }}
        currentPage={page}
        handleLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggle={(next) => toggleCollapsed(next)}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto bg-white rounded-md shadow-sm">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Toast notifications */}
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