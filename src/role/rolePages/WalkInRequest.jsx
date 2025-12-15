// src/admin/adminWalkInRequest.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  runTransaction,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "../../../firebase.config";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  RefreshCw,
  Heart,
} from "lucide-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// SERVICE LIST WITH PRICE AND DURATION (from PatientAppointment)
const treatments = [
  {
    category: "Cleaning (LINIS)",
    options: [
      { type: "Mild to Average Deposit (Tartar)", price: 650, time: 30 },
      { type: "Moderate to Heavy Deposit", price: 900, time: 60 },
      { type: "Additional Stain Removal (Prophy Jet)", price: 300, time: 30 },
    ],
  },
  {
    category: "Filling (PASTA)",
    options: [
      { type: "Temporary", price: 400, time: 30 },
      { type: "Permanent", price: 1150, time: 60 },
    ],
  },
  {
    category: "Tooth Extraction (BUNOT)",
    options: [
      { type: "Regular", price: 600, time: 30 },
      { type: "Complicated", price: 1000, time: 60 },
      { type: "Surgery", price: 5500, time: 60 },
    ],
  },
  {
    category: "Crown / Bridge (JACKET) - per unit",
    options: [
      { type: "Porcelain", price: 7000, time: 60 },
      { type: "Plastic", price: 3000, time: 60 },
      { type: "Temporary", price: 300, time: 30 },
    ],
  },
  {
    category: "Complete Denture (Upper or Lower)",
    options: [
      { type: "Ordinary", price: 5000, time: 60 },
      { type: "Lucitone", price: 7000, time: 60 },
      { type: "Flexicryl", price: 16000, time: 60 },
      { type: "Ivocap", price: 15000, time: 60 },
      { type: "Porcelain Pontic", price: 10000, time: 60 },
    ],
  },
  {
    category: "Orthodontics (BRACES)",
    options: [
      { type: "Conventional (Metal) - Full", price: 35000, time: 60 },
      { type: "Conventional (Metal) - DP", price: 10000, time: 30 },
      { type: "Ceramic - Full", price: 45000, time: 60 },
      { type: "Ceramic - DP", price: 15000, time: 30 },
      { type: "Self-ligating - Full", price: 55000, time: 60 },
      { type: "Self-ligating - DP", price: 25000, time: 30 },
      { type: "Upper OR Lower Only (Metal)", price: 20000, time: 60 },
      { type: "Upper OR Lower DP", price: 8000, time: 30 },
      { type: "Per Adjustment", price: 1000, time: 30 },
    ],
  },
  {
    category: "Retainer",
    options: [
      { type: "Hawley Retainer (Plain)", price: 1500, time: 30 },
      { type: "Invisible Retainer", price: 3500, time: 30 },
      { type: "Soft Mouthguard", price: 3500, time: 30 },
    ],
  },
  {
    category: "Partial Denture",
    options: [
      { type: "Ordinary", price: 3750, time: 60 },
      { type: "Ordinary (1-3 teeth missing)", price: 2750, time: 30 },
      { type: "Metal Framework (Uni)", price: 7000, time: 60 },
      { type: "Metal Framework (Bila)", price: 10000, time: 60 },
      { type: "Flexible", price: 10500, time: 60 },
      { type: "Thermosense", price: 14000, time: 60 },
      { type: "Combination Flexi-Metal", price: 13000, time: 60 },
    ],
  },
  {
    category: "Porcelain Pontic on RPD (additional)",
    options: [
      { type: "Porcelain Pontic", price: 2500, time: 30 },
    ],
  },
  {
    category: "Whitening",
    options: [
      { type: "In-Office", price: 6000, time: 60 },
    ],
  },
  {
    category: "Veneers",
    options: [
      { type: "Ceramage", price: 11000, time: 60 },
      { type: "E-max", price: 14000, time: 60 },
      { type: "Zirconia", price: 16000, time: 60 },
      { type: "Direct Composite", price: 2500, time: 30 },
    ],
  },
  {
    category: "Root Canal Therapy",
    options: [
      { type: "Per Canal", price: 3500, time: 60 },
    ],
  },
  {
    category: "TMJ Therapy",
    options: [
      { type: "Splint", price: 7000, time: 60 },
      { type: "Expander", price: 8000, time: 60 },
      { type: "Bionator", price: 10000, time: 60 },
      { type: "Combination Appliance (Phase 1)", price: 10000, time: 60 },
      { type: "Per Adjustment", price: 1500, time: 30 },
    ],
  },
  {
    category: "Denture Repair",
    options: [
      { type: "Denture Repair", price: 600, time: 30 },
      { type: "Replacement Pontic (Plastic)", price: 300, time: 30 },
    ],
  },
];

