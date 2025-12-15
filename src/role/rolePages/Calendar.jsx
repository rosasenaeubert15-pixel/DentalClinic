import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight,Plus,X,Heart,ArrowRight,Calendar as CalendarIcon,Clock,User,Phone,Mail,FileText,DollarSign,CheckCircle,XCircle,AlertCircle,Pencil,Trash2,RefreshCw} from 'lucide-react';
import { collection, query, onSnapshot, orderBy,getDocs,addDoc,updateDoc,deleteDoc,doc,serverTimestamp,getDoc} from 'firebase/firestore';
import { db, auth } from '../../../firebase.config';
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


// ============ SMS SENDING FUNCTION ============
const sendStatusSMS = async (phoneNumber, patientName, status, appointmentData) => {
  try {
    if (!phoneNumber) {
      toast.warning("No phone number found — SMS not sent.");
      return { success: false, reason: "No phone number" };
    }

    let message = "";
    const date = appointmentData.date || "";
    const time = appointmentData.time || "";
    const treatment = appointmentData.treatment || "your appointment";

    if (status === "confirmed") {
      message = `Hi ${patientName}! Your appointment for ${treatment} on ${date} at ${time} has been CONFIRMED. Thank you for choosing our clinic! - Dental Clinic`;
    } else if (status === "cancelled") {
      message = `Hi ${patientName}! Your appointment for ${treatment} scheduled on ${date} has been CANCELLED. Please contact us to reschedule. - Dental Clinic`;
    } else if (status === "reschedule") {
      message = `Hi ${patientName}! Your appointment has been RESCHEDULED to ${date} at ${time} for ${treatment}. Please confirm your attendance. Thank you! - Dental Clinic`;
    } else if (status === "treated") {
      message = `Hi ${patientName}! Thank you for completing your ${treatment} appointment on ${date}. We hope you're satisfied with our service. See you soon! - Dental Clinic`;
    }

    if (!message) {
      toast.error("SMS not sent — Unknown status.");
      return { success: false, reason: "Unknown status" };
    }

    const response = await fetch("http://localhost:3001/api/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: phoneNumber,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SMS API Error:", errorText);
      toast.error("Failed to send SMS.");
      return { success: false, error: errorText };
    }

    const data = await response.json();
    toast.success("SMS sent successfully!");
    return { success: true, data };

  } catch (error) {
    console.error("Error sending status SMS:", error);
    toast.error("Error sending SMS.");
    return { success: false, error: error.message };
  }
};


const TIME_SLOTS = [
  "10:00 - 10:30", "10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00",
  "12:00 - 12:30", "12:30 - 13:00", "13:00 - 13:30", "13:30 - 14:00",
  "14:00 - 14:30", "14:30 - 15:00", "15:00 - 15:30", "15:30 - 16:00",
  "16:00 - 16:30", "16:30 - 17:00"
];

const colorOptions = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
  { name: "Teal", value: "#14b8a6" }
];

const healthQuestionsList = [
  { id: "q1", text: "Do you have a fever or temperature over 38°C?" },
  { id: "q2", text: "Have you experienced shortness of breath?" },
  { id: "q3", text: "Do you have a dry cough?" },
  { id: "q4", text: "Do you have runny nose?" },
  { id: "q5", text: "Have you recently lost or had a reduction in your sense of smell?" },
  { id: "q6", text: "Do you have sore throat?" },
  { id: "q7", text: "Do you have diarrhea?" },
  { id: "q8", text: "Do you have influenza-like symptoms?" },
  { id: "q9", text: "Do you have history of COVID-19 infection?" },
  { id: "q10", text: "Have you been in contact with someone who tested positive for COVID-19?" }
];

const treatments = [
  {
    category: "Cleaning (LINIS)",
    options: [
      { type: "Mild to Average Deposit (Tartar)", price: 650, time: 30 },
      { type: "Moderate to Heavy Deposit", price: 900, time: 60 }
    ]
  },
  {
    category: "Filling (PASTA)",
    options: [
      { type: "Temporary", price: 400, time: 30 },
      { type: "Permanent", price: 1150, time: 60 }
    ]
  },
  {
    category: "Tooth Extraction (BUNOT)",
    options: [
      { type: "Regular", price: 600, time: 30 },
      { type: "Complicated", price: 1000, time: 60 }
    ]
  }
];

