import React, { useEffect, useRef, useState } from "react";
import { db, auth } from "../../../firebase.config";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Save, X, Calendar, Clock, User, FileText, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

const PAYPAL_CLIENT_ID = "AQ7EOFkdAiFb_I8zfNh68kltLYpMD0TbvVeW212iPAd_iAivDQ1mYSqF6ATOEVPk_kbvPLQRx7sVWV_c";
const RESERVATION_FEE = 10;
const REQUIRE_HEALTH_ANSWERS = true;

// ============ NEW: SMS SENDING FUNCTION ============
const sendAppointmentSMS = async (appointmentData) => {
  try {
    // Get patient's phone number from users collection
    const usersRef = collection(db, "users");
    const userQuery = query(
      usersRef,
      where("email", "==", appointmentData.userEmail.toLowerCase())
    );
    const userSnapshot = await getDocs(userQuery);
    
    let phoneNumber = null;
    if (!userSnapshot.empty) {
      const userData = userSnapshot.docs[0].data();
      phoneNumber = userData.contactNumber || userData.phoneNumber || userData.phone;
    }

    // Fallback: check appointment data itself
    if (!phoneNumber) {
      phoneNumber = appointmentData.phoneNumber || appointmentData.contactNumber || appointmentData.phone;
    }

    if (!phoneNumber) {
      console.log("No phone number found for patient, skipping SMS");
      return { success: false, reason: "No phone number" };
    }

    // Format appointment details
    const patientName = appointmentData.userName || "Patient";
    const service = appointmentData.treatmentOption || appointmentData.treatment || "your appointment";
    const appointmentDate = appointmentData.date;
    const appointmentTime = appointmentData.time;
    const status = appointmentData.reservationStatus === "paid" ? "CONFIRMED" : "PENDING";
    const paymentNote = appointmentData.reservationStatus === "paid" 
      ? "Your reservation fee has been paid." 
      : "Please pay your reservation fee at the clinic.";

    // Create SMS message
    const message = `Hi ${patientName}! Your appointment for ${service} on ${appointmentDate} at ${appointmentTime} is ${status}. ${paymentNote} Thank you for choosing our clinic! - Dental Clinic`;

    // Send SMS via API
    const response = await fetch('/api/send-sms', {
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
      return { success: false, error: errorText };
    }

    const data = await response.json();
    console.log("SMS sent successfully:", data);
    return { success: true, data };

  } catch (error) {
    console.error("Error sending appointment SMS:", error);
    return { success: false, error: error.message };
  }
};

const timeSlots = [
  "10:00 - 10:30", "10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00",
  "12:00 - 12:30", "12:30 - 13:00", "13:00 - 13:30", "13:30 - 14:00",
  "14:00 - 14:30", "14:30 - 15:00", "15:00 - 15:30", "15:30 - 16:00",
  "16:00 - 16:30", "16:30 - 17:00",
];

const treatments = [
  {
    category: "Cleaning (LINIS)",
    image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop",
    gradient: "from-blue-400 to-cyan-500",
    options: [
      {
        type: "Additional Stain Removal (Prophy Jet)",
        price: 300,
        time: 30,
        description: "Advanced stain removal using air-polishing technology for stubborn discoloration."
      },
      {
        type: "Mild to Average Deposit (Tartar)",
        price: 650,
        time: 30,
        description: "Removes light to moderate tartar buildup and surface stains for a cleaner, fresher smile."
      },
      {
        type: "Moderate to Heavy Deposit",
        price: 900,
        time: 60,
        description: "Deep cleaning procedure for heavy tartar accumulation, including scaling and polishing."
      },
    ],
  },
  {
    category: "Filling (PASTA)",
    image: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=300&fit=crop",
    gradient: "from-teal-400 to-emerald-500",
    options: [
      {
        type: "Temporary",
        price: 400,
        time: 30,
        description: "Short-term filling solution to protect the tooth until permanent restoration."
      },
      {
        type: "Permanent",
        price: 1150,
        time: 60,
        description: "Long-lasting tooth-colored composite filling that restores tooth function and appearance."
      },
    ],
  },
  {
    category: "Tooth Extraction (BUNOT)",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=300&fit=crop",
    gradient: "from-purple-400 to-pink-500",
    options: [
      {
        type: "Regular",
        price: 600,
        time: 30,
        description: "Simple extraction for fully erupted teeth with minimal complications."
      },
      {
        type: "Complicated",
        price: 1000,
        time: 60,
        description: "Extraction requiring additional techniques for broken or partially erupted teeth."
      },
      {
        type: "Surgery",
        price: 5500,
        time: 60,
        description: "Surgical removal of impacted teeth or complex extractions requiring incision."
      },
    ],
  },
  {
    category: "Crown / Bridge (JACKET)",
    image: "https://images.unsplash.com/photo-1609840114035-3c981407e1f8?w=400&h=300&fit=crop",
    gradient: "from-amber-400 to-orange-500",
    options: [
      {
        type: "Temporary",
        price: 300,
        time: 30,
        description: "Provisional crown to protect tooth while permanent crown is being made."
      },
      {
        type: "Plastic",
        price: 3000,
        time: 60,
        description: "Affordable acrylic crown option for temporary or budget-conscious patients."
      },
      {
        type: "Porcelain",
        price: 7000,
        time: 60,
        description: "High-quality ceramic crown that looks natural and provides excellent durability."
      },
    ],
  },
  {
    category: "Complete Denture",
    image: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=400&h=300&fit=crop",
    gradient: "from-rose-400 to-red-500",
    options: [
      {
        type: "Ordinary",
        price: 5000,
        time: 60,
        description: "Standard acrylic denture for complete tooth replacement, functional and affordable."
      },
      {
        type: "Lucitone",
        price: 7000,
        time: 60,
        description: "Premium acrylic denture with better aesthetics and stain resistance."
      },
      {
        type: "Porcelain Pontic",
        price: 10000,
        time: 60,
        description: "Denture with porcelain teeth for enhanced aesthetics and wear resistance."
      },
      {
        type: "Ivocap",
        price: 15000,
        time: 60,
        description: "High-pressure injection molded denture with superior fit and durability."
      },
      {
        type: "Flexicryl",
        price: 16000,
        time: 60,
        description: "Flexible, lightweight denture material for maximum comfort and natural appearance."
      },
    ],
  },
  {
    category: "Orthodontics (BRACES)",
    image: "https://images.unsplash.com/photo-1606811971618-4486d14f3f99?w=400&h=300&fit=crop",
    gradient: "from-indigo-400 to-purple-500",
    options: [
      {
        type: "Conventional (Metal)",
        price: 35000,
        time: 60,
        description: "Traditional metal braces for both upper and lower teeth. Down payment available: ₱10,000."
      },
      {
        type: "Ceramic",
        price: 45000,
        time: 60,
        description: "Tooth-colored ceramic brackets that blend with your teeth. Down payment available: ₱15,000."
      },
      {
        type: "Self-ligating",
        price: 55000,
        time: 60,
        description: "Advanced braces system with faster treatment time. Down payment available: ₱25,000."
      },
    ],
  },
  {
    category: "Retainer",
    image: "https://images.unsplash.com/photo-1612351988680-341f5692b70b?w=400&h=300&fit=crop",
    gradient: "from-sky-400 to-blue-500",
    options: [
      {
        type: "Hawley Retainer (Plain)",
        price: 1500,
        time: 30,
        description: "Classic wire and acrylic retainer to maintain tooth position after braces."
      },
      {
        type: "Invisible Retainer",
        price: 3500,
        time: 30,
        description: "Clear plastic retainer that's virtually invisible when worn."
      },
      {
        type: "Soft Mouthguard",
        price: 3500,
        time: 30,
        description: "Custom-fitted protective guard for teeth grinding or sports activities."
      },
    ],
  },
  {
    category: "Partial Denture",
    image: "https://images.unsplash.com/photo-1632053002126-a0b23f776f3d?w=400&h=300&fit=crop",
    gradient: "from-lime-400 to-green-500",
    options: [
      {
        type: "Ordinary",
        price: 3750,
        time: 60,
        description: "Standard acrylic partial denture to replace multiple missing teeth."
      },
      {
        type: "Ordinary (1-3 teeth missing)",
        price: 2750,
        time: 30,
        description: "Smaller partial denture for replacing one to three missing teeth."
      },
      {
        type: "Metal Framework (Uni)",
        price: 7000,
        time: 60,
        description: "Durable metal-based partial denture for one arch with superior strength."
      },
      {
        type: "Metal Framework (Bila)",
        price: 10000,
        time: 60,
        description: "Double-sided metal framework partial denture for both upper and lower."
      },
      {
        type: "Flexible",
        price: 10500,
        time: 60,
        description: "Comfortable flexible material partial denture without visible metal clasps."
      },
    ],
  },
  {
    category: "Whitening",
    image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=400&h=300&fit=crop",
    gradient: "from-yellow-400 to-amber-500",
    options: [
      {
        type: "In-Office",
        price: 6000,
        time: 60,
        description: "Professional teeth whitening procedure for immediate, dramatic results in one visit."
      },
    ],
  },
  {
    category: "Veneers",
    image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop",
    gradient: "from-pink-400 to-rose-500",
    options: [
      {
        type: "Ceramage",
        price: 11000,
        time: 60,
        description: "Hybrid ceramic veneer combining strength of porcelain with flexibility of composite."
      },
      {
        type: "E-max",
        price: 14000,
        time: 60,
        description: "Premium lithium disilicate veneer with exceptional aesthetics and translucency."
      },
      {
        type: "Zirconia",
        price: 16000,
        time: 60,
        description: "Ultra-strong zirconia veneer, ideal for high-stress areas and maximum durability."
      },
      {
        type: "Direct Composite",
        price: 2500,
        time: 30,
        description: "Same-day composite resin veneer applied directly to teeth for minor corrections."
      },
    ],
  },
  {
    category: "Root Canal Therapy",
    image: "https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=400&h=300&fit=crop",
    gradient: "from-cyan-400 to-teal-500",
    options: [
      {
        type: "Per Canal",
        price: 3500,
        time: 60,
        description: "Removal of infected pulp and sealing of tooth canal to save the natural tooth."
      },
    ],
  },
  {
    category: "TMJ Therapy",
    image: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=300&fit=crop",
    gradient: "from-violet-400 to-purple-500",
    options: [
      {
        type: "Splint",
        price: 7000,
        time: 60,
        description: "Custom oral appliance to relieve jaw pain and protect teeth from grinding."
      },
      {
        type: "Expander",
        price: 8000,
        time: 60,
        description: "Device to widen upper jaw and improve bite alignment in growing patients."
      },
      {
        type: "Bionator",
        price: 10000,
        time: 60,
        description: "Functional orthodontic appliance to correct jaw relationship and growth."
      },
      {
        type: "Combination Appliance (Phase 1)",
        price: 10000,
        time: 60,
        description: "Multi-functional device combining expansion and jaw correction features."
      },
      {
        type: "Per Adjustment",
        price: 1500,
        time: 30,
        description: "Follow-up visit for appliance adjustment and progress monitoring."
      },
    ],
  },
  {
    category: "Denture Repair",
    image: "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=400&h=300&fit=crop",
    gradient: "from-orange-400 to-red-500",
    options: [
      {
        type: "Denture Repair",
        price: 600,
        time: 30,
        description: "Fixing broken or cracked dentures to restore function and appearance."
      },
      {
        type: "Replacement Pontic (Plastic)",
        price: 300,
        time: 30,
        description: "Replacing a single damaged or lost tooth on existing denture."
      },
    ],
  },
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
  { id: "q10", text: "Have you been in contact with someone who tested positive for COVID-19?" },
];

function StatusBadge({ status }) {
  const s = (status || "").toString().toLowerCase();
  if (s === "confirmed" || s === "paid")
    return <span className="inline-flex items-center px-2 py-1 rounded bg-emerald-100 text-emerald-800 text-xs">Confirmed</span>;
  if (s === "pending" || s === "unpaid")
    return <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 text-amber-800 text-xs">Pending</span>;
  if (s === "cancelled")
    return <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">Cancelled</span>;
  return <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">—</span>;
}

const MULTI_VISIT_TREATMENTS = {
  "Orthodontics (BRACES)": {
    isMultiVisit: true,
    options: ["Conventional (Metal)", "Ceramic ", "Self-ligating"]
  },
  "TMJ Therapy": {
    isMultiVisit: true,
    options: ["Splint", "Expander", "Bionator", "Combination Appliance (Phase 1)", "Per Adjustment"]
  },
  "Retainer": {
    isMultiVisit: true,
    options: ["Hawley Retainer (Plain)", "Invisible Retainer", "Soft Mouthguard"]
  },
  "Crown / Bridge (JACKET)": {
    isMultiVisit: true,
    options: ["Temporary", "Plastic", "Porcelain"]
  },
  "Complete Denture": {
    isMultiVisit: true,
    options: ["Ordinary", "Lucitone", "Porcelain Pontic", "Ivocap", "Flexicryl"]
  },
  "Partial Denture": {
    isMultiVisit: true,
    options: ["Ordinary", "Ordinary (1-3 teeth missing)", "Metal Framework (Uni)", "Metal Framework (Bila)", "Flexible"]
  },
  "Veneers": {
    isMultiVisit: true,
    options: ["Ceramage", "E-max", "Zirconia", "Direct Composite"]
  }
};

const PAYMENT_TYPES = {
  FULL: "full",
  DOWN_PAYMENT: "downpayment"
};

export default function PatientAppointment() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [dentists, setDentists] = useState([]);
  const [formData, setFormData] = useState({
    date: "",
    time: "",
    preferredDentist: "",
    healthDeclaration: "",
    paymentType: "", // "full" or "downpayment"
    visitType: "initial", // "initial", "followup", "adjustment"
  });
  const [availableTimes, setAvailableTimes] = useState(timeSlots);
  const [healthAnswers, setHealthAnswers] = useState(
    healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: "" }), {})
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentHistory, setAppointmentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [lastPaymentData, setLastPaymentData] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [showPaymentTypeModal, setShowPaymentTypeModal] = useState(false);

  // Reschedule modal states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleAvailableTimes, setRescheduleAvailableTimes] = useState(timeSlots);

  const unsubRef = useRef(null);
  const debounceRef = useRef(null);

  // Save form data to session storage when reservation is unpaid
  const saveFormDataToSession = () => {
    try {
      sessionStorage.setItem('appointmentFormData', JSON.stringify({
        selectedCategory,
        selectedOption,
        formData,
        healthAnswers,
        step,
        timestamp: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('Failed to save to sessionStorage:', e);
    }
  };

  // Load form data from session storage
  const loadFormDataFromSession = () => {
    try {
      const saved = sessionStorage.getItem('appointmentFormData');
      if (saved) {
        const data = JSON.parse(saved);
        const savedTime = new Date(data.timestamp);
        const now = new Date();
        if ((now - savedTime) / (1000 * 60 * 60) < 24) {
          setSelectedCategory(data.selectedCategory);
          setSelectedOption(data.selectedOption);
          setFormData(data.formData);
          setHealthAnswers(data.healthAnswers);
          setStep(data.step);
          toast.info('Previous appointment data restored');
          return true;
        } else {
          sessionStorage.removeItem('appointmentFormData');
        }
      }
    } catch (e) {
      console.warn('Failed to load from sessionStorage:', e);
    }
    return false;
  };

  // Clear form data from session storage
  const clearFormDataFromSession = () => {
    try {
      sessionStorage.removeItem('appointmentFormData');
    } catch (e) {
      console.warn('Failed to clear sessionStorage:', e);
    }
  };

  // Fetch active dentists
  useEffect(() => {
    const fetchDentists = async () => {
      try {
        const dentistsRef = collection(db, "dentists");
        const q = query(dentistsRef, where("status", "==", "active"));
        const snapshot = await getDocs(q);
        const dentistsList = snapshot.docs.map(d => ({ id: d.id, ...(d.data ? d.data() : d) }));
        setDentists(dentistsList);
      } catch (error) {
        console.error("Error fetching dentists:", error);
        toast.error("Failed to load dentists");
      }
    };
    fetchDentists();
  }, []);

  // Load saved form data on component mount
  useEffect(() => {
    loadFormDataFromSession();
  }, []);

  // Save form data whenever it changes
  useEffect(() => {
    if (formData.date || selectedCategory || selectedOption) {
      saveFormDataToSession();
    }
  }, [selectedCategory, selectedOption, formData, healthAnswers, step]);

  // Auth state + subscribe to user's onlineRequests history
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (unsubRef.current) {
        try { unsubRef.current(); } catch (e) { }
        unsubRef.current = null;
      }
      if (u) {
        const q = query(collection(db, "onlineRequests"), where("userId", "==", u.uid));
        try {
          unsubRef.current = onSnapshot(q, (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data ? d.data() : d) }));
            list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setAppointmentHistory(list);
          });
        } catch (err) {
          console.error("subscribe error:", err);
        }
      } else {
        setAppointmentHistory([]);
      }
    });
    return () => {
      if (unsubRef.current) try { unsubRef.current(); } catch (e) { }
      try { unsubAuth(); } catch (e) { }
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Enhanced double booking check with overlap detection
  const checkForDoubleBooking = async (date, time, duration) => {
    try {
      const selectedIndex = timeSlots.indexOf(time);
      if (selectedIndex < 0) return false;

      const slotsNeeded = Math.ceil((duration || 30) / 30);
      const onlineQ = query(collection(db, "onlineRequests"), where("date", "==", date));
      const walkInQ = query(collection(db, "appointments"), where("date", "==", date));
      const [onlineSnap, walkInSnap] = await Promise.all([getDocs(onlineQ), getDocs(walkInQ)]);

      const allowedStatuses = new Set(["confirmed", "paid"]);
      const allDocs = [...(onlineSnap?.docs || []), ...(walkInSnap?.docs || [])];

      for (const d of allDocs) {
        const ap = d.data ? d.data() : d;
        const apStatus = (ap.status || ap.reservationStatus || "").toString().toLowerCase();
        if (!allowedStatuses.has(apStatus)) continue;

        const idx = timeSlots.indexOf(ap.time);
        if (idx < 0) continue;

        const apSlots = Math.ceil((ap.duration || 30) / 30);
        const apEnd = idx + apSlots;
        const selEnd = selectedIndex + slotsNeeded;

        // Check for overlap
        if ((selectedIndex >= idx && selectedIndex < apEnd) || (idx >= selectedIndex && idx < selEnd)) {
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("checkForDoubleBooking err", err);
      return false;
    }
  };

  // Debounced date change availability check
  const handleDateChange = (date) => {
    setFormData(f => ({ ...f, date, time: "" }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        if (!date) {
          setAvailableTimes(timeSlots);
          setIsLoading(false);
          return;
        }
        const onlineQ = query(collection(db, "onlineRequests"), where("date", "==", date));
        const walkInQ = query(collection(db, "appointments"), where("date", "==", date));
        const [onlineSnap, walkInSnap] = await Promise.all([getDocs(onlineQ), getDocs(walkInQ)]);

        const blocked = new Set();
        const allowedStatuses = new Set(["confirmed", "paid"]);

        [...(onlineSnap?.docs || []), ...(walkInSnap?.docs || [])].forEach((d) => {
          const data = d.data ? d.data() : d;
          const statusVal = (data.status || data.reservationStatus || "").toString().toLowerCase();
          if (!data.time || !allowedStatuses.has(statusVal)) return;
          const idx = timeSlots.indexOf(data.time);
          if (idx < 0) return;
          const duration = data.duration || 30;
          const slotsNeeded = Math.ceil(duration / 30);
          for (let i = idx; i < idx + slotsNeeded && i < timeSlots.length; i++) blocked.add(timeSlots[i]);
        });

        if (selectedOption) {
          const slotsNeeded = Math.ceil((selectedOption.time || 30) / 30);
          const canUse = timeSlots.filter((_, idx) => {
            if (idx + slotsNeeded > timeSlots.length) return false;
            for (let i = 0; i < slotsNeeded; i++) {
              if (blocked.has(timeSlots[idx + i])) return false;
            }
            return true;
          });
          setAvailableTimes(canUse);
        } else {
          setAvailableTimes(timeSlots.filter((s) => !blocked.has(s)));
        }
      } catch (err) {
        console.error("date check:", err);
        setAvailableTimes(timeSlots);
      } finally {
        setIsLoading(false);
      }
    }, 350);
  };

  useEffect(() => {
    if (formData.date && selectedOption) handleDateChange(formData.date);
  }, [selectedOption]);

  // Helper function to get next follow-up date
  const getNextFollowUpDate = (dateStr, intervalDays = 30) => {
    const dateObj = new Date(dateStr);
    dateObj.setDate(dateObj.getDate() + intervalDays);
    return dateObj.toISOString().slice(0, 10);
  };

  // Helper function to check if treatment is multi-visit
  const isMultiVisitTreatment = () => {
    return selectedCategory && MULTI_VISIT_TREATMENTS[selectedCategory.category];
  };

  // Helper function to get down payment amount
  const getDownPaymentAmount = (price) => {
    // Typically 30-50% of total, adjust as needed
    return Math.ceil(price * 0.4);
  };

  // Helper function to calculate payment amount based on payment type
  const calculatePaymentAmount = () => {
    if (!selectedOption) return RESERVATION_FEE;

    if (formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT) {
      return RESERVATION_FEE + getDownPaymentAmount(selectedOption.price);
    } else if (formData.paymentType === PAYMENT_TYPES.FULL) {
      return RESERVATION_FEE + selectedOption.price;
    }
    return RESERVATION_FEE;
  };

  // PayPal payment handler with improved amount handling
  const handlePayPalPayment = async (data, actions) => {
    setIsLoading(true);
    try {
      const details = await actions.order.capture();

      // Try to read the captured amount from PayPal response
      const capture = details?.purchase_units?.[0]?.payments?.captures?.[0];
      const capturedAmountStr = capture?.amount?.value || details?.purchase_units?.[0]?.amount?.value || null;
      const amountPaid = capturedAmountStr ? parseFloat(capturedAmountStr) : RESERVATION_FEE;
      const txId = capture?.id || details?.id || null;

      // Final double-booking check (createOrder already checks, but re-validate)
      const hasConflict = await checkForDoubleBooking(
        formData.date,
        formData.time,
        selectedOption?.time
      );

      if (hasConflict) {
        toast.error("This time slot was just booked. Please select another time.");
        setIsLoading(false);
        return;
      }

      const paymentPayload = {
        userId: user?.uid || null,
        userName: user?.displayName || user?.email || "Unknown Patient",
        userEmail: user?.email || "",
        type: "reservation",
        amount: amountPaid,
        gateway: "paypal",
        txId,
        details,
        status: "captured",
        paymentType: formData.paymentType,
        visitType: formData.visitType,
        createdAt: serverTimestamp(),
      };

      const pRef = await addDoc(collection(db, "payments"), paymentPayload);
      const paymentObj = {
        paymentDocId: pRef.id,
        txId,
        amount: amountPaid,
        gateway: "paypal",
        paymentType: formData.paymentType,
        createdAt: new Date().toISOString(),
      };

      setLastPaymentData(paymentObj);

      const success = await createAppointment({
        reservationMethod: "paypal",
        reservationStatus: "paid",
        status: "confirmed",
        paymentData: paymentObj,
        paymentType: formData.paymentType,
        visitType: formData.visitType,
      });

      if (success) {
        toast.success("Payment successful! Your appointment is confirmed. ✅");
        clearFormDataFromSession();
        setInvoiceOpen(true);
        setTimeout(() => resetForm(), 2000);
      }
    } catch (err) {
      console.error("paypal error:", err);
      toast.error("Payment failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Create appointment with enhanced validation
  const createAppointment = async ({ reservationMethod, reservationStatus, status, paymentData = null, paymentType = "", visitType = "initial" }) => {
    try {
      const hasConflict = await checkForDoubleBooking(
        formData.date,
        formData.time,
        selectedOption.time
      );

      if (hasConflict) {
        toast.error("This time slot is no longer available. Please select another time.");
        return false;
      }

      if (REQUIRE_HEALTH_ANSWERS) {
        const unanswered = Object.values(healthAnswers).some((v) => v !== "yes" && v !== "no");
        if (unanswered) {
          toast.error("Please answer all health questions");
          return false;
        }
      }

      const selectedDentist = dentists.find(d => d.id === formData.preferredDentist || d.uid === formData.preferredDentist);

      const treatmentPrice = selectedOption?.price || 0;
      const downPaymentAmount = getDownPaymentAmount(treatmentPrice);
      const paidAmount = paymentData?.amount || 0; // default to 0 when no payment data (cash at clinic)

      // determine payment status from actual paid amount
      let paymentStatus = "unpaid";
      if (paidAmount >= treatmentPrice) paymentStatus = "paid";
      else if (paidAmount > 0) paymentStatus = "partial";

      const appointmentPayload = {
        requestType: "online",
        treatment: selectedCategory?.category || "",
        treatmentOption: `${selectedCategory?.category || ""} - ${selectedOption?.type || ""}`,
        price: treatmentPrice,
        downPaymentAmount: downPaymentAmount,
        paidAmount: paidAmount,
        // remaining amount for the patient to pay (does NOT subtract reservation fee)
        remainingAmount: Math.max(0, treatmentPrice - paidAmount),
        paymentType: paymentType,
        visitType: visitType,
        isMultiVisit: isMultiVisitTreatment() ? true : false,
        date: formData.date,
        time: formData.time,
        duration: selectedOption?.time || 30,
        reservationMethod,
        reservationStatus,
        reservationFee: RESERVATION_FEE,
        reservationFeePaid: paidAmount >= RESERVATION_FEE,
        paymentStatus: paymentStatus,
        status,
        userId: user?.uid || null,
        userName: user?.displayName || user?.email || "Unknown Patient",
        userEmail: user?.email || "",
        preferredDentist: selectedDentist?.fullName || formData.preferredDentist || "",
        dentistId: formData.preferredDentist || null,
        healthDeclaration: formData.healthDeclaration || "",
        health: {
          questions: healthQuestionsList.map(({ id, text }) => ({ id, text })),
          answers: healthAnswers,
        },
        createdAt: serverTimestamp(),
      };

      if (paymentData) {
        appointmentPayload.paymentsSummary = {
          reservation: paymentData
        };
      }

      const aRef = await addDoc(collection(db, "onlineRequests"), appointmentPayload);

      if (paymentData?.paymentDocId) {
        try {
          await updateDoc(doc(db, "payments", paymentData.paymentDocId), {
            appointmentId: aRef.id,
            linkedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("link payment failed", e);
        }
      }

      // ============ NEW: SEND AUTO-SMS ============
      const smsResult = await sendAppointmentSMS(appointmentPayload);
      if (smsResult.success) {
        toast.success("📱 Appointment confirmation SMS sent!");
      } else {
        console.log("SMS not sent:", smsResult.reason || smsResult.error);
        // Don't fail the appointment if SMS fails
      }

      // AUTO-BOOK FOLLOW-UP FOR MULTI-VISIT TREATMENTS (only if first appointment is confirmed)
      if (appointmentPayload.isMultiVisit && visitType === "initial" && status === "confirmed") {
        const followUpDate = getNextFollowUpDate(appointmentPayload.date, 30);
        const followUpPayload = {
          ...appointmentPayload,
          date: followUpDate,
          time: appointmentPayload.time,
          visitType: "followup",
          status: "booked",
          paymentStatus: "unpaid",
          createdAt: serverTimestamp(),
          reservationFeePaid: false,
        };
        try {
          await addDoc(collection(db, "onlineRequests"), followUpPayload);
          toast.success(`Follow-up appointment automatically scheduled for ${followUpDate} at ${appointmentPayload.time}.`);
          // Send SMS for follow-up appointment too
          const followUpSmsResult = await sendAppointmentSMS(followUpPayload);
          if (followUpSmsResult.success) {
            toast.success("📱 Follow-up appointment SMS sent!");
          }
        } catch (err) {
          console.error("Follow-up booking error:", err);
          toast.error("Error auto-booking follow-up appointment.");
        }
      }

      toast.success("Appointment booked successfully!");
      return true;
    } catch (err) {
      console.error("create appointment err:", err);
      toast.error("Failed to create appointment");
      return false;
    }
  };

  // Cash payment handler
  const handleCashPayment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const success = await createAppointment({
        reservationMethod: "cash",
        reservationStatus: "unpaid",
        status: "pending",
        paymentType: formData.paymentType,
        visitType: formData.visitType,
      });

      if (success) {
        clearFormDataFromSession();
        setTimeout(() => resetForm(), 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedCategory(null);
    setSelectedOption(null);
    setFormData({ date: "", time: "", preferredDentist: "", healthDeclaration: "", paymentType: "", visitType: "initial" });
    setAvailableTimes(timeSlots);
    setHealthAnswers(healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: "" }), {}));
    setLastPaymentData(null);
    setPaymentAmount(0);
    clearFormDataFromSession();
  };

  const canGoNext = () => {
    if (step === 1) return selectedCategory;
    if (step === 2) return selectedOption;
    if (step === 3) return formData.preferredDentist;
    if (step === 4) return formData.date && formData.time;
    if (step === 5) return true;
    if (step === 6) return !Object.values(healthAnswers).some((v) => v !== "yes" && v !== "no");
    if (step === 7) return true;
    if (step === 8) return formData.paymentType; // New validation for payment type
    if (step === 9) return true;
    return false;
  };

  const nextStep = () => {
    if (canGoNext()) setStep(s => s + 1);
    else toast.error("Please complete this step first");
  };

  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const renderProgressBar = () => {
    const steps = ["Category", "Treatment", "Dentist", "Schedule", "Health Info", "Questions", "Review", "Payment"];
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((label, idx) => (
            <div key={idx} className="flex-1 flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded border ${idx + 1 <= step ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-300'} font-medium text-xs`}>
                {idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${idx + 1 < step ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          {steps.map((label, idx) => (
            <div key={idx} className="flex-1 text-center">
              <span className={`text-xs ${idx + 1 === step ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Filter appointments by status for display
  const rescheduledAppointments = appointmentHistory.filter(a => (a.status || "").toLowerCase() === "reschedule");

  return (
    <PayPalScriptProvider options={{ "client-id": PAYPAL_CLIENT_ID, currency: "PHP" }}>
      <div className="min-h-screen bg-gray-50 p-4">
        <ToastContainer />

        <div className="max-w-7xl mx-auto flex gap-6">
          {/* Left Side - Booking Form */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded border border-gray-300 p-6 mb-6">
            {renderProgressBar()}

            {/* Step 1: Category Selection */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-center mb-2">Service Category</h2>
                <p className="text-center text-gray-600 mb-6">Select the type of dental service you need</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {treatments.map((t) => (
                    <button
                      key={t.category}
                      onClick={() => {
                        setSelectedCategory(t);
                        setSelectedOption(null);
                        setTimeout(() => setStep(2), 300);
                      }}
                      className={`p-4 rounded border-2 text-left transition-all ${selectedCategory?.category === t.category
                        ? 'border-gray-700 bg-gray-100 shadow-sm'
                        : 'border-gray-300 hover:border-gray-600'
                        }`}
                    >
                      <div className="font-medium text-sm mb-1">{t.category}</div>
                      <div className="text-xs text-gray-600">{t.options.length} option{t.options.length > 1 ? 's' : ''}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

              {/* Step 2: Treatment Selection */}
              {step === 2 && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">Specific Treatment</h2>
                  <p className="text-center text-gray-500 mb-6">Choose from {selectedCategory?.category}</p>

                  <div className="grid gap-4 max-w-3xl mx-auto">
                    {selectedCategory?.options.map((opt) => (
                      <button
                        key={opt.type}
                        onClick={() => {
                          setSelectedOption(opt);
                          setTimeout(() => setStep(3), 300);
                        }}
                        className={`group p-6 rounded border-2 text-left transition-all duration-300 hover:scale-102 hover:shadow-xl ${selectedOption?.type === opt.type
                          ? 'border-gray-700 bg-gray-100 shadow-sm'
                        : 'border-gray-300 hover:border-gray-400'
                          }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h3 className="font-bold text-lg text-gray-800">
                                  {opt.type}
                                </h3>
                                <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
                                  <span className="flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {opt.time} mins
                                  </span>
                                  <span className="text-2xl font-bold text-cyan-700">
                                    ₱{opt.price}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Dentist Selection */}
              {step === 3 && (
                <div>
                  <h2 className="text-xl font-semibold mb-1">Dentist</h2>
                  <p className="text-gray-600 text-sm mb-4">Select a preferred dentist or any available</p>

                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setFormData(f => ({ ...f, preferredDentist: "any" }));
                        setTimeout(() => setStep(4), 300);
                      }}
                      className={`w-full p-4 text-left border rounded transition-all ${formData.preferredDentist === "any"
                        ? 'border-gray-700 bg-gray-100'
                        : 'border-gray-300 hover:border-gray-400'
                        }`}
                    >
                      <div className="font-medium">👨‍⚕️ Any Available Dentist</div>
                    </button>

                    {dentists.filter(dentist => dentist.status === 'active').map((dentist) => (
                      <button
                        key={dentist.id}
                        onClick={() => {
                          setFormData(f => ({ ...f, preferredDentist: dentist.uid || dentist.id }));
                          setTimeout(() => setStep(4), 300);
                        }}
                        className={`w-full p-4 text-left border rounded transition-all ${formData.preferredDentist === (dentist.uid || dentist.id)
                          ? 'border-gray-700 bg-gray-100'
                          : 'border-gray-300 hover:border-gray-400'
                          }`}
                      >
                        <div className="font-medium">👨‍⚕️ {dentist.fullName}</div>
                        {dentist.specialization && (
                          <div className="text-xs text-gray-600">{dentist.specialization}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Schedule Selection */}
              {step === 4 && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">When would you like to visit?</h2>
                  <p className="text-center text-gray-500 mb-8">Select your preferred date and time</p>

                  <div className="max-w-2xl mx-auto space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-center">Select Date</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={formData.date}
                        onChange={(e) => handleDateChange(e.target.value)}
                        className="w-full px-4 py-3 border-2 rounded- ? 'border-gray-700 bg-gray-100'
                          : 'border-gray-300 hover:border-gray-400' outline-none text-center text-lg"
                      />
                    </div>

                    {formData.date && (
                      <div className="animate-fadeIn">
                        <label className="block text-sm font-medium mb-2 text-center">
                          Select Time Slot {selectedOption && `(${selectedOption.time} min needed)`}
                        </label>
                        {isLoading ? (
                          <div className="text-center text-gray-500">Checking availability...</div>
                        ) : availableTimes.length === 0 ? (
                          <div className="text-center text-red-600">No available slots for this date</div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {availableTimes.map((slot) => (
                              <button
                                key={slot}
                                onClick={() => {
                                  setFormData(f => ({ ...f, time: slot }));
                                  setTimeout(() => setStep(5), 300);
                                }}
                                className={`p-3 rounded-xl border-2 transition-all hover:scale-102 ${formData.time === slot
                                   ? 'border-gray-700 bg-gray-100'
                          : 'border-gray-300 hover:border-gray-400'
                                  }`}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Health Declaration */}
              {step === 5 && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">Health Declaration</h2>
                  <p className="text-center text-gray-500 mb-8">Share any health concerns or allergies</p>

                  <div className="max-w-2xl mx-auto">
                    <textarea
                      value={formData.healthDeclaration}
                      onChange={(e) => setFormData(f => ({ ...f, healthDeclaration: e.target.value }))}
                      rows={6}
                      placeholder="E.g., Allergies to medications, recent illnesses, current medications, pregnancy, etc..."
                      className="w-full px-4 py-3 border-2 rounded ? 'border-gray-700 bg-gray-100'
                          : 'border-gray-300 hover:border-gray-400' outline-none resize-none border-gray-500"
                    />
                    <p className="text-sm text-gray-500 mt-2 text-center">Optional but recommended for your safety</p>
                  </div>
                </div>
              )}

              {/* Step 6: Health Questions */}
              {step === 6 && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">Health Screening Questions</h2>
                  <p className="text-center text-gray-500 mb-8">Please answer all questions honestly</p>

                  <div className="max-w-2xl mx-auto space-y-4">
                    {healthQuestionsList.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded border-2   ? 'border-gray-700 bg-gray-100'
                          : 'border-gray-300 hover:border-gray-400' transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <span className="text-cyan-600 font-semibold mr-2">Q{idx + 1}.</span>
                            <span className="text-gray-700">{q.text}</span>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setHealthAnswers(h => ({ ...h, [q.id]: "yes" }))}
                              className={`px-4 py-2 rounded-lg font-medium transition-all ${healthAnswers[q.id] === "yes"
                                ? 'bg-red-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setHealthAnswers(h => ({ ...h, [q.id]: "no" }))}
                              className={`px-4 py-2 rounded-lg font-medium transition-all ${healthAnswers[q.id] === "no"
                                ? 'bg-green-500 text-white shadow-md'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                              No
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 7: Review & Invoice */}
              {step === 7 && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">Review Your Appointment</h2>
                  <p className="text-center text-gray-500 mb-8">Please review the details and costs before proceeding</p>

                  <div className="max-w-2xl mx-auto space-y-3">
                    {/* Appointment Summary */}
                    <div className="p-4 rounded border-2 border-gray-300">
                      <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                        <span className="text-gray-600">Service</span>
                        <span className="font-medium">{selectedCategory?.category} - {selectedOption?.type}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                        <span className="text-gray-600">Dentist</span>
                        <span className="font-medium">{formData.preferredDentist === "any" ? "Any Available" : dentists.find(d => (d.uid || d.id) === formData.preferredDentist)?.fullName || "Selected"}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                        <span className="text-gray-600">Date & Time</span>
                        <span className="font-medium">{new Date(formData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {formData.time}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-gray-600">Duration</span>
                        <span className="font-medium">{selectedOption?.time} mins</span>
                      </div>
                      {isMultiVisitTreatment() && (
                        <div className="flex items-center justify-between pt-2 border-t border-gray-300 text-sm">
                          <span className="text-gray-600">Type</span>
                          <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 border border-blue-300 rounded text-xs font-medium">Multi-Visit</span>
                        </div>
                      )}
                    </div>

                    {/* Cost Breakdown */}
                    <div className="p-4 rounded border-2 border-gray-300">
                      {(() => {
                        const treatmentPrice = selectedOption?.price || 0;
                        const downPayment = formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT ? getDownPaymentAmount(treatmentPrice) : 0;
                        const estimatedBalanceAtClinic = Math.max(0, treatmentPrice - downPayment);
                        return (
                          <>
                            <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                              <span className="text-gray-600">Treatment Cost</span>
                              <span className="font-medium">₱{treatmentPrice.toLocaleString()}</span>
                            </div>
                            {downPayment > 0 && (
                              <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                                <span className="text-gray-600">Down Payment (at clinic)</span>
                                <span className="font-medium">₱{downPayment.toLocaleString()}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between py-2 border-b border-gray-300 text-sm">
                              <span className="text-gray-600">Reservation Fee (online)</span>
                              <span className="font-medium">₱{RESERVATION_FEE}</span>
                            </div>
                            <div className="flex items-center justify-between py-3 font-semibold text-sm">
                              <span className="text-gray-800">Balance Due at Clinic</span>
                              <span className="text-gray-900">₱{estimatedBalanceAtClinic.toLocaleString()}</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Note */}
                    <div className="p-3 rounded bg-gray-100 border border-gray-300 text-xs text-gray-700">
                      Reservation fee is separate from treatment cost and will not be deducted from clinic payments.
                    </div>

                    {isMultiVisitTreatment() && (
                      <div className="p-3 rounded bg-blue-50 border border-blue-300 text-xs text-blue-800">
                        Follow-up appointment will be auto-scheduled for {getNextFollowUpDate(formData.date, 30)} at {formData.time} (PayPal confirmation only).
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 8: Payment Type Selection (NEW) */}
              {step === 8 && isMultiVisitTreatment() && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold text-center mb-2">Payment Option</h2>
                  <p className="text-center text-gray-500 mb-8">Choose how to pay for this multi-visit treatment</p>

                  <div className="max-w-2xl mx-auto space-y-3">
                    {/* Down Payment Option */}
                    <button
                      onClick={() => {
                        setFormData(f => ({ ...f, paymentType: PAYMENT_TYPES.DOWN_PAYMENT, visitType: "initial" }));
                        setTimeout(() => setStep(9), 300);
                      }}
                      className={`w-full p-4 rounded border-2 text-left transition-all ${formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT ? 'border-gray-700 bg-gray-100' : 'border-gray-300 hover:border-gray-600'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">Down Payment (40%)</div>
                          <div className="text-xs text-gray-600 mt-1">Pay 40% now, balance at clinic or later</div>
                          <div className="mt-2 text-xs text-gray-700">
                            <span className="font-semibold">₱{getDownPaymentAmount(selectedOption?.price || 0).toLocaleString()}</span>
                            <span className="text-gray-600 ml-2">• Balance: ₱{((selectedOption?.price || 0) - getDownPaymentAmount(selectedOption?.price || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                        {formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT && (
                          <svg className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {/* Full Payment Option */}
                    <button
                      onClick={() => {
                        setFormData(f => ({ ...f, paymentType: PAYMENT_TYPES.FULL, visitType: "initial" }));
                        setTimeout(() => setStep(9), 300);
                      }}
                      className={`w-full p-4 rounded border-2 text-left transition-all ${formData.paymentType === PAYMENT_TYPES.FULL ? 'border-gray-700 bg-gray-100' : 'border-gray-300 hover:border-gray-600'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">Full Payment (100%)</div>
                          <div className="text-xs text-gray-600 mt-1">Pay complete cost upfront</div>
                          <div className="mt-2 text-xs text-gray-700">
                            <span className="font-semibold">₱{(selectedOption?.price || 0).toLocaleString()}</span>
                          </div>
                        </div>
                        {formData.paymentType === PAYMENT_TYPES.FULL && (
                          <svg className="w-5 h-5 text-gray-700 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>

                    <div className="p-3 rounded border-2 border-gray-300 text-xs text-gray-700">
                      <span className="font-semibold">Multi-visit treatments:</span> Typically require 2+ visits. Down payment (40%) due at clinic; full payment pays upfront.
                    </div>
                  </div>
                </div>
              )}

              {/* Step 9: Payment Method (was Step 8, now Step 9 for multi-visit) */}
              {((step === 9 && isMultiVisitTreatment()) || (step === 8 && !isMultiVisitTreatment())) && (
                <div className="animate-fadeIn">
                  <h2 className="text-2xl font-semibold mb-1">Payment Method</h2>
                  <p className="text-gray-500 text-sm mb-6">Choose how to pay your reservation fee</p>

                  <div className="max-w-2xl mx-auto space-y-4">
                    {/* Payment Summary */}
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <p className="font-semibold text-gray-800 text-sm mb-3">Payment Summary</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Reservation Fee:</span>
                          <span className="font-semibold text-gray-800">₱{RESERVATION_FEE}</span>
                        </div>
                        {isMultiVisitTreatment() && (
                          <>
                            <div className="border-t border-gray-300 pt-2 mt-2">
                              <p className="text-xs font-semibold text-gray-600 mb-2">Payment Option: {formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT ? "Down Payment" : "Full Payment"}</p>
                              {formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT && (
                                <p className="text-xs text-gray-600">
                                  Down payment of ₱{getDownPaymentAmount(selectedOption?.price || 0).toLocaleString()} to be paid at clinic after reservation.
                                </p>
                              )}
                              {formData.paymentType === PAYMENT_TYPES.FULL && (
                                <p className="text-xs text-gray-600">
                                  Full payment of ₱{(selectedOption?.price || 0).toLocaleString()} to be paid at clinic.
                                </p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Payment Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PayPal Option */}
                      <div className="border border-gray-300 rounded-lg p-4 space-y-3">
                        <div className="text-center">
                          <p className="font-semibold text-gray-800 text-sm mb-1">Pay Online (PayPal)</p>
                          <p className="text-xs text-gray-600 mb-2">Instant confirmation</p>
                          <p className="text-sm font-semibold text-gray-800">₱{RESERVATION_FEE}</p>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <PayPalButtons
                            createOrder={async (_, actions) => {
                              const conflict = await checkForDoubleBooking(formData.date, formData.time, selectedOption?.time);
                              if (conflict) {
                                toast.error("This time slot is no longer available. Please select another time.");
                                throw new Error('time-slot-unavailable');
                              }
                              return actions.order.create({
                                purchase_units: [{
                                  amount: { value: RESERVATION_FEE.toFixed(2) },
                                  description: `${selectedCategory?.category} - ${selectedOption?.type} Reservation Fee`
                                }]
                              });
                            }}
                            onApprove={handlePayPalPayment}
                            onError={(err) => {
                              console.error("paypal error:", err);
                              toast.error("PayPal Error. Please try again.");
                            }}
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      {/* Cash Option */}
                      <div className="border border-gray-300 rounded-lg p-4 space-y-3">
                        <div className="text-center">
                          <p className="font-semibold text-gray-800 text-sm mb-1">Pay at Clinic</p>
                          <p className="text-xs text-gray-600 mb-2">Pending confirmation</p>
                          <p className="text-sm font-semibold text-gray-800">₱{RESERVATION_FEE}</p>
                        </div>

                        <div className="border-t border-gray-200 pt-3 space-y-3">
                          <div className="bg-amber-50 border border-amber-300 rounded text-xs text-amber-800 p-2">
                            <p className="font-semibold mb-1">⚠️ Important:</p>
                            <ul className="space-y-1 list-disc list-inside text-xs">
                              <li>Your appointment will be marked as "Pending"</li>
                              <li>Pay ₱{RESERVATION_FEE} at the clinic</li>
                              {formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT && (
                                <li>Down payment of ₱{getDownPaymentAmount(selectedOption?.price || 0).toLocaleString()} also due</li>
                              )}
                              <li>Admin will confirm after payment</li>
                            </ul>
                          </div>
                          <button
                            onClick={handleCashPayment}
                            disabled={isSubmitting}
                            className="w-full py-2 rounded-lg bg-gray-700 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                          >
                            {isSubmitting ? "Submitting..." : "Book & Pay at Clinic"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm text-gray-700 space-y-2">
                      <p className="font-semibold">Payment Information:</p>
                      <ul className="space-y-1 list-disc list-inside text-xs text-gray-600">
                        <li>Reservation fee is separate from treatment cost and will not be deducted</li>
                        {formData.paymentType === PAYMENT_TYPES.DOWN_PAYMENT && (
                          <li>Down payment: ₱{getDownPaymentAmount(selectedOption?.price || 0).toLocaleString()} (clinic, after reservation)</li>
                        )}
                        <li>PayPal payment auto-confirms your booking</li>
                        <li>Cash payment creates a pending appointment (admin confirms after verification)</li>
                        <li>Refunds subject to clinic policy</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}


              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t">
                <button
                  onClick={prevStep}
                  disabled={step === 1}
                  className="px-6 py-3 rounded-xl border-2 border-gray-300 font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  ← Back
                </button>

                {step < 9 && (
                  <button
                    onClick={nextStep}
                    disabled={!canGoNext()}
                    className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-medium hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    Continue →
                  </button>
                )}
              </div>

              {/* styles */}
              <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceIn { 0% { opacity: 0; transform: scale(0.3); } 50% { opacity: 1; transform: scale(1.1); } 100% { transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-bounceIn { animation: bounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        .hover\\:scale-102:hover { transform: scale(1.02); }
      `}</style>
            </div>
          </div>

          {/* Right Side - Appointments */}
          <div className="w-96 h-screen overflow-y-auto flex-shrink-0">

            {/* Clear Draft Button */}
            {(selectedCategory || selectedOption || formData.date) && (
              <div className="mt-8">
                <button
                  onClick={() => {
                    clearFormDataFromSession();
                    resetForm();
                    toast.success('Draft cleared');
                  }}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-all"
                >
                  Clear Draft
                </button>
              </div>
            )}

            {/* Appointment History Toggle */}
            <div className="mt-8">
              <button 
                onClick={() => setShowHistory(!showHistory)} 
                className="w-full flex items-center justify-between px-6 py-4 bg-white border-2 border-gray-300 rounded-lg hover:border-gray-600 hover:bg-gray-50 transition-all font-semibold text-gray-800"
              >
                <span>My Appointments ({appointmentHistory.length})</span>
                {showHistory ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            {/* Appointment History Panel */}
            {showHistory && (
              <div className="mt-4 animate-fadeIn space-y-3">
                {appointmentHistory.length === 0 ? (
                  <div className="text-center text-gray-500 py-12 bg-white rounded-lg border border-gray-200">
                    <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No appointments yet</p>
                  </div>
                ) : (
                  appointmentHistory.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-800 text-sm">{apt.treatmentOption || apt.treatment}</div>
                          <div className="text-xs text-gray-500">{apt.date} {apt.time}</div>
                        </div>
                        <StatusBadge status={apt.status || apt.reservationStatus} />
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          className="px-3 py-1 rounded bg-blue-100 text-blue-700 text-xs border border-blue-200 hover:bg-blue-200"
                          onClick={() => {
                            setExpandedId(expandedId === apt.id ? null : apt.id);
                          }}
                        >
                          {expandedId === apt.id ? "Hide Details" : "View Details"}
                        </button>
                        {apt.status === "confirmed" && (
                          <button
                            className="px-3 py-1 rounded bg-yellow-100 text-yellow-700 text-xs border border-yellow-200 hover:bg-yellow-200"
                            onClick={() => {
                              setRescheduleTarget(apt);
                              setRescheduleDate("");
                              setRescheduleTime("");
                              setShowRescheduleModal(true);
                            }}
                          >
                            Reschedule
                          </button>
                        )}
                        {apt.status !== "cancelled" && apt.status !== "treated" && (
                          <button
                            className="px-3 py-1 rounded bg-red-100 text-red-700 text-xs border border-red-200 hover:bgred-200"
                            onClick={() => {
                              setCancelTarget(apt);
                              setConfirmCancelOpen(true);
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      {expandedId === apt.id && (
                        <div className="mt-3 text-xs text-gray-700 space-y-1">
                          <div><span className="font-semibold">Dentist:</span> {apt.preferredDentist || "Any"}</div>
                          <div><span className="font-semibold">Price:</span> ₱{apt.price}</div>
                          <div><span className="font-semibold">Status:</span> {apt.status || apt.reservationStatus}</div>
                          <div><span className="font-semibold">Health Declaration:</span> {apt.healthDeclaration || "N/A"}</div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Rescheduled Appointments Section */}
            {rescheduledAppointments.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                <h3 className="text-lg font-semibold text-yellow-700 mb-2">Rescheduled Appointments</h3>
                <div className="space-y-2">
                  {rescheduledAppointments.map((apt) => (
                    <div key={apt.id} className="border rounded-lg p-3 flex flex-col gap-1 bg-white">
                      <div className="font-semibold text-gray-800 text-sm">{apt.treatmentOption || apt.treatment}</div>
                      <div className="text-xs text-gray-500">New Date: {apt.date} {apt.time}</div>
                      <div className="text-xs text-gray-500">Status: {apt.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel confirmation modal */}
            {confirmCancelOpen && cancelTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fadeIn">
                <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-2xl">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Cancel Appointment</h3>
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <h4 className="font-semibold text-gray-800">{cancelTarget.treatmentOption || cancelTarget.treatment}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {cancelTarget.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {cancelTarget.time}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">This action cannot be undone. Are you sure you want to cancel this appointment?</p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setConfirmCancelOpen(false); setCancelTarget(null); }} 
                      className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 font-medium hover:bg-gray-50 transition-all"
                    >
                      Keep It
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          const aRef = doc(db, "onlineRequests", cancelTarget.id);
                          await updateDoc(aRef, { status: "cancelled", cancelledAt: serverTimestamp() });
                          toast.success("Appointment cancelled");

                          // Create a notification record and send SMS to the patient (if available)
                          try {
                            const apDoc = await getDoc(aRef);
                            const apData = apDoc?.data ? apDoc.data() : apDoc;
                            const userId = apData?.userId || user?.uid || null;

                            if (userId) {
                              // Create notification
                              try {
                                await addDoc(collection(db, "notifications"), {
                                  userId,
                                  appointmentId: cancelTarget.id,
                                  type: 'appointment_cancelled',
                                  title: 'Appointment Cancelled',
                                  message: `Your appointment for ${apData?.treatment || apData?.treatmentOption || ''} on ${apData?.date || ''} at ${apData?.time || ''} has been cancelled.`,
                                  read: false,
                                  timestamp: serverTimestamp(),
                                details: {
                                  appointmentDate: apData?.date,
                                  time: apData?.time,
                                  treatment: apData?.treatment || apData?.treatmentOption,
                                }
                              });
                            } catch (e) {
                              console.warn('Failed to create notification', e);
                            }

                            // Try to fetch user's phone number
                            try {
                              const userRef = doc(db, 'users', userId);
                              const userSnap = await getDoc(userRef);
                              const patientInfo = userSnap?.data ? userSnap.data() : userSnap || {};
                              const patientName = `${patientInfo.firstName || ''} ${patientInfo.lastName || ''}`.trim() || (user?.displayName || 'Patient');
                              const phoneNumber = patientInfo.contactNumber || patientInfo.phoneNumber || patientInfo.phone || null;

                              if (phoneNumber) {
                                const message = `Hi ${patientName}! We regret to inform you that your appointment for ${apData?.treatment || ''} scheduled on ${apData?.date || ''} at ${apData?.time || ''} has been CANCELLED. Please contact us to reschedule.`;
                                try {
                                  const resp = await fetch('/api/send-sms', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ number: phoneNumber, message })
                                  });
                                  if (!resp.ok) {
                                    const text = await resp.text();
                                    console.warn('SMS API responded with error:', text);
                                  } else {
                                    console.log('Cancellation SMS queued/sent');
                                  }
                                } catch (smsErr) {
                                  console.error('Failed to call SMS API', smsErr);
                                }
                              }
                            } catch (phoneErr) {
                              console.warn('Failed to fetch patient phone', phoneErr);
                            }
                          }
                        } catch (notifyErr) {
                          console.warn('Error during notification/SMS flow', notifyErr);
                        }
                      } catch (err) {
                        console.error("cancel err", err);
                        toast.error("Failed to cancel");
                      } finally {
                        setConfirmCancelOpen(false);
                        setCancelTarget(null);
                      }
                      }} 
                      className="flex-1 px-4 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Yes, Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Invoice / Payment summary modal */}
            {invoiceOpen && lastPaymentData && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold">Reservation Invoice</h3>
                    <button onClick={() => setInvoiceOpen(false)} className="text-sm text-gray-600 hover:underline">Close</button>
                  </div>
                  <div className="border-t pt-4 space-y-3">
                    <div className="flex justify-between text-sm text-gray-700"><span>Patient</span><span>{user?.displayName || user?.email || "Guest"}</span></div>
                    <div className="flex justify-between text-sm text-gray-700"><span>Amount</span><span>₱{lastPaymentData.amount}</span></div>
                    <div className="flex justify-between text-sm text-gray-700"><span>Transaction ID</span><span className="font-mono">{lastPaymentData.txId}</span></div>
                    <div className="flex justify-between text-sm text-gray-700"><span>Date</span><span>{new Date(lastPaymentData.createdAt || Date.now()).toLocaleString()}</span></div>
                    {lastPaymentData.paymentDocId && (
                      <div className="pt-3">
                        <a className="text-xs text-cyan-700 hover:underline" href="#" onClick={e => e.preventDefault()}>
                          View payment record
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Reschedule Modal */}
            {showRescheduleModal && rescheduleTarget && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-700">Reschedule Appointment</h3>
                      <button onClick={() => setShowRescheduleModal(false)} className="text-gray-400 hover:text-gray-600">
                        <X size={20} />
                      </button>
                    </div>
                    <div className="mb-4">
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Service:</span> {rescheduleTarget.treatmentOption || rescheduleTarget.treatment}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Current Date:</span> {rescheduleTarget.date}
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Current Time:</span> {rescheduleTarget.time}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Select New Date</label>
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={rescheduleDate}
                        onChange={async (e) => {
                          setRescheduleDate(e.target.value);
                          setRescheduleLoading(true);
                          // Fetch available times for selected date
                          try {
                            const onlineQ = query(collection(db, "onlineRequests"), where("date", "==", e.target.value));
                            const walkInQ = query(collection(db, "appointments"), where("date", "==", e.target.value));
                            const [onlineSnap, walkInSnap] = await Promise.all([getDocs(onlineQ), getDocs(walkInQ)]);
                            const blocked = new Set();
                            const allowedStatuses = new Set(["confirmed", "paid"]);
                            [...(onlineSnap?.docs || []), ...(walkInSnap?.docs || [])].forEach((d) => {
                              const data = d.data ? d.data() : d;
                              const statusVal = (data.status || data.reservationStatus || "").toString().toLowerCase();
                              if (!data.time || !allowedStatuses.has(statusVal)) return;
                              const idx = timeSlots.indexOf(data.time);
                              if (idx < 0) return;
                              const duration = data.duration || 30;
                              const slotsNeeded = Math.ceil(duration / 30);
                              for (let i = idx; i < idx + slotsNeeded && i < timeSlots.length; i++) blocked.add(timeSlots[i]);
                            });
                            setRescheduleAvailableTimes(timeSlots.filter((s) => !blocked.has(s)));
                          } catch (err) {
                            setRescheduleAvailableTimes(timeSlots);
                          } finally {
                            setRescheduleLoading(false);
                          }
                        }}
                        className="w-full p-2 border rounded text-sm"
                      />
                    </div>
                    {rescheduleDate && (
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Select New Time</label>
                        {rescheduleLoading ? (
                          <div className="text-center text-gray-500">Checking availability...</div>
                        ) : rescheduleAvailableTimes.length === 0 ? (
                          <div className="text-center text-red-600">No available slots for this date</div>
                        ) : (
                          <select
                            value={rescheduleTime}
                            onChange={e => setRescheduleTime(e.target.value)}
                            className="w-full p-2 border rounded text-sm"
                          >
                            <option value="">-- Select Time --</option>
                            {rescheduleAvailableTimes.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRescheduleModal(false)}
                        className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!rescheduleDate || !rescheduleTime || rescheduleLoading}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                        onClick={async () => {
                          if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
                          setRescheduleLoading(true);
                          try {
                            // Update appointment in Firestore
                            const aptRef = doc(db, "onlineRequests", rescheduleTarget.id);
                            await updateDoc(aptRef, {
                              date: rescheduleDate,
                              time: rescheduleTime,
                              status: "reschedule",
                              rescheduledAt: serverTimestamp(),
                            });
                            toast.success("Appointment rescheduled!");
                            setShowRescheduleModal(false);
                          } catch (err) {
                            toast.error("Failed to reschedule appointment");
                          } finally {
                            setRescheduleLoading(false);
                          }
                        }}
                      >
                        Confirm Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
          </PayPalScriptProvider>
  );
}