// HEALTH QUESTIONS (from PatientAppointment)
const healthQuestionsList = [
  { id: "q1", text: "Do you have a fever or temperature over 38°C?" },
  { id: "q2", text: "Have you experienced shortness of breath?" },
  { id: "q3", text: "Do you have a dry cough?" },
  { id: "q4", text: "Do you have runny nose?" },
  { id: "q5", text: "Have you recently lost or had a reduction in your sense of smell?" },
  { id: "q6", text: "Do you have sore throat?" },
  { id: "q7", text: "Do you have diarrhea?" },
  { id: "q8", text: "Do you have influenza-like symptoms (headache, aches and pains, rash on skin)?" },
  { id: "q9", text: "Do you have history of COVID-19 infection?" },
  { id: "q10", text: "Have you been in contact with someone who tested positive for COVID-19?" },
];

const TIME_SLOTS = [
  "10:00 - 10:30",
  "10:30 - 11:00",
  "11:00 - 11:30",
  "11:30 - 12:00",
  "12:00 - 12:30",
  "12:30 - 13:00",
  "13:00 - 13:30",
  "13:30 - 14:00",
  "14:00 - 14:30",
  "14:30 - 15:00",
  "15:00 - 15:30",
  "15:30 - 16:00",
  "16:00 - 16:30",
  "16:30 - 17:00",
];

const colorOptions = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
  { name: "Teal", value: "#14b8a6" },
];

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

