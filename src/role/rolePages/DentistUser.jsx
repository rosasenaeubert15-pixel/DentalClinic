import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, 
  Edit,
  Trash2,
  X,
  CheckCircle,
  RefreshCw,
  User,
  Phone,
  MapPin,
  Mail,
  Briefcase,
  Calendar,
  Users as UsersIcon,
  Stethoscope,
  GraduationCap
} from "lucide-react";
import { 
  collection, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  doc,
  setDoc,
  onSnapshot
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword
} from "firebase/auth";
import { db, auth } from "../../../firebase.config";

export default function DentistUser() {
  const fileRef = useRef(null);
  
  const [dentists, setDentists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedDentist, setSelectedDentist] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Table controls
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [globalSearch, setGlobalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  
  const [formData, setFormData] = useState({
    fullName: "",
    birthdate: "",
    address: "",
    gender: "",
    contactNumber: "",
    email: "",
    degree: "",
    specialty: "",
    password: "",
    confirmPassword: "",
    photoURL: "",
    status: "active",
    currentAdminPassword: ""
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Subscribe to realtime dentists from Firebase
  useEffect(() => {
    setLoading(true);
    const col = collection(db, "dentists");
    const unsub = onSnapshot(
      col,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        arr.sort((a, b) => {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bt - at;
        });
        setDentists(arr);
        setLoading(false);
      },
      (err) => {
        setError("Subscription error: " + (err?.message || err));
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let result = dentists;

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter((d) => d.status === statusFilter.toLowerCase());
    }

    // Search filter
    const s = globalSearch.trim().toLowerCase();
    if (s) {
      result = result.filter(
        (dentist) =>
          (dentist.fullName || "").toLowerCase().includes(s) ||
          (dentist.email || "").toLowerCase().includes(s) ||
          (dentist.specialty || "").toLowerCase().includes(s) ||
          (dentist.contactNumber || "").toLowerCase().includes(s) ||
          (dentist.gender || "").toLowerCase().includes(s)
      );
    }

    return result;
  }, [dentists, globalSearch, statusFilter]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  // Count by status
  const allCount = dentists.length;
  const activeCount = dentists.filter((d) => d.status === "active").length;
  const inactiveCount = dentists.filter((d) => d.status === "inactive").length;

  function clearMessages() {
    setError("");
    setSuccessMsg("");
  }

  function handleAddDentist() {
    setModalMode("add");
    setSelectedDentist(null);
    setFormData({
      fullName: "",
      birthdate: "",
      address: "",
      gender: "",
      contactNumber: "",
      email: "",
      degree: "",
      specialty: "",
      password: "",
      confirmPassword: "",
      photoURL: "",
      status: "active",
      currentAdminPassword: ""
    });
    setImageFile(null);
    setImagePreview("");
    setShowModal(true);
  }

  function handleEditDentist(dentist) {
    setModalMode("edit");
    setSelectedDentist(dentist);
    setFormData({
      fullName: dentist.fullName || "",
      birthdate: dentist.birthdate || "",
      address: dentist.address || "",
      gender: dentist.gender || "",
      contactNumber: dentist.contactNumber || "",
      email: dentist.email || "",
      degree: dentist.degree || "",
      specialty: dentist.specialty || "",
      password: "",
      confirmPassword: "",
      photoURL: dentist.photoURL || "",
      status: dentist.status || "active",
      currentAdminPassword: ""
    });
    setImagePreview(dentist.photoURL || "");
    setImageFile(null);
    setShowModal(true);
  }

  function handleAvatarSelect(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (jpg/png).");
      ev.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image too large (max 2MB).");
      ev.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setImagePreview(base64);
      setFormData(prev => ({ ...prev, photoURL: base64 }));
      setImageFile(file);
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);

    ev.target.value = "";
  }

  function handleRemoveAvatar() {
    setImagePreview("");
    setFormData(prev => ({ ...prev, photoURL: "" }));
    setImageFile(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearMessages();

    if (!formData.fullName || !formData.birthdate || !formData.address || 
        !formData.gender || !formData.contactNumber || !formData.email || 
        !formData.degree || !formData.specialty) {
      setError("Please fill in all required fields");
      return;
    }

    if (modalMode === "add") {
      if (!formData.password || !formData.confirmPassword) {
        setError("Password is required");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (formData.password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (!formData.currentAdminPassword) {
        setError("Please enter your admin password");
        return;
      }
    }

    setSubmitLoading(true);

    try {
      const photoURL = formData.photoURL;

      if (modalMode === "add") {
        const currentAdminEmail = auth.currentUser?.email;

        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

        const uid = userCredential.user.uid;

        const dentistData = {
          uid,
          fullName: formData.fullName,
          birthdate: formData.birthdate,
          address: formData.address,
          gender: formData.gender,
          contactNumber: formData.contactNumber,
          email: formData.email,
          degree: formData.degree,
          specialty: formData.specialty,
          photoURL: photoURL || "",
          status: "active",
          role: "dentist",
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "dentists", uid), dentistData);

        const usersData = {
          uid,
          fullName: formData.fullName,
          email: formData.email,
          role: "dentist",
          photoURL: photoURL || "",
          status: "active",
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, "users", uid), usersData);

        await signOut(auth);
        
        if (currentAdminEmail && formData.currentAdminPassword) {
          try {
            await signInWithEmailAndPassword(auth, currentAdminEmail, formData.currentAdminPassword);
          } catch (e) {
            console.warn("Could not re-authenticate admin:", e.message);
          }
        }

        setSuccessMsg(`Dentist account created! Email: ${formData.email}`);
      } else {
        const dId = selectedDentist.uid || selectedDentist.id;
        const dentistRef = doc(db, "dentists", dId);
        await updateDoc(dentistRef, {
          fullName: formData.fullName,
          birthdate: formData.birthdate,
          address: formData.address,
          gender: formData.gender,
          contactNumber: formData.contactNumber,
          email: formData.email,
          degree: formData.degree,
          specialty: formData.specialty,
          photoURL: photoURL || "",
          updatedAt: new Date().toISOString()
        });

        try {
          const userRef = doc(db, "users", dId);
          await updateDoc(userRef, {
            fullName: formData.fullName,
            email: formData.email,
            photoURL: photoURL || "",
            updatedAt: new Date().toISOString()
          });
        } catch (err) {
          console.warn("Could not update users doc:", err.message);
        }

        setSuccessMsg("Dentist updated successfully!");
      }

      setShowModal(false);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (error) {
      console.error("Error saving dentist:", error);
      if (error.code === "auth/email-already-in-use") {
        setError("Email already in use");
      } else if (error.code === "auth/invalid-email") {
        setError("Invalid email address");
      } else if (error.code === "auth/wrong-password") {
        setError("Incorrect admin password");
      } else {
        setError("Failed to save dentist");
      }
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleToggleStatus(dentist) {
    clearMessages();
    try {
      const newStatus = dentist.status === "active" ? "inactive" : "active";
      const dentistRef = doc(db, "dentists", dentist.uid || dentist.id);
      await updateDoc(dentistRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      
      setSuccessMsg(`Dentist status changed to ${newStatus}`);
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update status");
    }
  }

  async function handleDeleteDentist(dentist) {
    if (!window.confirm(`Are you sure you want to delete ${dentist.fullName}?`)) return;

    try {
      const dentistRef = doc(db, "dentists", dentist.uid || dentist.id);
      await deleteDoc(dentistRef);
      setSuccessMsg("Dentist deleted successfully");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error) {
      console.error("Error deleting dentist:", error);
      setError("Failed to delete dentist");
    }
  }

  function openDetailsModal(dentist) {
    setSelectedDentist(dentist);
    setShowDetailsModal(true);
  }

  function getInitials(name) {
    if (!name) return "D";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Success Message */}
      {successMsg && (
        <div className="mb-4 max-w-[1400px] mx-auto">
          <div className="rounded-md bg-green-600 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} />
              <div className="font-medium">{successMsg}</div>
            </div>
            <button
              className="opacity-90 hover:opacity-100"
              onClick={() => setSuccessMsg("")}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* Status Cards */}
        <div className="bg-white rounded border border-gray-300 p-4">
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setStatusFilter("All")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "All"
                  ? "border-gray-500 bg-gray-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="text-2xl font-bold text-gray-700">{allCount}</div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                ALL DENTISTS
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("active")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "active"
                  ? "border-green-500 bg-green-50"
                  : "border-green-300 hover:bg-green-50"
              }`}
            >
              <div className="text-2xl font-bold text-green-600">
                {activeCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                ACTIVE
              </div>
            </button>

            <button
              onClick={() => setStatusFilter("inactive")}
              className={`border-2 rounded p-3 text-center transition-all ${
                statusFilter === "inactive"
                  ? "border-red-500 bg-red-50"
                  : "border-red-300 hover:bg-red-50"
              }`}
            >
              <div className="text-2xl font-bold text-red-600">
                {inactiveCount}
              </div>
              <div className="text-[10px] text-gray-600 font-semibold mt-1">
                INACTIVE
              </div>
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
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="border border-gray-400 rounded px-2 py-1 text-xs bg-white"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
              </select>
              <span className="text-xs text-gray-600">entries</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Search dentists..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setPage(1);
                }}
                className="border border-gray-400 rounded px-3 py-1 text-xs w-64 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none"
              />
              <button
                onClick={handleAddDentist}
                className="bg-cyan-700 text-white px-3 py-1.5 rounded flex items-center gap-2 hover:bg-cyan-900 text-xs font-medium"
              >
                <Plus size={14} />
                Add Dentist
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-gray-400 rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-100 border-b border-gray-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Photo
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Name
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Specialty
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 border-r border-gray-300">
                    Gender
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      {loading ? "Loading..." : "No dentists found"}
                    </td>
                  </tr>
                ) : (
                  paginated.map((dentist) => (
                    <tr
                      key={dentist.id}
                      onClick={() => openDetailsModal(dentist)}
                      className="border-b border-gray-300 hover:bg-blue-50 cursor-pointer transition-colors"
                      title="Click to view details"
                    >
                      <td className="px-3 py-2 border-r border-gray-200">
                        {dentist.photoURL ? (
                          <img
                            src={dentist.photoURL}
                            alt={dentist.fullName}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-semibold text-sm shadow">
                            {getInitials(dentist.fullName)}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="font-medium text-gray-800">
                          {dentist.fullName}
                        </div>
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-700">{dentist.specialty}</div>
                      </td>

                      <td className="px-3 py-2 border-r border-gray-200">
                        <div className="text-gray-700">{dentist.gender}</div>
                      </td>

                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            dentist.status === "active"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {dentist.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-700">
              Showing <span className="font-medium">{total === 0 ? 0 : (page - 1) * perPage + 1}</span> to{" "}
              <span className="font-medium">{Math.min(page * perPage, total)}</span> of{" "}
              <span className="font-medium">{total}</span> entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              <div className="flex gap-1">
                {getPageNumbers().map((pageNum, idx) =>
                  pageNum === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs">
                      ...
                    </span>
                  ) : (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`px-3 py-1 text-xs border rounded ${
                        page === pageNum
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-gray-400 hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-gray-400 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedDentist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-300 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {selectedDentist.photoURL ? (
                  <img
                    src={selectedDentist.photoURL}
                    alt={selectedDentist.fullName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {getInitials(selectedDentist.fullName)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedDentist.fullName}
                  </h2>
                  <p className="text-sm text-gray-600">{selectedDentist.specialty}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="space-y-4">
                {/* Contact Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Mail className="text-blue-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="font-medium text-gray-800 text-sm break-all">
                          {selectedDentist.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Phone className="text-purple-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Phone</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.contactNumber}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 md:col-span-2">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <MapPin className="text-red-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Address</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.address}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Professional Information */}
                <div className="bg-gray-50 border border-gray-300 p-4 rounded">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="text-orange-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Degree</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.degree}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="text-teal-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Specialty</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.specialty}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="text-pink-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Gender</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.gender}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Calendar className="text-green-600" size={18} />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Birthdate</p>
                        <p className="font-medium text-gray-800 text-sm">
                          {selectedDentist.birthdate || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-300">
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">
                    Actions
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailsModal(false);
                        handleEditDentist(selectedDentist);
                      }}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Edit size={16} />
                      Edit Dentist
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(selectedDentist);
                      }}
                      className="px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCw size={16} />
                      {selectedDentist.status === "active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetailsModal(false);
                        handleDeleteDentist(selectedDentist);
                      }}
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete Dentist
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white w-full max-w-2xl rounded-md shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-medium">
                  {modalMode === "add" ? "Add Dentist" : "Edit Dentist"}
                </h3>
                <div className="text-xs text-gray-500">
                  {modalMode === "add"
                    ? "Create new dentist account"
                    : "Update dentist information"}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Birthdate <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={(e) =>
                      setFormData({ ...formData, birthdate: e.target.value })
                    }
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Address <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Gender <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                  required
                  className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                >
                  <option value="">Choose</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Contact Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contactNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, contactNumber: e.target.value })
                    }
                    placeholder="09051234567"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={modalMode === "edit"}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm disabled:bg-gray-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Degree <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.degree}
                    onChange={(e) =>
                      setFormData({ ...formData, degree: e.target.value })
                    }
                    placeholder="e.g., DMD, DDS"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 font-medium mb-1">
                    Specialty <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.specialty}
                    onChange={(e) =>
                      setFormData({ ...formData, specialty: e.target.value })
                    }
                    placeholder="e.g., Orthodontics"
                    required
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                  />
                </div>
              </div>

              {modalMode === "add" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 font-medium mb-1">
                        Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 font-medium mb-1">
                        Confirm Password <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 font-medium mb-1">
                      Admin Password <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="password"
                      value={formData.currentAdminPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentAdminPassword: e.target.value,
                        })
                      }
                      placeholder="Your admin password"
                      required
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Required to re-authenticate after creating dentist account
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs text-gray-600 font-medium mb-1">
                  Upload Photo (Optional)
                </label>
                <div className="flex items-start gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileRef}
                    onChange={handleAvatarSelect}
                    className="text-xs flex-1"
                  />
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-16 h-16 object-cover rounded border-2 border-gray-300"
                    />
                  ) : selectedDentist ? (
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded border-2 border-gray-300 flex items-center justify-center text-white font-bold text-lg">
                      {getInitials(formData.fullName)}
                    </div>
                  ) : null}
                </div>
                {imagePreview && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove Photo
                    </button>
                  </div>
                )}
              </div>

              {modalMode === "add" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                  <div className="font-semibold mb-1">⚠️ Important:</div>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Dentist account will be created in Firebase Auth</li>
                    <li>You will be signed out after creating dentist</li>
                    <li>Enter your admin password to sign back in</li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-4 py-2 bg-cyan-700 text-white rounded text-sm hover:bg-cyan-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitLoading
                    ? modalMode === "add"
                      ? "Creating..."
                      : "Updating..."
                    : modalMode === "add"
                    ? "Create Dentist"
                    : "Update Dentist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed left-4 bottom-6 z-50">
          <div className="bg-red-600 text-white px-4 py-2 rounded shadow-lg flex items-center gap-3 max-w-md">
            <div className="text-sm">{error}</div>
            <button
              onClick={() => setError("")}
              className="opacity-90 hover:opacity-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}