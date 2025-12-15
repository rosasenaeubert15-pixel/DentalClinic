import React, { useEffect, useState } from "react";
import {
  Bell, Calendar, DollarSign, User, Clock, Check, Trash2, Search, X, Mail, Phone
} from "lucide-react";
import { auth, db } from "../../../firebase.config";
import {
  collection, query, where, onSnapshot, updateDoc, deleteDoc, doc, orderBy, limit,
  setDoc, getDoc, Timestamp, getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Notifications({ userRole, onNotificationViewed }) {
  const effectiveRole = userRole || "admin";

  const [notifications, setNotifications] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [readNotifications, setReadNotifications] = useState(new Set());
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // SMS modal state
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsTargetNotif, setSmsTargetNotif] = useState(null);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsTemplate, setSmsTemplate] = useState("custom");
  const [smsSending, setSmsSending] = useState(false);
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState("");

  // Pagination
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("All");

  const unsubscribeRefs = React.useRef([]);

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

  // Load read notifications from localStorage as fallback
  useEffect(() => {
    if (!userId) return;

    const loadReadNotifications = async () => {
      try {
        // Try to load from Firebase first
        const readDocRef = doc(db, "adminNotifications", userId);
        const readDoc = await getDoc(readDocRef);

        if (readDoc.exists()) {
          const readIds = readDoc.data().readNotificationIds || [];
          setReadNotifications(new Set(readIds));
          // Save to localStorage as backup
          localStorage.setItem(`readNotifications_${userId}`, JSON.stringify(readIds));
        } else {
          // If no Firebase doc, try localStorage
          const localData = localStorage.getItem(`readNotifications_${userId}`);
          if (localData) {
            setReadNotifications(new Set(JSON.parse(localData)));
          }
        }
      } catch (error) {
        console.warn("Firebase read notifications unavailable, using localStorage:", error.message);
        // Fallback to localStorage
        try {
          const localData = localStorage.getItem(`readNotifications_${userId}`);
          if (localData) {
            setReadNotifications(new Set(JSON.parse(localData)));
          }
        } catch (localError) {
          console.error("Error loading from localStorage:", localError);
        }
      }
    };

    loadReadNotifications();
  }, [userId]);

  // Real-time listener for appointments with phone number lookup
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "onlineRequests"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const notifList = [];

        // Get all patient phone numbers from users collection
        const usersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "patient")));
        const userPhoneMap = new Map();
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email && data.contactNumber) {
            userPhoneMap.set(data.email.toLowerCase(), data.contactNumber);
          }
        });

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date();
          const status = (data.status || data.reservationStatus || "")
            .toString()
            .toLowerCase();

          let phoneNumber = data.phoneNumber || data.contactNumber || data.phone || "";
          if (!phoneNumber && data.userEmail) {
            phoneNumber = userPhoneMap.get(data.userEmail.toLowerCase()) || "";
          }

          let type = "appointment_pending";
          let title = "New Appointment";
          let message = "";

          if (status === "cancelled") {
            type = "appointment_cancelled";
            title = "Appointment Cancelled";
            message = `${data.userName || "Patient"} cancelled appointment for ${data.date}`;
          } else if (status === "confirmed" || status === "paid") {
            type = "appointment_confirmed";
            title = "Appointment Confirmed";
            message = `${data.userName || "Patient"} confirmed for ${data.date}`;
          } else {
            message = `${data.userName || "Patient"} requested appointment for ${data.date}`;
          }

          const notifId = `notif_${docSnap.id}`;

          notifList.push({
            id: notifId,
            sourceId: docSnap.id,
            type: type,
            patientName: data.userName || "Unknown Patient",
            patientEmail: data.userEmail || "",
            phoneNumber: phoneNumber,
            title: title,
            message: message,
            timestamp: createdAt,
            appointmentDate: data.date || "N/A",
            appointmentTime: data.time || "N/A",
            service: data.treatmentOption || data.treatment || "N/A",
            status: data.status || data.reservationStatus,
            price: data.price,
            read: false,
          });
        });

        setNotifications((prev) => {
          const otherNotifs = prev.filter(
            (n) => !n.id.startsWith("notif_")
          );
          return [...notifList, ...otherNotifs].sort(
            (a, b) => b.timestamp - a.timestamp
          );
        });
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching notifications:", error);
        setLoading(false);
      }
    );

    unsubscribeRefs.current.push(unsubscribe);

    return () => {
      unsubscribeRefs.current.forEach((unsub) => unsub());
    };
  }, [userId]);

  // Real-time listener for PayPal payments
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "payments"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentNotifs = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : new Date();

          const phoneNumber = data.phoneNumber || data.contactNumber || data.phone || "";

          if (data.status === "completed" || data.status === "success") {
            const notifId = `notif_payment_${docSnap.id}`;

            paymentNotifs.push({
              id: notifId,
              sourceId: docSnap.id,
              type: "payment_received",
              patientName: data.userName || data.customerName || "Unknown Patient",
              patientEmail: data.userEmail || data.customerEmail || "",
              phoneNumber: phoneNumber,
              title: "Payment Received",
              message: `Payment of ₱${(data.amount || 0).toLocaleString()} received from ${data.userName || "patient"}`,
              timestamp: createdAt,
              appointmentDate: data.appointmentDate || "N/A",
              service: data.service || data.treatment || "N/A",
              price: data.amount,
              read: false,
            });
          }
        });

        setNotifications((prev) => {
          const otherNotifs = prev.filter((n) => !n.id.startsWith("notif_payment_"));
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
  }, [userId]);

  // Load patients for SMS dropdown
  useEffect(() => {
    if (!userId) return;

    const loadPatients = async () => {
      try {
        const usersQuery = query(
          collection(db, "users"),
          where("role", "==", "patient")
        );
        const usersSnapshot = await getDocs(usersQuery);
        
        const patientMap = new Map();
        
        usersSnapshot.forEach((doc) => {
          const data = doc.data();
          const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
          
          if (fullName && data.contactNumber) {
            const key = data.contactNumber;
            if (!patientMap.has(key)) {
              patientMap.set(key, {
                name: fullName,
                phone: data.contactNumber,
                email: data.email || ""
              });
            }
          }
        });

        const patientList = Array.from(patientMap.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        
        setPatients(patientList);
      } catch (error) {
        console.error("Error loading patients:", error);
      }
    };

    loadPatients();
  }, [userId]);

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "Recently";
    const now = new Date();
    const notifTime = timestamp instanceof Date ? timestamp : timestamp.toDate();
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
      const date = timestamp instanceof Date ? timestamp : timestamp.toDate();
      return date.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid date";
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      const newReadIds = new Set(readNotifications);
      newReadIds.add(id);
      
      // Update state immediately for better UX
      setReadNotifications(newReadIds);
      
      // Save to localStorage first
      localStorage.setItem(`readNotifications_${userId}`, JSON.stringify([...newReadIds]));

      // Call the callback to update sidebar badge
      if (typeof onNotificationViewed === 'function') {
        onNotificationViewed(id);
      }

      // Try to save to Firebase
      try {
        const readDocRef = doc(db, "adminNotifications", userId);
        await setDoc(
          readDocRef,
          {
            readNotificationIds: Array.from(newReadIds),
            lastUpdated: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (firebaseError) {
        console.warn("Could not save to Firebase, using localStorage only:", firebaseError.message);
      }

      toast.success("Marked as read");
    } catch (error) {
      console.error("Error marking as read:", error);
      toast.error("Failed to update");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    try {
      const newReadIds = new Set(readNotifications);
      newReadIds.delete(id);

      // Update state immediately
      setReadNotifications(newReadIds);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (selectedNotif?.id === id) setSelectedNotif(null);
      
      // Save to localStorage
      localStorage.setItem(`readNotifications_${userId}`, JSON.stringify([...newReadIds]));

      // Try to save to Firebase
      try {
        const readDocRef = doc(db, "adminNotifications", userId);
        await setDoc(
          readDocRef,
          {
            readNotificationIds: Array.from(newReadIds),
            lastUpdated: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (firebaseError) {
        console.warn("Could not update Firebase, using localStorage only:", firebaseError.message);
      }

      toast.success("Notification deleted");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Failed to delete");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const allIds = filteredNotifications.map(n => n.id);
      
      // Update state immediately
      setReadNotifications(new Set(allIds));
      
      // Save to localStorage
      localStorage.setItem(`readNotifications_${userId}`, JSON.stringify(allIds));

      // Try to save to Firebase
      try {
        const readDocRef = doc(db, "adminNotifications", userId);
        await setDoc(
          readDocRef,
          {
            readNotificationIds: allIds,
            lastUpdated: Timestamp.now(),
          },
          { merge: true }
        );
      } catch (firebaseError) {
        console.warn("Could not save to Firebase, using localStorage only:", firebaseError.message);
      }

      toast.success("All marked as read");
    } catch (error) {
      console.error("Error marking all as read:", error);
      toast.error("Failed to update");
    }
  };

  const getSmsTemplates = (notif) => {
    if (!notif) return {};
    
    const patientName = notif.patientName || "Patient";
    const appointmentDate = notif.appointmentDate || "your scheduled date";
    const service = notif.service || "your appointment";
    
    return {
      reminder: `Hi ${patientName}! Reminder: ${service} on ${appointmentDate}. Please arrive 10 mins early. DO NOT REPLY`,
      confirmation: `Hi ${patientName}! Your appointment for ${service} on ${appointmentDate} is confirmed. See you!`,
      followup: `Hi ${patientName}! Thank you for visiting. If you have concerns, please contact us.`,
      custom: ""
    };
  };

  const handleTemplateChange = (templateKey) => {
    setSmsTemplate(templateKey);
    const templates = getSmsTemplates(smsTargetNotif);
    setSmsMessage(templates[templateKey] || "");
  };

  const handlePatientSelect = (phone) => {
    setSelectedPatient(phone);
    setSmsPhone(phone);
    
    const patient = patients.find(p => p.phone === phone);
    if (patient && (!smsTargetNotif || !smsTargetNotif.patientName)) {
      setSmsTargetNotif({
        ...smsTargetNotif,
        patientName: patient.name,
        phoneNumber: patient.phone,
        patientEmail: patient.email
      });
    }
  };

  const handleSendSms = async ({ phoneNumber, message }) => {
    if (!phoneNumber || !message) {
      toast.error("Phone number and message are required!");
      return;
    }
    setSmsSending(true);
    try {
      const response = await fetch('http://localhost:3001/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: phoneNumber,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SMS API Error:", errorText);
        toast.error(`Failed to send SMS: ${response.status}`);
        return;
      }

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textResponse = await response.text();
        try {
          data = JSON.parse(textResponse);
        } catch {
          data = { success: true };
        }
      }

      if (data.success) {
        toast.success("SMS sent successfully");
        setSmsModalOpen(false);
        setSmsPhone("");
        setSmsMessage("");
        setSmsTemplate("custom");
        setSelectedPatient("");
      } else {
        toast.error("Failed to send SMS: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("SMS Error:", error);
      toast.error("Error sending SMS: " + error.message);
    } finally {
      setSmsSending(false);
    }
  };

  // Filter by status and search
  const filteredNotifications = notifications.filter((notif) => {
    const isRead = readNotifications.has(notif.id);
    
    // Status filter
    if (statusFilter === "Unread" && isRead) return false;
    if (statusFilter === "Read" && !isRead) return false;
    if (statusFilter === "Appointments" && !notif.type.includes("appointment")) return false;
    if (statusFilter === "Payments" && !notif.type.includes("payment")) return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        notif.title?.toLowerCase().includes(query) ||
        notif.message?.toLowerCase().includes(query) ||
        notif.patientName?.toLowerCase().includes(query) ||
        notif.patientEmail?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Count by status
  const allCount = notifications.length;
  const unreadCount = notifications.filter((n) => !readNotifications.has(n.id)).length;
  const readCount = allCount - unreadCount;
  const appointmentCount = notifications.filter((n) => n.type.includes("appointment")).length;
  const paymentCount = notifications.filter((n) => n.type.includes("payment")).length;

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
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const getStatusBadge = (type) => {
    if (type.includes("cancelled")) {
      return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Cancelled</span>;
    }
    if (type.includes("confirmed")) {
      return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Confirmed</span>;
    }
    if (type.includes("payment")) {
      return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">Payment</span>;
    }
    return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">Pending</span>;
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
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="max-w-[1400px] mx-auto space-y-4">
      
        {/* Status Summary Cards */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="grid grid-cols-5 gap-3">
            <button 
              onClick={() => setStatusFilter('All')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'All' 
                  ? 'border-gray-500 bg-gray-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="text-2xl font-bold text-gray-700">{allCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">ALL</div>
            </button>
            
            <button 
              onClick={() => setStatusFilter('Unread')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'Unread' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-blue-300 hover:bg-blue-50'
              }`}
            >
              <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">UNREAD</div>
            </button>
            
            <button 
              onClick={() => setStatusFilter('Read')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'Read' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-green-300 hover:bg-green-50'
              }`}
            >
              <div className="text-2xl font-bold text-green-600">{readCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">READ</div>
            </button>

            <button 
              onClick={() => setStatusFilter('Appointments')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'Appointments' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-purple-300 hover:bg-purple-50'
              }`}
            >
              <div className="text-2xl font-bold text-purple-600">{appointmentCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">APPOINTMENTS</div>
            </button>

            <button 
              onClick={() => setStatusFilter('Payments')}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === 'Payments' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-orange-300 hover:bg-orange-50'
              }`}
            >
              <div className="text-2xl font-bold text-orange-600">{paymentCount}</div>
              <div className="text-xs text-gray-600 font-semibold mt-1">PAYMENTS</div>
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
                  <Check size={14} />
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
                    Patient
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Message
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
                    <td colSpan="4" className="text-center py-8 text-gray-500">
                      {statusFilter !== "All" 
                        ? `No ${statusFilter.toLowerCase()} notifications found` 
                        : "No notifications found"}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((notif, idx) => {
                    const isRead = readNotifications.has(notif.id);
                    return (
                      <tr
                        key={notif.id}
                        onClick={() => {
                          setSelectedNotif(notif);
                          setShowDetailsModal(true);
                          if (!isRead) handleMarkAsRead(notif.id);
                        }}
                        className={`border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors ${
                          !isRead ? 'bg-blue-50 font-medium' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        }`}
                        title="Click to view details"
                      >
                        <td className="px-3 py-2 border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <User size={14} className="text-gray-400" />
                            <span className="font-medium text-gray-800">{notif.patientName}</span>
                            {!isRead && (
                              <span className="ml-auto px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                                NEW
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                          <div className="font-medium">{notif.title}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-md">
                            {notif.message}
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredNotifications.length)} of {filteredNotifications.length} entries
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
                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-2 py-1 text-xs border rounded ${
                        currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
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
                <h2 className="text-xl font-bold text-gray-800">{selectedNotif.title}</h2>
                <p className="text-xs text-gray-500 mt-1">{getTimeAgo(selectedNotif.timestamp)}</p>
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
              <div className="mb-4">
                {getStatusBadge(selectedNotif.type)}
              </div>

              {/* Patient Information */}
              <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3">Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500">Name</div>
                      <div className="font-semibold text-gray-800 text-sm">{selectedNotif.patientName}</div>
                    </div>
                  </div>
                  
                  {selectedNotif.patientEmail && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="font-semibold text-gray-800 text-sm break-all">{selectedNotif.patientEmail}</div>
                      </div>
                    </div>
                  )}
                  
                  {selectedNotif.phoneNumber ? (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500">Phone</div>
                        <div className="font-semibold text-gray-800 text-sm">{selectedNotif.phoneNumber}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-500">Phone</div>
                        <div className="font-semibold text-amber-600 text-xs">Not provided</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-xs text-gray-500">Received</div>
                      <div className="font-semibold text-gray-800 text-sm">{getFullDateTime(selectedNotif.timestamp)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appointment/Payment Details */}
              <div className="bg-gray-50 border border-gray-300 rounded p-4 mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  {selectedNotif.type.includes('payment') ? (
                    <>
                      <DollarSign className="w-4 h-4 text-green-600" />
                      Payment Details
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Appointment Details
                    </>
                  )}
                </h3>
                <div className="space-y-2 text-sm">
                  {selectedNotif.appointmentDate && selectedNotif.appointmentDate !== "N/A" && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-semibold text-gray-800">{selectedNotif.appointmentDate}</span>
                    </div>
                  )}
                  
                  {selectedNotif.appointmentTime && selectedNotif.appointmentTime !== "N/A" && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-semibold text-gray-800">{selectedNotif.appointmentTime}</span>
                    </div>
                  )}
                  
                  {selectedNotif.service && selectedNotif.service !== "N/A" && (
                    <div className="flex justify-between items-center py-1 border-b border-gray-200">
                      <span className="text-gray-600">Service:</span>
                      <span className="font-semibold text-gray-800">{selectedNotif.service}</span>
                    </div>
                  )}
                  
                  {selectedNotif.price && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-semibold text-gray-800">₱{selectedNotif.price.toLocaleString()}</span>
                    </div>
                  )}

                  {selectedNotif.status && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-semibold text-gray-800 capitalize">{selectedNotif.status}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Message */}
              <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-600" />
                  Message
                </h3>
                <p className="text-sm text-gray-800 leading-relaxed">{selectedNotif.message}</p>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-300">
                {["staff", "admin", "dentist"].includes(effectiveRole) && selectedNotif.phoneNumber && (
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      setSmsModalOpen(true);
                      setSmsTargetNotif(selectedNotif);
                      setSmsPhone(selectedNotif.phoneNumber);
                      setSmsMessage("");
                      setSmsTemplate("custom");
                      setSelectedPatient(selectedNotif.phoneNumber);
                    }}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    <Bell size={16} />
                    Send SMS
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this notification?")) {
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
                  className={`px-4 py-2.5 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors font-medium text-sm ${
                    ["staff", "admin", "dentist"].includes(effectiveRole) && selectedNotif.phoneNumber 
                      ? 'col-span-2' 
                      : 'col-span-1'
                  }`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-blue-600 p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Send SMS</h3>
                    <p className="text-blue-100 text-sm">Notify patient via text message</p>
                  </div>
                </div>
                <button
                  onClick={() => setSmsModalOpen(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all"
                  disabled={smsSending}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Patient Info */}
              {smsTargetNotif && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Patient</div>
                  <div className="text-sm font-medium text-gray-900">{smsTargetNotif.patientName}</div>
                </div>
              )}

              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Patient
                </label>
                <select
                  value={selectedPatient}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={smsSending}
                >
                  <option value="">-- Select a patient --</option>
                  {patients.map((patient) => (
                    <option key={patient.phone} value={patient.phone}>
                      {patient.name} - {patient.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message Template
                </label>
                <select
                  value={smsTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={smsSending}
                >
                  <option value="reminder">🔔 Appointment Reminder</option>
                  <option value="confirmation">✅ Appointment Confirmation</option>
                  <option value="followup">💬 Follow-up Message</option>
                  <option value="custom">✏️ Custom Message</option>
                </select>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+639XXXXXXXXX"
                  value={smsPhone}
                  onChange={(e) => {
                    setSmsPhone(e.target.value);
                    if (e.target.value !== selectedPatient) {
                      setSelectedPatient("");
                    }
                  }}
                  disabled={smsSending}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Include country code (e.g., +639XXXXXXXXX)
                </p>
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                  <span>Message</span>
                  <span className={`text-xs ${smsMessage.length > 180 ? 'text-red-600' : 'text-gray-500'}`}>
                    {smsMessage.length} / 180 characters
                  </span>
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={5}
                  placeholder="Type your message here..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  disabled={smsSending}
                />
                {smsMessage.length > 180 && (
                  <p className="text-xs text-red-600 mt-1">
                    ⚠️ Message exceeds 180 characters
                  </p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex gap-3 justify-end border-t">
              <button
                onClick={() => setSmsModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-medium text-sm"
                disabled={smsSending}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSendSms({ phoneNumber: smsPhone, message: smsMessage });
                }}
                disabled={!smsPhone || !smsMessage || smsSending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {smsSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Send SMS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