export default function AdminWalkInRequest() {
  const [appointments, setAppointments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);

  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);

  const [form, setForm] = useState({
    patientId: "",
    patientEmail: "",
    patientPhone: "",
    providerId: "",
    appointmentDate: "",
    slot: "",
    healthDeclaration: "",
    status: "confirmed",
    color: "#3b82f6",
  });

  const [healthAnswers, setHealthAnswers] = useState(
    healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: "" }), {})
  );

  const [availableSlots, setAvailableSlots] = useState(TIME_SLOTS);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const apptQ = query(collection(db, "appointments"), orderBy("createdAt", "desc"));
    const unsubAppt = onSnapshot(
      apptQ,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!mountedRef.current) return;
        setAppointments(data);
        setFiltered(data);
        setLoadingAppointments(false);
      },
      (err) => {
        console.error("appointments subscription error:", err);
        toast.error("Failed to load appointments");
        setLoadingAppointments(false);
      }
    );

    (async function loadPatients() {
      try {
        const q = query(collection(db, "users"), orderBy("firstName"));
        const snap = await getDocs(q);
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!mountedRef.current) return;
        setPatients(arr);
      } catch (e) {
        console.error("load patients error:", e);
      }
    })();

    (async function loadDentists() {
      try {
        const q = query(collection(db, "dentists"), orderBy("fullName"));
        const snap = await getDocs(q);
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!mountedRef.current) return;
        setDentists(arr);
      } catch (e) {
        console.error("load dentists error:", e);
      } finally {
        if (!mountedRef.current) return;
        setLoadingMeta(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      unsubAppt && unsubAppt();
    };
  }, []);

  useEffect(() => {
    const s = search.trim().toLowerCase();
    const result = appointments.filter((a) => {
      if (tab !== "All") {
        if ((a.status || "").toLowerCase() !== tab.toLowerCase()) return false;
      }
      if (!s) return true;
      const needle = s;
      const fields = [
        a.patientName || a.patient || "",
        a.treatment || "",
        a.preferredDentist || a.providerId || "",
        a.status || "",
        a.date || "",
      ];
      return fields.some((f) => (f || "").toString().toLowerCase().includes(needle));
    });
    setFiltered(result);
  }, [appointments, tab, search]);

  const computeAvailableSlots = async (dateStr, providerId) => {
    try {
      // Check both walk-in appointments AND online requests
      const walkInQ = query(collection(db, "appointments"), where("date", "==", dateStr), where("providerId", "==", providerId));
      const onlineQ = query(collection(db, "onlineRequests"), where("date", "==", dateStr));
      
      const [walkInSnap, onlineSnap] = await Promise.all([
        getDocs(walkInQ),
        getDocs(onlineQ)
      ]);

      const blocked = new Set();
      const allowedStatuses = new Set(["confirmed", "paid"]);

      // Block slots from walk-in
      walkInSnap.forEach((d) => {
        const ap = d.data();
        if (!allowedStatuses.has((ap.status || ap.reservationStatus || "").toString().toLowerCase())) return;
        const idx = TIME_SLOTS.indexOf(ap.time);
        const apSlots = Math.ceil((ap.duration || 30) / 30);
        if (idx < 0) return;
        for (let i = idx; i < idx + apSlots && i < TIME_SLOTS.length; i++) {
          blocked.add(TIME_SLOTS[i]);
        }
      });

      // Block slots from online requests
      onlineSnap.forEach((d) => {
        const ap = d.data();
        if (!allowedStatuses.has((ap.status || ap.reservationStatus || "").toString().toLowerCase())) return;
        const idx = TIME_SLOTS.indexOf(ap.time);
        const apSlots = Math.ceil((ap.duration || 30) / 30);
        if (idx < 0) return;
        for (let i = idx; i < idx + apSlots && i < TIME_SLOTS.length; i++) {
          blocked.add(TIME_SLOTS[i]);
        }
      });

      // Filter available slots based on selected service duration
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

  async function createWalkInAppointment(payload) {
    const appointmentPayload = {
      userId: payload.userId || null,
      patientName: payload.patientName || "Walk-in Patient",
      patientEmail: payload.patientEmail || "",
      patientPhone: payload.patientPhone || "",
      providerId: payload.providerId,
      preferredDentist: payload.providerId,
      date: payload.appointmentDate,
      time: payload.slot,
      duration: payload.duration || 30,
      treatment: payload.treatment || "",
      treatmentOption: payload.treatmentOption || "",
      price: Number(payload.price || 0),
      healthDeclaration: payload.healthDeclaration || "",
      health: payload.health || {},
      status: payload.status || "confirmed",
      color: payload.color || "#3b82f6",
      createdAt: serverTimestamp(),
      createdBy: auth?.currentUser?.uid || null,
    };

    const docRef = await addDoc(collection(db, "appointments"), appointmentPayload);

    return docRef.id;
  }

  function openAddModal() {
    setSelectedCategory(null);
    setSelectedOption(null);
    setForm({
      patientId: "",
      patientEmail: "",
      patientPhone: "",
      providerId: "",
      appointmentDate: "",
      slot: "",
      healthDeclaration: "",
      status: "confirmed",
      color: "#3b82f6",
    });
    setHealthAnswers(healthQuestionsList.reduce((acc, q) => ({ ...acc, [q.id]: "" }), {}));
    setShowAddModal(true);
  }

  function closeAddModal() {
    setShowAddModal(false);
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

  async function handleAddSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!form.patientId) {
        toast.error("Please select a patient.");
        setSubmitting(false);
        return;
      }
      if (!selectedCategory || !selectedOption) {
        toast.error("Please select a service and option.");
        setSubmitting(false);
        return;
      }
      if (!form.providerId) {
        toast.error("Select a dentist.");
        setSubmitting(false);
        return;
      }
      if (!form.appointmentDate) {
        toast.error("Select an appointment date.");
        setSubmitting(false);
        return;
      }
      if (!form.slot) {
        toast.error("Select a time slot.");
        setSubmitting(false);
        return;
      }

      const unanswered = Object.values(healthAnswers).some((v) => v !== "yes" && v !== "no");
      if (unanswered) {
        toast.error("Please answer all health questions.");
        setSubmitting(false);
        return;
      }

      const patient = patients.find((p) => p.id === form.patientId);
      const patientName = patient ? `${patient.firstName || ""} ${patient.lastName || ""}`.trim() : "Walk-in Patient";

      const payload = {
        userId: form.patientId,
        patientName,
        patientEmail: form.patientEmail,
        patientPhone: form.patientPhone,
        providerId: form.providerId,
        appointmentDate: form.appointmentDate,
        slot: form.slot,
        treatment: selectedCategory.category,
        treatmentOption: `${selectedCategory.category} - ${selectedOption.type}`,
        price: selectedOption.price,
        duration: selectedOption.time,
        healthDeclaration: form.healthDeclaration,
        health: {
          questions: healthQuestionsList.map(({ id, text }) => ({ id, text })),
          answers: healthAnswers,
        },
        status: form.status || "confirmed",
        color: form.color,
      };

      await createWalkInAppointment(payload);

      toast.success("Walk-in appointment created");
      setShowAddModal(false);
    } catch (err) {
      console.error("createWalkInAppointment error:", err);
      toast.error("Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(appt) {
    setEditId(appt.id);
    setEditForm({
      treatment: appt.treatment || "",
      treatmentOption: appt.treatmentOption || "",
      appointmentDate: appt.date || "",
      slot: appt.time || "",
      price: appt.price || 0,
      healthDeclaration: appt.healthDeclaration || "",
      preferredDentist: appt.preferredDentist || appt.providerId || "",
      status: appt.status || "pending",
      color: appt.color || "#3b82f6",
    });
  }

  async function handleEditSave(e) {
    e.preventDefault();
    if (!editId) return;
    setSubmitting(true);
    try {
      const apptRef = doc(db, "appointments", editId);
      await updateDoc(apptRef, {
        treatment: editForm.treatment,
        treatmentOption: editForm.treatmentOption,
        date: editForm.appointmentDate,
        time: editForm.slot,
        price: Number(editForm.price || 0),
        healthDeclaration: editForm.healthDeclaration,
        status: editForm.status,
        preferredDentist: editForm.preferredDentist,
        color: editForm.color,
        updatedAt: serverTimestamp(),
        adminUpdatedBy: auth?.currentUser?.uid || null,
        adminUpdatedAt: serverTimestamp(),
      });

      toast.success("Appointment updated successfully");
      setEditId(null);
      setEditForm({});
    } catch (err) {
      console.error("handleEditSave error:", err);
      if (err.code === "not-found") {
        toast.error("Appointment not found. It may have been deleted.");
        setEditId(null);
        setEditForm({});
      } else {
        toast.error("Failed to update appointment. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelAppointment(id) {
    if (!id) return;
    if (!window.confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      const apptRef = doc(db, "appointments", id);
      await updateDoc(apptRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: auth?.currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      });
      toast.success("Appointment cancelled");
    } catch (e) {
      console.error("handleCancelAppointment error:", e);
      toast.error("Failed to cancel appointment");
    }
  }

  async function handleDeleteAppointment(id) {
    if (!id) return;
    if (!window.confirm("Delete appointment permanently? This cannot be undone.")) return;
    try {
      setDeletingId(id);
      await deleteDoc(doc(db, "appointments", id));
      toast.success("Appointment deleted");
    } catch (e) {
      console.error("handleDeleteAppointment error:", e);
      toast.error("Failed to delete appointment");
    } finally {
      setDeletingId(null);
    }
  }

  function getPatientDisplay(a) {
    if (a.userId) {
      const patient = patients.find((p) => p.id === a.userId);
      if (patient) {
        return `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown";
      }
    }
    return a.patientName || "Walk-in Patient";
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <ToastContainer position="top-right" />
      <div className="bg-white border rounded-md shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openAddModal}
              className="bg-blue-700 text-white px-3 py-1 rounded-md flex items-center gap-2 hover:bg-blue-800"
            >
              <Plus size={14} /> <span className="text-sm">Add Walk-in</span>
            </button>
          </div>
        </div>

        <div className="flex gap-4 border-b mb-4">
          {["All", "Pending", "Confirmed", "Treated", "Cancelled", "Reschedule"].map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`pb-2 text-sm font-medium border-b-2 ${
                tab === s ? "border-red-700 text-red-700" : "border-transparent text-gray-600 hover:text-red-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <input
              type="text"
              placeholder="Search patient, treatment, dentist..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border px-3 py-1 rounded text-sm border-gray-500 focus:border-red-600 focus:ring-1 focus:ring-red-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-auto border-gray-500 border">
            <thead className="bg-slate-50 text-gray-600  ">
              <tr>
                <th className="text-left px-4 py-3">Patient</th>
                <th className="text-left px-4 py-3">Date Submitted</th>
                <th className="text-left px-4 py-3">Appointment Date</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody>
              {loadingAppointments ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No appointments found.</td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="border-t border-gray-500 hover:bg-gray-200">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: a.color || "#3b82f6" }} />
                        {getPatientDisplay(a)}
                      </div>
                    </td>
                    <td className="px-4 py-3">{displayDate(a.createdAt)}</td>
                    <td className="px-4 py-3">{a.date || "N/A"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-white text-xs ${
                          a.status === "confirmed"
                            ? "bg-green-600"
                            : a.status === "pending"
                            ? "bg-yellow-500"
                            : a.status === "cancelled"
                            ? "bg-red-600"
                            : a.status === "treated"
                            ? "bg-blue-600"
                            : "bg-gray-500"
                        }`}
                      >
                        {a.status || "unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(a)}
                          className="p-2 bg-sky-500 text-white rounded hover:bg-sky-600"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          onClick={() => handleCancelAppointment(a.id)}
                          className="p-2 bg-amber-600 text-white rounded hover:bg-amber-700"
                          title="Cancel"
                        >
                          <RefreshCw size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteAppointment(a.id)}
                          className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-gray-700 mt-3">
          Showing <span className="font-medium">{filtered.length}</span> of <span className="font-medium">{appointments.length}</span> entries
        </div>
      </div>

      {/* Add Walk-in Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
          <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-xl overflow-auto max-h-[90vh]">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Add Walk-in Appointment</h3>
                <button onClick={closeAddModal} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {/* Patient Selection */}
                <div className="border-b pb-3">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Patient Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-600 block mb-1">Select Patient *</label>
                      <select
                        name="patientId"
                        value={form.patientId}
                        onChange={(e) => handlePatientSelect(e.target.value)}
                        className="w-full p-2 border rounded text-sm"
                      >
                        <option value="">-- Select Patient --</option>
                        {patients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.firstName || "") + " " + (p.lastName || "")} — {p.email || ""}
                          </option>
                        ))}
                      </select>
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
                        {dentists.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.fullName || d.name || d.id}
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
                    onClick={closeAddModal}
                    className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSubmit}
                    disabled={submitting}
                    className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Walk-in"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-40">
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Appointment</h3>
              <button onClick={() => { setEditId(null); setEditForm({}); }} className="text-gray-500 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-gray-600 block mb-1">Treatment</label>
                <input
                  value={editForm.treatment || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, treatment: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">Treatment Option</label>
                <input
                  value={editForm.treatmentOption || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, treatmentOption: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Date</label>
                  <input
                    type="date"
                    value={editForm.appointmentDate || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, appointmentDate: e.target.value }))}
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 block mb-1">Time</label>
                  <input
                    value={editForm.slot || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, slot: e.target.value }))}
                    placeholder="10:00 - 10:30"
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-1">Price</label>
                <input
                  type="number"
                  value={editForm.price || 0}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 block mb-2">Calendar Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, color: color.value }))}
                      className={`w-8 h-8 rounded border-2 transition-all ${
                        editForm.color === color.value ? "border-gray-800 scale-110" : "border-gray-300"
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
                  value={editForm.status || "pending"}
                  onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="treated">Treated</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="reschedule">Reschedule</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditId(null); setEditForm({}); }}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleEditSave}
                  disabled={submitting}
                  className="px-4 py-2 bg-red-700 text-white rounded hover:bg-red-800 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}