export default function AdminCalendar({ onAppointmentViewed }) {
    // --- Patient search dropdown state for Add Walk-in Modal ---
    const [patientSearch, setPatientSearch] = useState('');
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [selectedPatientName, setSelectedPatientName] = useState('');
    const patientDropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (e) => {
        if (patientDropdownRef.current && !patientDropdownRef.current.contains(e.target)) {
          setShowPatientDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [appointments, setAppointments] = useState([]);
  const [onlineRequests, setOnlineRequests] = useState([]);
  const [users, setUsers] = useState({});
  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [walkInType, setWalkInType] = useState('walkin');
  
  // Modals
  const [showAddWalkInModal, setShowAddWalkInModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [availableSlots, setAvailableSlots] = useState(TIME_SLOTS);
  const [statusFilter, setStatusFilter] = useState('All');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentServingId, setCurrentServingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [viewedAppointments, setViewedAppointments] = useState(new Set());
  const [showQueueList, setShowQueueList] = useState(false);
  
  const [filtered, setFiltered] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [search, setSearch] = useState("");
  
  const onlineLoadedRef = useRef(false);
  const apptsLoadedRef = useRef(false);
  const mountedRef = useRef(true);

  // Form states
  const [form, setForm] = useState({
    patientId: '',
    patientEmail: '',
    patientPhone: '',
    providerId: '',
    appointmentDate: '',
    slot: '',
    healthDeclaration: '',
    status: 'confirmed',
    color: '#3b82f6'
  });

  const [editForm, setEditForm] = useState({});

  const [healthAnswers, setHealthAnswers] = useState(
    healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: '' }), {})
  );

  // Helper functions
  function displayDate(tsOrIso) {
    if (!tsOrIso) return "N/A";
    try {
      if (typeof tsOrIso === "object" && typeof tsOrIso.toDate === "function") {
        return tsOrIso.toDate().toLocaleDateString();
      }
      if (typeof tsOrIso === "object" && typeof tsOrIso.toMillis === "function") {
        return new Date(tsOrIso.toMillis()).toLocaleDateString();
      }
      return new Date(tsOrIso).toLocaleDateString();
    } catch {
      return String(tsOrIso);
    }
  }

  function getPatientDisplay(a) {
    if (!a) return "Unknown";
    if (a.userId && users && users[a.userId]) {
      const p = users[a.userId];
      return `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
    }
    return a.patientName || a.patient || "Walk-in Patient";
  }

  const normalizeDateString = (raw) => {
    if (!raw && raw !== 0) return '';
    try {
      if (typeof raw === 'object' && typeof raw.toDate === 'function') {
        const d = raw.toDate();
        return d.toISOString().split('T')[0];
      }
      if (typeof raw === 'object' && typeof raw.toMillis === 'function') {
        const d = new Date(raw.toMillis());
        return d.toISOString().split('T')[0];
      }
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
      }
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    return String(raw);
  };

  // Load users
  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const dataMap = {};
        const dataArr = [];
        snap.forEach((d) => {
          const userData = d.data();
          dataMap[d.id] = userData;
          // Only include users with role 'patient' in patients array
          if (userData.role === 'patient') {
            dataArr.push({ id: d.id, ...userData });
          }
        });
        setUsers(dataMap);
        setPatients(dataArr);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    }
    loadUsers();
  }, []);

  // Load dentists
  useEffect(() => {
    async function loadDentists() {
      try {
        const snap = await getDocs(collection(db, 'dentists'));
        const data = {};
        const arr = [];
        snap.forEach((d) => {
          data[d.id] = d.data();
          arr.push({ id: d.id, ...d.data() });
        });
        setDentists(data);
      } catch (error) {
        console.error('Error loading dentists:', error);
      }
    }
    loadDentists();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    // Load viewed appointments from localStorage
    const saved = localStorage.getItem('viewedAppointments');
    if (saved) {
      try {
        setViewedAppointments(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Failed to load viewed appointments:', e);
      }
    }
    
    return () => { mountedRef.current = false; };
  }, []);

  // Filter logic
  useEffect(() => {
    const source = walkInType === 'online' ? onlineRequests : appointments;
    setLoadingAppointments(false);

    const s = (search || "").trim().toLowerCase();
    const result = source.filter((a) => {
      if (statusFilter !== "All") {
        if ((a.status || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (!s) return true;

      const needle = s;
      const fields = [
        a.patientName || a.patient || "",
        a.treatment || "",
        a.preferredDentist || a.providerId || "",
        a.status || "",
        a.date || "",
        a.patientEmail || a.email || "",
        a.patientPhone || a.phone || ""
      ];

      return fields.some((f) => (f || "").toString().toLowerCase().includes(needle));
    });

    if (mountedRef.current) {
      setFiltered(result);
      setCurrentPage(1); // Reset to page 1 when filter changes
    }
  }, [appointments, onlineRequests, statusFilter, search, walkInType]);

  // Subscribe to online requests
  useEffect(() => {
    const q = query(collection(db, 'onlineRequests'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const raw = doc.data();
        const dateNormalized = normalizeDateString(raw.date || raw.appointmentDate || raw.appDate);
        const timeField = raw.time || raw.slot || raw.startTime || '';
        const docId = `online_${doc.id}`;
        
        // Mark as viewed when loaded
        if (typeof onAppointmentViewed === 'function') {
          onAppointmentViewed(docId);
        }
        
        return { id: doc.id, ...raw, date: dateNormalized, time: timeField };
      });
      setOnlineRequests(data);
      onlineLoadedRef.current = true;
      setLoading(!(onlineLoadedRef.current && apptsLoadedRef.current));
    }, (error) => {
      console.error('Error fetching online requests:', error);
      onlineLoadedRef.current = true;
      setLoading(!(onlineLoadedRef.current && apptsLoadedRef.current));
    });

    return () => unsubscribe();
  }, [onAppointmentViewed]);

  // Subscribe to walk-in appointments
  useEffect(() => {
    const q = query(collection(db, 'appointments'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const raw = doc.data();
        const dateNormalized = normalizeDateString(raw.date || raw.appointmentDate || raw.appDate);
        const timeField = raw.time || raw.slot || raw.startTime || '';
        const docId = `apt_${doc.id}`;
        
        // Mark as viewed when loaded
        if (typeof onAppointmentViewed === 'function') {
          onAppointmentViewed(docId);
        }
        
        return { id: doc.id, ...raw, date: dateNormalized, time: timeField };
      });
      setAppointments(data);
      apptsLoadedRef.current = true;
      setLoading(!(onlineLoadedRef.current && apptsLoadedRef.current));
    }, (error) => {
      console.error('Error fetching appointments:', error);
      apptsLoadedRef.current = true;
      setLoading(!(onlineLoadedRef.current && apptsLoadedRef.current));
    });

    return () => unsubscribe();
  }, [onAppointmentViewed]);

  const combinedAppointments = [...onlineRequests, ...appointments];
  const confirmedAppointments = combinedAppointments.filter(a => (a.status || '').toString().toLowerCase() === 'confirmed');

  const countByStatus = (status) => {
    return combinedAppointments.filter(a => (a.status || '').toLowerCase() === status.toLowerCase()).length;
  };

  const allCount = combinedAppointments.length;
  const pendingCount = countByStatus('pending');
  const confirmedCount = countByStatus('confirmed');
  const treatedCount = countByStatus('treated');
  const cancelledCount = countByStatus('cancelled');
  const rescheduleCount = countByStatus('reschedule');

  const getPatientName = (appointment) => {
    if (!appointment) return 'Unknown Patient';
    if (appointment.userId && users[appointment.userId]) {
      const user = users[appointment.userId];
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown';
    }
    if (appointment.patientName) return appointment.patientName;
    return 'Unknown Patient';
  };

  const getPatientEmail = (appointment) => {
    if (!appointment) return 'N/A';
    if (appointment.userId && users[appointment.userId]) {
      return users[appointment.userId].email || 'N/A';
    }
    return appointment.patientEmail || appointment.email || 'N/A';
  };

  const getPatientPhone = (appointment) => {
    if (!appointment) return 'N/A';
    if (appointment.userId && users[appointment.userId]) {
      return users[appointment.userId].contactNumber || users[appointment.userId].phoneNumber || 'N/A';
    }
    return appointment.patientPhone || appointment.phone || 'N/A';
  };

  const getDentistName = (appointment) => {
    if (!appointment) return 'Not Assigned';
    const dentistId = appointment.providerId || appointment.preferredDentist;
    if (dentistId && dentists[dentistId]) {
      return dentists[dentistId].fullName || dentists[dentistId].name || dentistId;
    }
    return appointment.preferredDentist || 'Not Assigned';
  };

  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const formatWeekRange = (date) => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const getAppointmentsForDate = (dateString) => {
    return confirmedAppointments
      .filter(apt => {
        const aptDate = normalizeDateString(apt.date || apt.appointmentDate || apt.appDate);
        return aptDate === dateString;
      })
      .sort((a, b) => {
        const timeA = (a.time || '').split('-')[0]?.trim() || '';
        const timeB = (b.time || '').split('-')[0]?.trim() || '';
        return timeA.localeCompare(timeB);
      });
  };

  const changeMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const changeWeek = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction * 7));
      return newDate;
    });
  };

  const changeDay = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
      case 'treated': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'reschedule': return 'bg-purple-100 text-purple-800 border-purple-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      case 'treated': return <CheckCircle className="w-4 h-4" />;
      case 'reschedule': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getUpcomingAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return confirmedAppointments.filter(apt => {
      if (!apt.date) return false;
      const apptDate = new Date(apt.date);
      return apptDate >= today;
    }).sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      const timeA = (a.time || '').split('-')[0]?.trim() || '';
      const timeB = (b.time || '').split('-')[0]?.trim() || '';
      return timeA.localeCompare(timeB);
    });
  };

  // Create notification function (from OnlineRequest.jsx)
  async function createNotification(userId, appointmentId, status, appointmentData) {
    let notificationTitle = "";
    let notificationMessage = "";
    let notificationType = "";
    
    if (status === "confirmed") {
      notificationType = "appointment_confirmed";
      notificationTitle = "Appointment Confirmed";
      notificationMessage = `Your appointment for ${appointmentData.treatment} on ${appointmentData.date} at ${appointmentData.time} has been confirmed.`;
    } else if (status === "cancelled") {
      notificationType = "appointment_cancelled";
      notificationTitle = "Appointment Cancelled";
      notificationMessage = `Your appointment for ${appointmentData.treatment} scheduled on ${appointmentData.date} has been cancelled.`;
    } else if (status === "reschedule") {
      notificationType = "appointment_reschedule";
      notificationTitle = "Appointment Rescheduled";
      notificationMessage = `Your appointment has been rescheduled to ${appointmentData.date} at ${appointmentData.time} for ${appointmentData.treatment}.`;
    }
    
    if (notificationType) {
      try {
        await addDoc(collection(db, "notifications"), {
          userId: userId,
          appointmentId: appointmentId,
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          read: false,
          timestamp: serverTimestamp(),
          details: {
            appointmentDate: appointmentData.date,
            time: appointmentData.time,
            treatment: appointmentData.treatment,
            dentist: appointmentData.dentist,
          },
        });
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    }
  }

  // Open edit modal
  function openEditModal(appt) {
    const isOnline = walkInType === 'online';
    setSelectedAppointment(appt);
    setEditForm({
      treatment: appt.treatment || "",
      treatmentOption: appt.treatmentOption || "",
      appointmentDate: appt.date || "",
      slot: appt.time || "",
      price: appt.price || 0,
      healthDeclaration: appt.healthDeclaration || "",
      preferredDentist: appt.preferredDentist || appt.providerId || "",
      status: appt.status || "pending",
      previousStatus: appt.status || "pending",
      color: appt.color || "#3b82f6",
    });
    setShowEditModal(true);
  }

  // Handle edit save
  async function handleEditSave(e) {
    e.preventDefault();
    if (!selectedAppointment) return;
    setSubmitting(true);
    
    try {
      const isOnline = walkInType === 'online';
      const collectionName = isOnline ? 'onlineRequests' : 'appointments';
      const apptRef = doc(db, collectionName, selectedAppointment.id);
      
      // Get current appointment data to find userId
      const appointmentDoc = await getDoc(apptRef);
      const appointmentData = appointmentDoc.data();
      
      await updateDoc(apptRef, {
        treatment: editForm.treatment,
        treatmentOption: editForm.treatmentOption,
        date: editForm.appointmentDate,
        time: editForm.slot,
        price: Number(editForm.price || 0),
        healthDeclaration: editForm.healthDeclaration,
        status: editForm.status,
        preferredDentist: editForm.preferredDentist,
        providerId: editForm.preferredDentist,
        color: editForm.color,
        updatedAt: serverTimestamp(),
        adminUpdatedBy: auth?.currentUser?.uid || null,
        adminUpdatedAt: serverTimestamp(),
      });

      // Create notification and send SMS if status changed
      if (editForm.status !== editForm.previousStatus && 
          (editForm.status === "confirmed" || editForm.status === "cancelled" || editForm.status === "reschedule" || editForm.status === "treated")) {
        await createNotification(
          appointmentData.userId,
          selectedAppointment.id,
          editForm.status,
          {
            treatment: editForm.treatment,
            date: editForm.appointmentDate,
            time: editForm.slot,
            dentist: editForm.preferredDentist,
          }
        );

        // ============ SEND SMS NOTIFICATION ============
        const usersSnap = await getDocs(collection(db, "users"));
        let patientInfo = {};
        usersSnap.forEach(doc => {
          if (doc.id === appointmentData.userId) {
            patientInfo = doc.data();
          }
        });

        const patientName = `${patientInfo.firstName || ""} ${patientInfo.lastName || ""}`.trim() || "Patient";
        const phoneNumber = patientInfo.contactNumber || patientInfo.phoneNumber || patientInfo.phone;

        if (phoneNumber) {
          const smsResult = await sendStatusSMS(
            phoneNumber,
            patientName,
            editForm.status,
            {
              treatment: editForm.treatment,
              date: editForm.appointmentDate,
              time: editForm.slot,
            }
          );

          if (smsResult.success) {
            console.log("📱 Status SMS sent successfully");
          } else {
            console.log("SMS sending failed:", smsResult.reason || smsResult.error);
          }
        }
      }

      alert("Appointment updated successfully!");
      setShowEditModal(false);
      setSelectedAppointment(null);
    } catch (err) {
      console.error("handleEditSave error:", err);
      if (err.code === "not-found") {
        alert("Appointment not found. It may have been deleted.");
        setShowEditModal(false);
        setSelectedAppointment(null);
      } else {
        alert("Failed to update appointment. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Handle cancel appointment
  async function handleCancelAppointment(id) {
    if (!id) return;
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    
    try {
      const isOnline = walkInType === 'online';
      const collectionName = isOnline ? 'onlineRequests' : 'appointments';
      const apptRef = doc(db, collectionName, id);
      
      // Get appointment data for notification
      const appointmentDoc = await getDoc(apptRef);
      const appointmentData = appointmentDoc.data();
      
      await updateDoc(apptRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: auth?.currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      });

      // Create notification and send SMS
      if (appointmentData.userId) {
        await createNotification(
          appointmentData.userId,
          id,
          "cancelled",
          {
            treatment: appointmentData.treatment,
            date: appointmentData.date,
            time: appointmentData.time,
            dentist: appointmentData.preferredDentist || appointmentData.providerId,
          }
        );

        // ============ SEND CANCELLATION SMS ============
        const usersSnap = await getDocs(collection(db, "users"));
        let patientInfo = {};
        usersSnap.forEach(doc => {
          if (doc.id === appointmentData.userId) {
            patientInfo = doc.data();
          }
        });

        const patientName = `${patientInfo.firstName || ""} ${patientInfo.lastName || ""}`.trim() || "Patient";
        const phoneNumber = patientInfo.contactNumber || patientInfo.phoneNumber || patientInfo.phone;

        if (phoneNumber) {
          const smsResult = await sendStatusSMS(
            phoneNumber,
            patientName,
            "cancelled",
            {
              treatment: appointmentData.treatment,
              date: appointmentData.date,
              time: appointmentData.time,
            }
          );

          if (smsResult.success) {
            console.log("📱 Cancellation SMS sent successfully");
          } else {
            console.log("SMS sending failed:", smsResult.reason || smsResult.error);
          }
        }
      }

      alert("Appointment cancelled successfully!");
    } catch (e) {
      console.error("handleCancelAppointment error:", e);
      alert("Failed to cancel appointment");
    }
  }

  // Handle delete appointment
  async function handleDeleteAppointment(id) {
    if (!id) return;
    if (!window.confirm("Delete appointment permanently? This cannot be undone.")) return;
    
    try {
      setDeletingId(id);
      const isOnline = walkInType === 'online';
      const collectionName = isOnline ? 'onlineRequests' : 'appointments';
      await deleteDoc(doc(db, collectionName, id));
      alert("Appointment deleted successfully!");
    } catch (e) {
      console.error("handleDeleteAppointment error:", e);
      alert("Failed to delete appointment");
    } finally {
      setDeletingId(null);
    }
  }

  // Handle row click - mark as viewed and show details
  const handleRowClick = (apt) => {
    setSelectedAppointment(apt);
    setShowDetailsModal(true);
    
    // Mark as viewed
    const newViewed = new Set(viewedAppointments);
    newViewed.add(apt.id);
    setViewedAppointments(newViewed);
    
    // Save to localStorage
    try {
      localStorage.setItem('viewedAppointments', JSON.stringify([...newViewed]));
    } catch (e) {
      console.error('Failed to save viewed appointments:', e);
    }
  };

  // Check if appointment is new (created in last 24 hours and not viewed)
  const isNewAppointment = (apt) => {
    if (viewedAppointments.has(apt.id)) return false;
    
    if (!apt.createdAt) return false;
    
    try {
      let createdDate;
      if (typeof apt.createdAt === 'object' && typeof apt.createdAt.toDate === 'function') {
        createdDate = apt.createdAt.toDate();
      } else if (typeof apt.createdAt === 'object' && typeof apt.createdAt.toMillis === 'function') {
        createdDate = new Date(apt.createdAt.toMillis());
      } else {
        createdDate = new Date(apt.createdAt);
      }
      
      const now = new Date();
      const hoursDiff = (now - createdDate) / (1000 * 60 * 60);
      
      return hoursDiff <= 24;
    } catch (e) {
      return false;
    }
  };

  // Open health declaration modal
  function openHealthModal(appt) {
    setSelectedAppointment(appt);
    setShowHealthModal(true);
  }
  function openAddModal() {
    setSelectedCategory(null);
    setSelectedOption(null);
    setForm({
      patientId: '',
      patientEmail: '',
      patientPhone: '',
      providerId: '',
      appointmentDate: '',
      slot: '',
      healthDeclaration: '',
      status: 'confirmed',
      color: '#3b82f6'
    });
    setHealthAnswers(healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: '' }), {}));
    setShowAddWalkInModal(true);
  }

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }

  function handlePatientSelect(id) {
    const p = patients.find((x) => x.id === id);
    if (p) {
      setForm((f) => ({
        ...f,
        patientId: p.id,
        patientEmail: p.email || "",
        patientPhone: p.contactNumber || p.phoneNumber || "",
      }));
    } else {
      setForm((f) => ({ ...f, patientId: "", patientEmail: "", patientPhone: "" }));
    }
  }

  async function handleProviderSelect(id) {
    setForm((f) => ({ ...f, providerId: id, slot: "" }));
    if (form.appointmentDate) {
      await computeAvailableSlots(form.appointmentDate, id);
    }
  }

  async function handleDateChange(d) {
    setForm((f) => ({ ...f, appointmentDate: d, slot: "" }));
    if (d && form.providerId) {
      await computeAvailableSlots(d, form.providerId);
    }
  }

  const computeAvailableSlots = async (dateStr, providerId) => {
    try {
      const walkInQ = query(collection(db, "appointments"), where("date", "==", dateStr), where("providerId", "==", providerId));
      const onlineQ = query(collection(db, "onlineRequests"), where("date", "==", dateStr));
      
      const [walkInSnap, onlineSnap] = await Promise.all([
        getDocs(walkInQ),
        getDocs(onlineQ)
      ]);

      const blocked = new Set();
      const allowedStatuses = new Set(["confirmed", "paid"]);

      walkInSnap.forEach((d) => {
        const ap = d.data();
        if (!allowedStatuses.has((ap.status || "").toString().toLowerCase())) return;
        const idx = TIME_SLOTS.indexOf(ap.time);
        const apSlots = Math.ceil((ap.duration || 30) / 30);
        if (idx < 0) return;
        for (let i = idx; i < idx + apSlots && i < TIME_SLOTS.length; i++) {
          blocked.add(TIME_SLOTS[i]);
        }
      });

      onlineSnap.forEach((d) => {
        const ap = d.data();
        if (!allowedStatuses.has((ap.status || "").toString().toLowerCase())) return;
        const idx = TIME_SLOTS.indexOf(ap.time);
        const apSlots = Math.ceil((ap.duration || 30) / 30);
        if (idx < 0) return;
        for (let i = idx; i < idx + apSlots && i < TIME_SLOTS.length; i++) {
          blocked.add(TIME_SLOTS[i]);
        }
      });

      if (selectedOption) {
        const slotsNeeded = Math.ceil((selectedOption.time || 30) / 30);
        const canUse = TIME_SLOTS.filter((_, idx) => {
          if (idx + slotsNeeded > TIME_SLOTS.length) return false;
          for (let i = 0; i < slotsNeeded; i++) {
            if (blocked.has(TIME_SLOTS[idx + i])) return false;
          }
          return true;
        });
        setAvailableSlots(canUse.length ? canUse : []);
      } else {
        setAvailableSlots(TIME_SLOTS.filter((s) => !blocked.has(s)));
      }
    } catch (e) {
      console.error("computeAvailableSlots error:", e);
      setAvailableSlots(TIME_SLOTS.slice());
    }
  };

  useEffect(() => {
    if (!form.appointmentDate || !form.providerId) {
      setAvailableSlots(TIME_SLOTS.slice());
      return;
    }
    computeAvailableSlots(form.appointmentDate, form.providerId);
  }, [form.appointmentDate, form.providerId, selectedOption]);

  // Helper: Determine status based on payment method
  function getStatusByPaymentMethod(paymentMethod) {
    // If paid via PayPal, auto-confirm
    if (paymentMethod === 'paypal') return 'confirmed';
    // If pay in clinic, default to pending or as selected
    if (paymentMethod === 'pay_in_clinic') return form.status || 'pending';
    // Default fallback
    return form.status || 'pending';
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!form.patientId) {
        alert("Please select a patient.");
        setSubmitting(false);
        return;
      }
      if (!selectedCategory || !selectedOption) {
        alert("Please select a service and option.");
        setSubmitting(false);
        return;
      }
      if (!form.providerId) {
        alert("Select a dentist.");
        setSubmitting(false);
        return;
      }
      if (!form.appointmentDate) {
        alert("Select an appointment date.");
        setSubmitting(false);
        return;
      }
      if (!form.slot) {
        alert("Select a time slot.");
        setSubmitting(false);
        return;
      }

      const unanswered = Object.values(healthAnswers).some((v) => v !== "yes" && v !== "no");
      if (unanswered) {
        alert("Please answer all health questions.");
        setSubmitting(false);
        return;
      }

      const patient = patients.find((p) => p.id === form.patientId);
      const patientName = patient ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() : "Walk-in Patient";

      // Assume paymentMethod is passed from patientAppointment.jsx or form
      // For walk-in, you may want to add a select for payment method in the form
      const paymentMethod = form.paymentMethod || 'pay_in_clinic'; // default for walk-in
      const status = getStatusByPaymentMethod(paymentMethod);

      const appointmentPayload = {
        userId: form.patientId,
        patientName,
        patientEmail: form.patientEmail,
        patientPhone: form.patientPhone,
        providerId: form.providerId,
        preferredDentist: form.providerId,
        date: form.appointmentDate,
        time: form.slot,
        duration: selectedOption.time,
        treatment: selectedCategory.category,
        treatmentOption: `${selectedCategory.category} - ${selectedOption.type}`,
        price: Number(selectedOption.price || 0),
        healthDeclaration: form.healthDeclaration,
        health: {
          questions: healthQuestionsList.map(({ id, text }) => ({ id, text })),
          answers: healthAnswers,
        },
        status,
        paymentMethod,
        color: form.color,
        createdAt: serverTimestamp(),
        createdBy: auth?.currentUser?.uid || null,
      };

      await addDoc(collection(db, "appointments"), appointmentPayload);

      alert("Walk-in appointment created successfully!");
      setShowAddWalkInModal(false);
    } catch (err) {
      console.error("createWalkInAppointment error:", err);
      alert("Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;
  const paginatedData = filtered.slice(startIndex, endIndex);

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

  // Render calendar views (simplified for space)
  const renderMonthView = () => {
    const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[120px] bg-gray-50 border border-gray-200"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = getAppointmentsForDate(dateString);
      const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

      days.push(
        <div 
          key={day}
          className={`min-h-[120px] border border-gray-200 p-2 hover:bg-gray-50 cursor-pointer transition-colors ${isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
          onClick={() => setSelectedDate(dateString)}
        >
          <div className={`text-sm font-semibold mb-2 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
            {day}
          </div>
          <div className="space-y-1">
            {dayAppointments.slice(0, 3).map(apt => (
              <div
                key={apt.id}
                className="text-xs p-1.5 rounded cursor-pointer hover:shadow-sm transition-shadow"
                style={{ 
                  backgroundColor: apt.color ? `${apt.color}20` : '#dbeafe',
                  borderLeft: `3px solid ${apt.color || '#3b82f6'}`
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAppointment(apt);
                  setShowDetailsModal(true);
                }}
              >
                <div className="font-medium truncate">
                  {(apt.time || '').split('-')[0]?.trim() || 'N/A'} {getPatientName(apt)}
                </div>
              </div>
            ))}
            {dayAppointments.length > 3 && (
              <div className="text-xs text-gray-500 font-medium pl-1">
                +{dayAppointments.length - 3} more
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 gap-0">
          {weekDays.map(day => (
            <div key={day} className="bg-gray-100 border-b border-r border-gray-200 p-3 text-center font-semibold text-gray-700 last:border-r-0">
              {day}
            </div>
          ))}
          {days}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-7 gap-0">
          {weekDays.map((dayName, index) => {
            const currentDay = new Date(startOfWeek);
            currentDay.setDate(startOfWeek.getDate() + index);
            const dateString = `${currentDay.getFullYear()}-${String(currentDay.getMonth() + 1).padStart(2, '0')}-${String(currentDay.getDate()).padStart(2, '0')}`;
            const dayAppointments = getAppointmentsForDate(dateString);
            const isToday = new Date().toDateString() === currentDay.toDateString();
            
            return (
              <div key={index} className={`border-r last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                <div className={`p-3 border-b font-semibold text-center ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                  <div className="text-xs">{dayName}</div>
                  <div className="text-lg">{currentDay.getDate()}</div>
                </div>
                <div className="p-2 space-y-2 min-h-[400px]">
                  {dayAppointments.map(apt => (
                    <div
                      key={apt.id}
                      className="p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow"
                      style={{ 
                        backgroundColor: apt.color ? `${apt.color}20` : '#dbeafe',
                        borderLeft: `4px solid ${apt.color || '#3b82f6'}`
                      }}
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setShowDetailsModal(true);
                      }}
                    >
                      <div className="font-bold">{(apt.time || '').split('-')[0]?.trim() || 'N/A'}</div>
                      <div className="font-medium mt-1">{getPatientName(apt)}</div>
                      <div className="text-gray-600 mt-1">{apt.treatment || 'No treatment'}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const dayAppointments = getAppointmentsForDate(dateString);
    
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-800">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
        </div>
        
        {dayAppointments.length === 0 ? (
          <div className="text-center py-16">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg text-gray-500">No appointments for this day</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dayAppointments.map(apt => (
              <div
                key={apt.id}
                className="p-4 rounded-lg cursor-pointer hover:shadow-lg transition-shadow"
                style={{ 
                  backgroundColor: apt.color ? `${apt.color}15` : '#dbeafe',
                  borderLeft: `6px solid ${apt.color || '#3b82f6'}`
                }}
                onClick={() => {
                  setSelectedAppointment(apt);
                  setShowDetailsModal(true);
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Clock className="w-5 h-5 text-gray-500" />
                      <span className="text-lg font-bold text-gray-800">{apt.time || 'N/A'}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{getPatientName(apt)}</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        {getDentistName(apt)}
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {apt.treatment || 'No treatment'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderListView = () => {
    const upcomingAppointments = getUpcomingAppointments();

    return (
      <div className="space-y-3">
        {upcomingAppointments.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border">
            <CalendarIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg text-gray-500">No upcoming appointments</p>
          </div>
        ) : (
          upcomingAppointments.map(apt => (
            <div
              key={apt.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedAppointment(apt);
                setShowDetailsModal(true);
              }}
            >
              <div className="flex items-start gap-4">
                <div className="w-2 h-full rounded-full" style={{ backgroundColor: apt.color || '#3b82f6' }} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded border flex items-center gap-1 ${getStatusColor(apt.status)}`}>
                      {getStatusIcon(apt.status)}
                      {apt.status?.charAt(0).toUpperCase() + apt.status?.slice(1) || 'Unknown'}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{getPatientName(apt)}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      {new Date(apt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {apt.time || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      {getDentistName(apt)}
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      {apt.treatment || 'No treatment specified'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // Queue Management - Updated logic
  const today = new Date().toISOString().split('T')[0];
  
  // Get today's confirmed appointments sorted by time
  const todayConfirmedAppointments = confirmedAppointments
    .filter(apt => apt.date === today)
    .sort((a, b) => {
      const timeA = (a.time || '').split('-')[0]?.trim() || '';
      const timeB = (b.time || '').split('-')[0]?.trim() || '';
      return timeA.localeCompare(timeB);
    });

  // Get current time in HH:MM format
  const getCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const currentTime = getCurrentTime();

  // Filter appointments: only show those whose time hasn't passed yet and not currently serving
  const upcomingQueue = todayConfirmedAppointments.filter(apt => {
    if (apt.id === currentServingId) return false;
    
    const appointmentTime = (apt.time || '').split('-')[0]?.trim() || '';
    if (!appointmentTime) return false;
    
    // Compare appointment time with current time
    return appointmentTime >= currentTime;
  });

  const nextPatient = upcomingQueue[0] || null;
  const currentPatient = todayConfirmedAppointments.find(apt => apt.id === currentServingId) || null;
  const queueCount = upcomingQueue.length;

  const handleMoveToCurrentServing = () => {
    if (nextPatient) {
      setCurrentServingId(nextPatient.id);
      
    }
  };

  const handleFinishServing = () => {
    if (currentPatient && window.confirm(`Mark ${getPatientName(currentPatient)} as treated?`)) {
      // Update status to treated
      const isOnline = onlineRequests.some(req => req.id === currentPatient.id);
      const collectionName = isOnline ? 'onlineRequests' : 'appointments';
      
      updateDoc(doc(db, collectionName, currentPatient.id), {
        status: 'treated',
        treatedAt: serverTimestamp(),
        treatedBy: auth?.currentUser?.uid || null,
      }).then(() => {
        (async () => {
          setCurrentServingId(null);
          try {
            // Fetch appointment data for notification/SMS
            const apptRef = doc(db, collectionName, currentPatient.id);
            const apptSnap = await getDoc(apptRef);
            const apptData = apptSnap?.data ? apptSnap.data() : apptSnap || {};

            if (apptData?.userId) {
              // Create notification
              try {
                await createNotification(apptData.userId, currentPatient.id, 'treated', {
                  treatment: apptData.treatment,
                  date: apptData.date,
                  time: apptData.time,
                  dentist: apptData.preferredDentist || apptData.providerId,
                });
              } catch (nErr) {
                console.warn('Failed to create treated notification', nErr);
              }

              // Attempt to send SMS using loaded users map or fallback to appointment phone
              try {
                const patientInfo = users[apptData.userId] || {};
                const patientName = `${patientInfo.firstName || ''} ${patientInfo.lastName || ''}`.trim() || getPatientName(apptData);
                const phoneNumber = patientInfo.contactNumber || patientInfo.phoneNumber || patientInfo.phone || apptData.patientPhone || apptData.phone || null;

                if (phoneNumber) {
                  const message = `Hi ${patientName}! Thank you for completing your ${apptData.treatment || ''} appointment on ${apptData.date || ''}. We hope you're satisfied with our service.`;
                  const resp = await fetch('/api/send-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ number: phoneNumber, message })
                  });
                  if (!resp.ok) {
                    const txt = await resp.text();
                    console.warn('SMS API error (treated):', txt);
                  } else {
                    console.log('Treated SMS sent/queued');
                  }
                }
              } catch (smsErr) {
                console.warn('Failed to send treated SMS', smsErr);
              }
            }
          } catch (errInner) {
            console.error('Error handling post-treated notifications', errInner);
          }
          alert('Patient marked as treated!');
        })();
      }).catch((err) => {
        console.error('Error updating status:', err);
        alert('Failed to update status');
      });
    }
  };

  const handleNavigation = (direction) => {
    switch(view) {
      case 'month': changeMonth(direction); break;
      case 'week': changeWeek(direction); break;
      case 'day': changeDay(direction); break;
      default: break;
    }
  };

  const getViewTitle = () => {
    switch(view) {
      case 'month': return formatDate(currentDate);
      case 'week': return formatWeekRange(currentDate);
      case 'day': return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      case 'list': return 'Upcoming Appointments';
      default: return formatDate(currentDate);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading appointments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* LEFT COLUMN */}
          <div className="space-y-4">
            
            {/* Status Boxes */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <button 
                  onClick={() => setStatusFilter('All')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'All' ? 'border-gray-500 bg-gray-50' : 'border-gray-300 hover:bg-gray-50'}`}
                >
                  <div className="text-2xl font-bold text-gray-700">{allCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">ALL</div>
                </button>
                
                <button 
                  onClick={() => setStatusFilter('Pending')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'Pending' ? 'border-yellow-500 bg-yellow-50' : 'border-yellow-300 hover:bg-yellow-50'}`}
                >
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">PENDING</div>
                </button>
                
                <button 
                  onClick={() => setStatusFilter('Confirmed')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'Confirmed' ? 'border-green-500 bg-green-50' : 'border-green-300 hover:bg-green-50'}`}
                >
                  <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">CONFIRMED</div>
                </button>

                <button 
                  onClick={() => setStatusFilter('Treated')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'Treated' ? 'border-blue-500 bg-blue-50' : 'border-blue-300 hover:bg-blue-50'}`}
                >
                  <div className="text-2xl font-bold text-blue-600">{treatedCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">TREATED</div>
                </button>
                
                <button 
                  onClick={() => setStatusFilter('Cancelled')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'Cancelled' ? 'border-red-500 bg-red-50' : 'border-red-300 hover:bg-red-50'}`}
                >
                  <div className="text-2xl font-bold text-red-600">{cancelledCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">CANCELLED</div>
                </button>
                
                <button 
                  onClick={() => setStatusFilter('Reschedule')}
                  className={`border-2 rounded p-2 text-center transition-all ${statusFilter === 'Reschedule' ? 'border-purple-500 bg-purple-50' : 'border-purple-300 hover:bg-purple-50'}`}
                >
                  <div className="text-2xl font-bold text-purple-600">{rescheduleCount}</div>
                  <div className="text-[10px] text-gray-600 font-semibold mt-0.5">RESCHEDULE</div>
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Show</span>
                  <select 
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
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
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border px-3 py-1 rounded text-xs border-gray-400 focus:border-red-600 focus:ring-1 focus:ring-red-600"
                  />
                  <select 
                    value={walkInType}
                    onChange={(e) => setWalkInType(e.target.value)}
                    className="border border-gray-400 rounded px-3 py-1 text-xs bg-blue-50 font-medium"
                  >
                    <option value="walkin">Walk In</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-400 rounded">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100 border-b border-gray-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Patient</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Date Submitted</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">Appointment Date</th>
                      <th className="text-left px-3 py-2 font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAppointments ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-gray-500">Loading...</td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-gray-500">No appointments found</td>
                      </tr>
                    ) : (
                      paginatedData.map((apt, idx) => {
                        const isNew = isNewAppointment(apt);
                        return (
                          <tr
                            key={apt.id || idx}
                            onClick={() => handleRowClick(apt)}
                            className={`border-b border-gray-300 cursor-pointer transition-all ${
                              isNew 
                                ? 'bg-gray-200 hover:bg-gray-300 font-medium' 
                                : 'hover:bg-gray-50'
                            }`}
                            title={isNew ? 'New appointment - click to view' : 'Click to view details'}
                          >
                            <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: apt.color || '#3b82f6' }} />
                                <span className="truncate">{getPatientDisplay(apt)}</span>
                                {isNew && (
                                  <span className="ml-auto px-1.5 py-0.5 bg-blue-600 text-white rounded text-[9px] font-bold">
                                    NEW
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-800 border-r border-gray-200">
                              {apt.createdAt ? displayDate(apt.createdAt) : 'N/A'}
                            </td>
                            <td className="px-3 py-2 text-gray-800 border-r border-gray-200">{apt.date || 'N/A'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-white text-[10px] font-medium inline-block ${
                                (apt.status || '').toLowerCase() === 'confirmed' ? 'bg-green-500' :
                                (apt.status || '').toLowerCase() === 'pending' ? 'bg-yellow-500' :
                                (apt.status || '').toLowerCase() === 'treated' ? 'bg-blue-500' :
                                (apt.status || '').toLowerCase() === 'cancelled' ? 'bg-red-500' :
                                (apt.status || '').toLowerCase() === 'reschedule' ? 'bg-purple-500' :
                                'bg-gray-500'
                              }`}>
                                {(apt.status || 'unknown').toLowerCase()}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center mt-3">
                <div className="text-xs text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filtered.length)}</span> of <span className="font-medium">{filtered.length}</span> entries
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

              <div className="flex justify-end mt-3">
                <button
                  onClick={openAddModal}
                  className="px-4 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2 text-xs font-medium"
                >
                  Add Walk In
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
           
            {/* Calendar Area */}
            <div className="bg-white rounded border border-gray-300 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleNavigation(-1)} className="p-1 hover:bg-gray-100 rounded border border-gray-400"><ChevronLeft size={16} /></button>
                  <button onClick={() => handleNavigation(1)} className="p-1 hover:bg-gray-100 rounded border border-gray-400"><ChevronRight size={16} /></button>
                  <button onClick={goToToday} className="px-2 py-1 bg-gray-700 text-white text-xs rounded hover:bg-gray-800 ml-1">Today</button>
                </div>

                <span className="font-semibold text-sm text-gray-700">{getViewTitle()}</span>

                <div className="flex gap-1">
                  <button onClick={() => setView('month')} className={`px-2 py-1 text-xs rounded ${view === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Month</button>
                  <button onClick={() => setView('week')} className={`px-2 py-1 text-xs rounded ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Week</button>
                  <button onClick={() => setView('day')} className={`px-2 py-1 text-xs rounded ${view === 'day' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>Day</button>
                  <button onClick={() => setView('list')} className={`px-2 py-1 text-xs rounded ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>List</button>
                </div>
              </div>

              {view === 'month' ? renderMonthView() : view === 'week' ? renderWeekView() : view === 'day' ? renderDayView() : <div className="bg-white rounded-lg shadow-sm p-4">{renderListView()}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Health Declaration Modal */}
      {showHealthModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 border-b pb-3">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <Heart className="text-red-600" size={20} />
                  Health Declaration Form
                </h3>
                <button onClick={() => setShowHealthModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Patient:</span> {getPatientName(selectedAppointment)}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">Date:</span> {selectedAppointment.date}
                </div>
              </div>

              {selectedAppointment.healthDeclaration && (
                <div className="bg-gray-50 border rounded p-3 mb-4">
                  <div className="text-xs font-medium text-gray-700 mb-2">General Health Declaration</div>
                  <div className="text-sm text-gray-900">{selectedAppointment.healthDeclaration}</div>
                </div>
              )}

              {selectedAppointment.health?.questions && selectedAppointment.health.questions.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-3">Health Screening Questions</div>
                  <div className="space-y-2">
                    {selectedAppointment.health.questions.map((q) => {
                      const answer = selectedAppointment.health.answers?.[q.id] || "—";
                      return (
                        <div key={q.id} className="flex items-start justify-between border-b pb-2">
                          <div className="w-3/4 text-sm text-gray-700">• {q.text}</div>
                          <div
                            className={`font-semibold text-sm uppercase ${
                              answer === "yes"
                                ? "text-red-600"
                                : answer === "no"
                                ? "text-green-600"
                                : "text-gray-400"
                            }`}
                          >
                            {answer}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!selectedAppointment.healthDeclaration && (!selectedAppointment.health?.questions || selectedAppointment.health.questions.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No health declaration data available</p>
                </div>
              )}

              <div className="flex justify-end mt-4 pt-3 border-t">
                <button
                  onClick={() => setShowHealthModal(false)}
                  className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                  <User className="text-red-600" size={20} />
                  Edit Appointment Details
                </h3>
                <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleEditSave} className="space-y-3 text-sm">
                {/* Patient Info */}
                <div className="border-b pb-2 mb-2 font-medium text-gray-600">
                  Patient Information
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={getPatientName(selectedAppointment)}
                    readOnly
                    className="border w-full px-2 py-1 rounded bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={getPatientEmail(selectedAppointment)}
                    readOnly
                    className="border w-full px-2 py-1 rounded bg-gray-100"
                  />
                </div>

                {/* Appointment Details */}
                <div className="border-b pb-2 mt-4 mb-2 font-medium text-gray-600">
                  Appointment Details
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Treatment / Service</label>
                  <input
                    type="text"
                    value={editForm.treatment}
                    onChange={(e) => setEditForm({ ...editForm, treatment: e.target.value })}
                    className="border w-full px-2 py-1 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Option</label>
                  <input
                    type="text"
                    value={editForm.treatmentOption}
                    onChange={(e) => setEditForm({ ...editForm, treatmentOption: e.target.value })}
                    className="border w-full px-2 py-1 rounded"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Appointment Date</label>
                    <input
                      type="date"
                      value={editForm.appointmentDate}
                      onChange={(e) => setEditForm({ ...editForm, appointmentDate: e.target.value })}
                      className="border w-full px-2 py-1 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Time Slot</label>
                    <input
                      type="text"
                      placeholder="e.g., 10:00 - 10:30"
                      value={editForm.slot}
                      onChange={(e) => setEditForm({ ...editForm, slot: e.target.value })}
                      className="border w-full px-2 py-1 rounded"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Dentist</label>
                  <input
                    type="text"
                    value={editForm.preferredDentist}
                    onChange={(e) => setEditForm({ ...editForm, preferredDentist: e.target.value })}
                    className="border w-full px-2 py-1 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price</label>
                  <input
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="border w-full px-2 py-1 rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Health Declaration</label>
                  <textarea
                    value={editForm.healthDeclaration}
                    onChange={(e) => setEditForm({ ...editForm, healthDeclaration: e.target.value })}
                    rows={2}
                    className="border w-full px-2 py-1 rounded resize-none"
                  />
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Calendar Color</label>
                  <div className="flex flex-wrap gap-2">
                    {colorOptions.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setEditForm({ ...editForm, color: color.value })}
                        className={`w-10 h-10 rounded border-2 transition-all ${
                          editForm.color === color.value ? "border-gray-800 scale-110" : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Selected: {colorOptions.find((c) => c.value === editForm.color)?.name || "Custom"}
                  </div>
                </div>

                {/* Status Section */}
                <div className="border-b pb-2 mt-4 mb-2 font-medium text-gray-600">
                  Status Management
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Overall Appointment Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="border w-full px-2 py-1 rounded"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="treated">Treated</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="reschedule">Reschedule</option>
                  </select>
                  {editForm.status !== editForm.previousStatus && 
                   (editForm.status === "confirmed" || editForm.status === "cancelled" || editForm.status === "reschedule" || editForm.status === "treated") && (
                    <p className="text-xs text-blue-600 mt-1">
                      ℹ️ Patient will be notified via SMS about this status change
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="bg-gray-400 text-white px-3 py-1 rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-red-700 text-white px-3 py-1 rounded hover:bg-red-800 disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Details Modal (from calendar click) */}
      {showDetailsModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: selectedAppointment.color || '#3b82f6' }} />
                  <h3 className="text-2xl font-bold text-gray-800">Appointment Details</h3>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap mb-4">
                  <span className={`px-3 py-1.5 text-sm font-medium rounded border flex items-center gap-1 ${getStatusColor(selectedAppointment.status)}`}>
                    {selectedAppointment.status?.toUpperCase() || 'UNKNOWN'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Patient Name</div>
                      <div className="font-semibold text-gray-900">{getPatientName(selectedAppointment)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Phone</div>
                      <div className="font-semibold text-gray-900">{getPatientPhone(selectedAppointment)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="font-semibold text-gray-900">{getPatientEmail(selectedAppointment)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CalendarIcon className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Date</div>
                      <div className="font-semibold text-gray-900">
                        {selectedAppointment.date ? new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Time</div>
                      <div className="font-semibold text-gray-900">{selectedAppointment.time || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <User className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Dentist</div>
                      <div className="font-semibold text-gray-900">{getDentistName(selectedAppointment)}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm text-gray-500">Treatment</div>
                      <div className="font-semibold text-gray-900">{selectedAppointment.treatment || 'Not specified'}</div>
                    </div>
                  </div>

                  {selectedAppointment.treatmentOption && (
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-gray-500">Treatment Option</div>
                        <div className="font-semibold text-gray-900">{selectedAppointment.treatmentOption}</div>
                      </div>
                    </div>
                  )}

                  {selectedAppointment.price && (
                    <div className="flex items-start gap-3">
                      <DollarSign className="w-5 h-5 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <div className="text-sm text-gray-500">Price</div>
                        <div className="font-semibold text-gray-900">₱{selectedAppointment.price}</div>
                      </div>
                    </div>
                  )}
                </div>

                {selectedAppointment.healthDeclaration && (
                  <div className="bg-gray-50 rounded-lg p-4 mt-4">
                    <div className="text-sm text-gray-500 mb-2 font-medium">Health Declaration</div>
                    <div className="text-gray-900">{selectedAppointment.healthDeclaration}</div>
                  </div>
                )}

                {selectedAppointment.additionalNotes && (
                  <div className="bg-gray-50 rounded-lg p-4 mt-4">
                    <div className="text-sm text-gray-500 mb-2 font-medium">Additional Notes</div>
                    <div className="text-gray-900">{selectedAppointment.additionalNotes}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-4 border-t mt-4">
                  <button 
                    onClick={() => openHealthModal(selectedAppointment)}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Heart size={16} />
                    View Health
                  </button>
                  <button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEditModal(selectedAppointment);
                    }}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Pencil size={16} />
                    Edit Details
                  </button>
                  <button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleCancelAppointment(selectedAppointment.id);
                    }}
                    className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={16} />
                    Cancel Appt
                  </button>
                  <button 
                    onClick={() => {
                      setShowDetailsModal(false);
                      handleDeleteAppointment(selectedAppointment.id);
                    }}
                    className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete Appt
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Walk In Modal - Placeholder */}
      {showAddWalkInModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">Add Walk-in Appointment</h3>
                <button onClick={() => setShowAddWalkInModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                {/* Patient Selection */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select Patient *</label>
                      {/* Searchable Patient Dropdown */}
                      <div className="relative" ref={patientDropdownRef}>
                        <input
                          type="text"
                          placeholder="Search patient name or email..."
                          value={patientSearch || (form.patientId && selectedPatientName) || ''}
                          onChange={e => {
                            setPatientSearch(e.target.value);
                            setShowPatientDropdown(true);
                          }}
                          onFocus={() => setShowPatientDropdown(true)}
                          className="w-full p-2 border rounded text-sm"
                        />
                        {/* Selected Patient Display */}
                        {form.patientId && selectedPatientName && !patientSearch && (
                          <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-700">
                            <span className="font-medium">Selected:</span> {selectedPatientName}
                          </div>
                        )}
                        {/* Dropdown Results */}
                        {showPatientDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                            {(() => {
                              const filtered = patients.filter(p => {
                                const name = (p.firstName || '') + ' ' + (p.lastName || '');
                                return (
                                  name.toLowerCase().includes((patientSearch || '').toLowerCase()) ||
                                  (p.email || '').toLowerCase().includes((patientSearch || '').toLowerCase())
                                );
                              });
                              return filtered.length > 0 ? (
                                <ul>
                                  {filtered.map((p) => {
                                    const name = (p.firstName || '') + ' ' + (p.lastName || '');
                                    return (
                                      <li
                                        key={p.id}
                                        onClick={() => {
                                          handlePatientSelect(p.id);
                                          setPatientSearch('');
                                          setShowPatientDropdown(false);
                                          setSelectedPatientName(name);
                                        }}
                                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 text-xs"
                                      >
                                        <div className="font-medium text-gray-800">{name}</div>
                                        <div className="text-gray-500">{p.email}</div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <div className="px-3 py-3 text-xs text-gray-500 text-center">
                                  No patients found
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Email</label>
                      <input
                        name="patientEmail"
                        value={form.patientEmail}
                        readOnly
                        className="w-full p-2 border rounded bg-gray-100 text-sm"
                        placeholder="Auto-filled"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Phone</label>
                      <input
                        name="patientPhone"
                        value={form.patientPhone}
                        readOnly
                        className="w-full p-2 border rounded bg-gray-100 text-sm"
                        placeholder="Auto-filled"
                      />
                    </div>
                  </div>
                </div>

                {/* Service Selection */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Service / Treatment</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select Service *</label>
                      <select
                        value={selectedCategory?.category || ""}
                        onChange={(e) => {
                          const t = treatments.find((x) => x.category === e.target.value);
                          setSelectedCategory(t || null);
                          setSelectedOption(null);
                        }}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="">-- Select Service --</option>
                        {treatments.map((t) => (
                          <option key={t.category} value={t.category}>{t.category}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select Option *</label>
                      <select
                        value={selectedOption?.type || ""}
                        onChange={(e) => {
                          const opt = selectedCategory?.options?.find((o) => o.type === e.target.value);
                          setSelectedOption(opt || null);
                        }}
                        className="w-full p-2 border rounded text-sm"
                        disabled={!selectedCategory}
                      >
                        <option value="">{selectedCategory ? "Choose option" : "Select service first"}</option>
                        {selectedCategory?.options?.map((o) => (
                          <option key={o.type} value={o.type}>
                            {o.type} — ₱{o.price} ({o.time} min)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {selectedOption && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                      <strong>Price:</strong> ₱{selectedOption.price} | <strong>Duration:</strong> {selectedOption.time} minutes
                    </div>
                  )}
                </div>

                {/* Appointment Details */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Appointment Schedule</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select Doctor *</label>
                      <select
                        name="providerId"
                        value={form.providerId}
                        onChange={(e) => handleProviderSelect(e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="">-- Select Dentist --</option>
                        {Object.values(dentists).map((d) => (
                          <option key={d.id || d.fullName} value={d.id || d.fullName}>
                            {d.fullName || d.name || "Unknown"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Appointment Date *</label>
                      <input
                        type="date"
                        name="appointmentDate"
                        value={form.appointmentDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full p-2 border rounded text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">
                        Time Slot * {selectedOption && `(${selectedOption.time} min needed)`}
                      </label>
                      <select
                        name="slot"
                        value={form.slot}
                        onChange={handleFormChange}
                        className="w-full p-2 border rounded text-sm"
                        disabled={!form.appointmentDate || !selectedOption}
                      >
                        <option value="">-- Select Time --</option>
                        {availableSlots.length === 0 ? (
                          <option value="">No available slots</option>
                        ) : (
                          availableSlots.map((s) => <option key={s} value={s}>{s}</option>)
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Health Declaration */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Heart className="text-red-600" size={16} />
                    Health Declaration
                  </h4>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">General Notes</label>
                    <textarea
                      name="healthDeclaration"
                      value={form.healthDeclaration}
                      onChange={handleFormChange}
                      rows={2}
                      placeholder="Allergies, recent illnesses, or other notes..."
                      className="w-full p-2 border rounded text-sm resize-none"
                    />
                  </div>
                </div>

                {/* Health Questions */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Health Screening Questions *</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {healthQuestionsList.map((q) => (
                      <div key={q.id} className="flex items-center justify-between p-2 border rounded text-xs">
                        <div className="flex-1 pr-2">{q.text}</div>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name={q.id}
                              value="yes"
                              checked={healthAnswers[q.id] === "yes"}
                              onChange={() => setHealthAnswers((h) => ({ ...h, [q.id]: "yes" }))}
                            />
                            <span>Yes</span>
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="radio"
                              name={q.id}
                              value="no"
                              checked={healthAnswers[q.id] === "no"}
                              onChange={() => setHealthAnswers((h) => ({ ...h, [q.id]: "no" }))}
                            />
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color & Status */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-2">Calendar Color</label>
                      <div className="flex flex-wrap gap-2">
                        {colorOptions.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setForm({ ...form, color: color.value })}
                            className={`w-10 h-10 rounded border-2 transition-all ${
                              form.color === color.value ? "border-gray-800 scale-110" : "border-gray-300"
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Status</label>
                      <select
                        name="status"
                        value={form.status}
                        onChange={handleFormChange}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="confirmed">Confirmed</option>
                        <option value="pending">Pending</option>
                        <option value="treated">Treated</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddWalkInModal(false)}
                    className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Walk-in"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}